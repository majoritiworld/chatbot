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
  getTranscripcionEntrevista,
  guardarRespuestasEntrevista,
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
    const { message, messages, selectedChatModel, entrevistaId } = requestBody;
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

    if (
      message &&
      !uiMessages.some((existing) => existing.id === message.id)
    ) {
      uiMessages = [...uiMessages, message as ChatMessage];
    }

    // Written before the model runs so a failed turn still counts as activity.
    await registrarTurnosEntrevista({
      entrevistaId: entrevista.id,
      turnos: mensajesATurnos(uiMessages),
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
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          activeTools: ["finalizarEntrevista"],
          instructions: interviewSystemPrompt({
            firmaEntrevistado: entrevista.stakeholder_firma,
            nombreEntrevistado: entrevista.stakeholder_nombre,
            preguntas: entrevista.preguntas,
            reanudacion: uiMessages.length > 0,
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
                        rol: "entrevistador" as const,
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
            finalizarEntrevista: tool({
              description:
                "Cierra la entrevista cuando todos los temas guía estén cubiertos. Genera un resumen estructurado y las respuestas por pregunta.",
              execute: async ({ resumen, respuestas }) => {
                await guardarRespuestasEntrevista({
                  entrevistaId: entrevista.id,
                  resumen: { ...resumen, respuestas },
                  respuestas,
                });
                dataStream.write({
                  data: {
                    entrevistaId: entrevista.id,
                    resumen: resumen.sintesis,
                  },
                  type: "data-entrevista-completada",
                });
                return {
                  ok: true,
                  message:
                    "Entrevista guardada. Gracias por tu tiempo.",
                };
              },
              inputSchema: z.object({
                resumen: z
                  .object({
                    hallazgos: z
                      .array(z.string())
                      .describe(
                        "Hallazgos concretos, uno por punto, en orden de relevancia"
                      ),
                    sintesis: z
                      .string()
                      .describe("Síntesis ejecutiva de la conversación"),
                  })
                  .describe("Resumen estructurado de la entrevista"),
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

export async function DELETE() {
  return new Response("Method not needed for interview MVP", { status: 405 });
}
