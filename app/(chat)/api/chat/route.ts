import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
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
  entrevistaAceptaChat,
  etiquetaCierreTema,
} from "@/lib/consultoria/entrevista-piloto";
import {
  completarSeccionEntrevista,
  getEntrevistaEscribible,
  registrarTurnosEntrevista,
} from "@/lib/consultoria/entrevistas";
import { textoKickoffEntrevista } from "@/lib/consultoria/kickoff-entrevista";
import { mensajesATurnos } from "@/lib/consultoria/mensajes-a-turnos";
import {
  ErrorGuardadoTranscripcion,
  streamEntrevista,
} from "@/lib/consultoria/stream-entrevista";
import { ChatbotError } from "@/lib/errors";
import type { ChatMessage, SectionCompletedData } from "@/lib/types";
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

    if (!entrevistaAceptaChat(entrevista.consentimiento_en)) {
      return new ChatbotError(
        "forbidden:chat",
        "Acepta las indicaciones antes de empezar la entrevista"
      ).toResponse();
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

    // Confirm the user's answer is durable before asking the next question.
    try {
      await registrarTurnosEntrevista({
        entrevistaId: entrevista.id,
        estricto: true,
        turnos: mensajesATurnos(uiMessages, seccion.id),
      });
    } catch (error) {
      // biome-ignore lint/style/useErrorCause: this subclass forwards options.cause to Error
      throw new ErrorGuardadoTranscripcion({ cause: error });
    }

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
    const kickoff = textoKickoffEntrevista(haySeccionesPrevias);
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

    const esUltimoTema =
      entrevista.seccion_actual >= entrevista.secciones.length - 1;
    const etiquetaCierre = etiquetaCierreTema(esUltimoTema);

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        let avancePendiente: SectionCompletedData | undefined;
        const result = streamText({
          activeTools: [...herramientasCierreActivas(uiMessages)],
          instructions: interviewSystemPrompt({
            descripcionSeccion: seccion.descripcion,
            esUltimoTema,
            firmaEntrevistado: entrevista.stakeholder_firma,
            nombreEntrevistado: entrevista.stakeholder_nombre,
            preguntas: seccion.preguntas,
            reanudacion: uiMessages.length > 0,
            seccionesPrevias,
            tituloSeccion: seccion.titulo,
          }),
          messages: modelMessages,
          model: getLanguageModel(chatModel),
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
                avancePendiente = avance;
                return {
                  message: "Sección guardada. Continúa con el siguiente paso.",
                  ok: true,
                };
              },
              inputSchema: cierreSeccionInputSchema,
            }),
            ofrecerCierreSeccion: tool({
              description: `Llama a esta herramienta estructurada para mostrar el botón "${etiquetaCierre}" cuando los temas guía ya están cubiertos. No cierra la sección. El botón aparece por esta llamada, no por mencionar la herramienta o su nombre en el texto. No menciones otros botones.`,
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
          streamEntrevista({
            despuesDeGuardar: () => {
              if (avancePendiente) {
                dataStream.write({
                  data: avancePendiente,
                  type: "data-seccion-completada",
                });
              }
            },
            guardar: (responseMessage) =>
              registrarTurnosEntrevista({
                entrevistaId: entrevista.id,
                estricto: true,
                turnos: mensajesATurnos([responseMessage], seccion.id, {
                  persistirOfertaEjecutada: true,
                }),
              }),
            sendReasoning: isReasoningModel,
            stream: result.stream,
          })
        );
      },
      generateId: generateUUID,
      onError: (error) => {
        console.error("entrevista chat error", error);
        return error instanceof ErrorGuardadoTranscripcion
          ? error.message
          : "Error en la entrevista. Inténtalo de nuevo.";
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error(error);
    if (error instanceof ErrorGuardadoTranscripcion) {
      return new ChatbotError("save_failed:chat").toResponse();
    }
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return new ChatbotError("offline:chat").toResponse();
  }
}

export function DELETE() {
  return new Response("Method not needed for interview MVP", { status: 405 });
}
