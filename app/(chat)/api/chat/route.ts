import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
} from "ai";
import { auth } from "@/app/(auth)/auth";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
} from "@/lib/ai/models";
import { interviewSystemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { isProductionEnvironment } from "@/lib/constants";
import {
  cierreSeccionInputSchema,
  herramientasCierreActivas,
  mensajesTextoParaModelo,
  ofertaCierreInputSchema,
  pausaSeccionInputSchema,
} from "@/lib/consultoria/cierre-seccion";
import {
  completarSeccionEntrevista,
  getEntrevistaEscribible,
  getTranscripcionEntrevista,
  registrarTurnosEntrevista,
} from "@/lib/consultoria/entrevistas";
import { mensajesATurnos } from "@/lib/consultoria/mensajes-a-turnos";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { message, messages, selectedChatModel, entrevistaId, seccionId } =
      requestBody;
    const session = await auth();

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    if (session.user.role === "comite") {
      return new ChatbotError("forbidden:chat").toResponse();
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    const entrevista = await getEntrevistaEscribible(entrevistaId);
    if (!entrevista) {
      return new ChatbotError(
        "forbidden:chat",
        "Solo puedes responder tu propia entrevista"
      ).toResponse();
    }

    if (entrevista.estado !== "abierta") {
      return new ChatbotError(
        "bad_request:api",
        "La entrevista ya está completada"
      ).toResponse();
    }

    const seccion = entrevista.secciones.at(entrevista.seccion_actual);
    if (
      !seccionId ||
      !seccion ||
      seccion.id !== seccionId ||
      entrevista.flujo_estado !== "chat"
    ) {
      return new ChatbotError(
        "bad_request:api",
        "Esta sección ya no está activa"
      ).toResponse();
    }

    if (!entrevista.consentimiento_en) {
      const turnosPrevios = await getTranscripcionEntrevista(entrevista.id);
      if (turnosPrevios.length === 0) {
        return new ChatbotError(
          "forbidden:chat",
          "Acepta las indicaciones antes de empezar la entrevista"
        ).toResponse();
      }
    }

    let uiMessages: ChatMessage[] = [];

    if (messages && messages.length > 0) {
      uiMessages = messages as ChatMessage[];
    } else if (message) {
      uiMessages = [message as ChatMessage];
    }

    if (message && !uiMessages.some((existing) => existing.id === message.id)) {
      uiMessages = [...uiMessages, message as ChatMessage];
    }

    // Kick off the write without blocking the model. A failed turn still
    // stamps activity if this lands; a slow write must not delay the first token.
    registrarTurnosEntrevista({
      entrevistaId: entrevista.id,
      turnos: mensajesATurnos(uiMessages, seccion.id),
    }).catch((error: unknown) => {
      console.error("No se pudo guardar la transcripción", error);
    });

    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const isReasoningModel =
      modelConfig?.reasoningEffort !== undefined &&
      modelConfig.reasoningEffort !== "none";
    const seccionesPorId = new Map(
      entrevista.secciones.map((item) => [item.id, item])
    );
    const seccionesPrevias = entrevista.secciones_completadas.map(
      (completada) => ({
        respuestas: completada.respuestas,
        sintesis: completada.sintesis,
        titulo:
          seccionesPorId.get(completada.seccionId)?.titulo ??
          "Sección anterior",
      })
    );
    const haySeccionesPrevias = seccionesPrevias.length > 0;
    // The portal opens the interview with no user turn: the agent speaks
    // first. This opener is never persisted to the transcript.
    const kickoff = haySeccionesPrevias
      ? "Estoy listo para continuar con esta sección. No te presentes de nuevo; haz una transición breve y la primera pregunta."
      : "Estoy listo para comenzar. Preséntate, salúdame y haz la primera pregunta.";
    const mensajesModelo = mensajesTextoParaModelo(uiMessages);
    const modelMessages =
      mensajesModelo.length > 0
        ? await convertToModelMessages(mensajesModelo)
        : [
            {
              content: kickoff,
              role: "user" as const,
            },
          ];

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          activeTools: [...herramientasCierreActivas(uiMessages)],
          instructions: interviewSystemPrompt({
            descripcionSeccion: seccion.descripcion,
            firmaEntrevistado: entrevista.stakeholder_firma,
            nombreEntrevistado: entrevista.stakeholder_nombre,
            preguntas: seccion.preguntas,
            reanudacion: uiMessages.length > 0,
            seccionesPrevias,
            tituloSeccion: seccion.titulo,
          }),
          messages: modelMessages,
          model: getLanguageModel(chatModel),
          onEnd: async ({ steps }) => {
            await registrarTurnosEntrevista({
              entrevistaId: entrevista.id,
              turnos: steps.flatMap((step) => {
                const texto = step.text.trim();
                return texto
                  ? [
                      {
                        at: new Date().toISOString(),
                        id: generateUUID(),
                        rol: "entrevistador" as const,
                        seccionId: seccion.id,
                        texto,
                      },
                    ]
                  : [];
              }),
            });
          },
          providerOptions: {
            ...(modelConfig?.gatewayOrder && {
              gateway: { order: modelConfig.gatewayOrder },
            }),
            ...(modelConfig?.reasoningEffort && {
              openai: { reasoningEffort: modelConfig.reasoningEffort },
            }),
          },
          stopWhen: isStepCount(8),
          telemetry: {
            functionId: "entrevista-guiada",
            isEnabled: isProductionEnvironment,
          },
          tools: {
            completarSeccion: tool({
              description:
                "Cierra la sección activa. Úsala solo cuando el entrevistado confirma que quiere finalizar y los temas guía ya están cubiertos.",
              execute: async ({ hallazgos, respuestas, sintesis }) => {
                const avance = await completarSeccionEntrevista({
                  entrevistaId: entrevista.id,
                  hallazgos,
                  modo: "agente",
                  respuestas,
                  seccionId: seccion.id,
                  sintesis,
                  turnos: mensajesATurnos(uiMessages, seccion.id),
                });
                dataStream.write({
                  data: avance,
                  type: "data-seccion-completada",
                });
                return {
                  message: "Sección guardada. Continúa con el siguiente paso.",
                  ok: true,
                };
              },
              inputSchema: cierreSeccionInputSchema,
            }),
            ofrecerCierreSeccion: tool({
              description:
                "Muestra el botón Finalizar sección cuando los temas guía ya están cubiertos. No cierra la sección; espera a que el entrevistado pulse el botón. Siempre escribe antes un mensaje de texto para la persona.",
              execute: () => ({ ok: true as const }),
              inputSchema: ofertaCierreInputSchema,
            }),
            ofrecerContinuarOGuardar: tool({
              description:
                "Muestra los botones Continuar y Guardar progreso cuando el entrevistado quiere cerrar pero todavía faltan temas. No hagas la siguiente pregunta en este turno.",
              execute: () => ({ ok: true as const }),
              inputSchema: pausaSeccionInputSchema,
            }),
          },
        });

        dataStream.merge(
          toUIMessageStream({
            sendReasoning: isReasoningModel,
            stream: result.stream,
          })
        );
      },
      generateId: generateUUID,
      onError: (error) => {
        console.error("entrevista chat error", error);
        return "Error en la entrevista";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error(error);
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return new ChatbotError("offline:chat").toResponse();
  }
}

export function DELETE() {
  return new Response("Method not needed for interview MVP", { status: 405 });
}
