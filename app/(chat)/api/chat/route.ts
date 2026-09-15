import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import { interviewSystemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { isProductionEnvironment } from "@/lib/constants";
import {
  canWriteEntrevista,
  completarSeccionEntrevista,
  getTranscripcionEntrevista,
  registrarTurnosEntrevista,
  resolveEntrevista,
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

    const entrevista = await resolveEntrevista(entrevistaId);
    if (!entrevista) {
      return new ChatbotError(
        "bad_request:api",
        "No hay entrevista abierta para este usuario"
      ).toResponse();
    }

    if (!(await canWriteEntrevista(entrevista))) {
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

    // Written before the model runs so a failed turn still counts as activity.
    await registrarTurnosEntrevista({
      entrevistaId: entrevista.id,
      turnos: mensajesATurnos(uiMessages, seccion.id),
    });

    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    // The portal opens the interview with no user turn: the agent speaks
    // first. This opener is never persisted to the transcript.
    const modelMessages =
      uiMessages.length > 0
        ? await convertToModelMessages(uiMessages)
        : [
            {
              content:
                "Estoy listo para comenzar. Preséntate, salúdame y haz la primera pregunta.",
              role: "user" as const,
            },
          ];

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          activeTools: ["completarSeccion"],
          instructions: interviewSystemPrompt({
            descripcionSeccion: seccion.descripcion,
            firmaEntrevistado: entrevista.stakeholder_firma,
            nombreEntrevistado: entrevista.stakeholder_nombre,
            preguntas: seccion.preguntas,
            reanudacion: uiMessages.length > 0,
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
                "Completa la sección activa cuando sus temas guía estén suficientemente cubiertos.",
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
              inputSchema: z.object({
                hallazgos: z
                  .array(z.string())
                  .describe("Hallazgos concretos de la sección"),
                respuestas: z
                  .array(
                    z.object({
                      pregunta: z.string(),
                      respuesta_texto: z.string(),
                    })
                  )
                  .describe(
                    "Una entrada por cada pregunta guía cubierta, con la síntesis de lo respondido"
                  ),
                sintesis: z
                  .string()
                  .describe("Síntesis fiel y concisa de la sección"),
              }),
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
