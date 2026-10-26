import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  tool,
} from "ai";
import { auth } from "@/app/(auth)/auth";
import {
  entrevistaSimuladaLocal,
  modeloEntrevistaSimulada,
} from "@/lib/ai/entrevista-simulada";
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
  mensajeOfreceCierreListo,
  mensajesTextoParaModelo,
  ofertaCierreInputSchema,
  pausaSeccionInputSchema,
  respuestasEnSeccion,
} from "@/lib/consultoria/cierre-seccion";
import {
  dichoPorLaPersona,
  ejemploDelObjetivo,
  esConversacionContinua,
  promptConversacionContinua,
  textoFijoRecorridoBreve,
  turnoDeClase,
} from "@/lib/consultoria/conversacion-continua";
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
import {
  mensajesATurnos,
  mensajeTurnoFijo,
} from "@/lib/consultoria/mensajes-a-turnos";
import {
  MENSAJE_ACEPTA_INDICACIONES,
  MENSAJE_CUENTA_NO_PUEDE_RESPONDER,
  MENSAJE_ENTREVISTA_COMPLETADA,
  MENSAJE_NO_PUEDE_RESPONDER,
  MENSAJE_SECCION_INACTIVA,
} from "@/lib/consultoria/mensajes-chat";
import {
  modeloPruebaLocalEtm,
  opcionesModeloEntrevista,
} from "@/lib/consultoria/modelos-entrevista";
import {
  herramientasDelTurno,
  pasosTurnoEntrevista,
} from "@/lib/consultoria/pasos-entrevista";
import {
  ErrorGuardadoTranscripcion,
  streamEntrevista,
} from "@/lib/consultoria/stream-entrevista";
import { planificarSeguimientos } from "@/lib/consultoria/turno-entrevista";
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

    if (session?.user?.role === "comite") {
      return new ChatbotError(
        "forbidden:chat",
        MENSAJE_CUENTA_NO_PUEDE_RESPONDER
      ).toResponse();
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    const entrevista = await getEntrevistaEscribible(entrevistaId);
    if (!entrevista) {
      return new ChatbotError(
        "forbidden:chat",
        MENSAJE_NO_PUEDE_RESPONDER
      ).toResponse();
    }

    if (entrevista.estado !== "abierta") {
      return new ChatbotError(
        "bad_request:api",
        MENSAJE_ENTREVISTA_COMPLETADA
      ).toResponse();
    }

    const original = entrevista.secciones.at(entrevista.seccion_actual);
    const modeloLocal = modeloPruebaLocalEtm({
      email: entrevista.stakeholder_email,
      entrevistaId: entrevista.id,
      recorridoBreve: original?.inicioEnChat?.recorridoBreve === true,
    });
    const seccion =
      original && modeloLocal
        ? {
            ...original,
            escucha: { modeloAgente: modeloLocal, modeloLectura: modeloLocal },
          }
        : original;
    if (
      !seccionId ||
      !seccion ||
      seccion.id !== seccionId ||
      entrevista.flujo_estado !== "chat"
    ) {
      return new ChatbotError(
        "bad_request:api",
        MENSAJE_SECCION_INACTIVA
      ).toResponse();
    }

    if (!entrevistaAceptaChat(entrevista.consentimiento_en)) {
      return new ChatbotError(
        "forbidden:chat",
        MENSAJE_ACEPTA_INDICACIONES
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

    const guardarTurno = async (
      turnos: ReturnType<typeof mensajesATurnos>,
      restantes = 3
    ): Promise<void> => {
      try {
        await registrarTurnosEntrevista({
          entrevistaId: entrevista.id,
          estricto: true,
          turnos,
        });
      } catch (error) {
        if (restantes <= 1) {
          throw error;
        }
        await guardarTurno(turnos, restantes - 1);
      }
    };

    // Confirm the user's answer is durable before asking the next question.
    try {
      await guardarTurno(mensajesATurnos(uiMessages, seccion.id));
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
    const continua = esConversacionContinua(seccion);
    const kickoff = textoKickoffEntrevista(haySeccionesPrevias, continua);
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
    const etiquetaCierre = continua
      ? "Enviar entrevista"
      : etiquetaCierreTema(esUltimoTema);
    const modeloAgente = continua ? seccion.escucha?.modeloAgente : undefined;
    const {
      clase,
      escucha,
      formulacionLibre,
      forzarOferta,
      guiaTurno,
      indiceObligatoria,
      motivoCierre,
      ofrecerProfundizacion,
      seguimientoSiguiente,
      seguimientosHechos,
    } = await planificarSeguimientos({
      messages: uiMessages,
      seccion,
      seccionesPrevias,
    });
    const metadataTurno: ChatMessage["metadata"] = {
      ...(clase === "cierre" ? {} : { clase }),
      createdAt: new Date().toISOString(),
      ...(typeof indiceObligatoria === "number" ? { indiceObligatoria } : {}),
    };

    const emprendimientoGenerico = Boolean(
      seccion.inicioEnChat?.propositoEmprendimiento
    );
    const textoFijo = textoFijoRecorridoBreve({
      clase,
      conversar: clase === "obligatoria" && (indiceObligatoria ?? 0) > 0,
      emprendimientoGenerico,
      nombre: entrevista.stakeholder_nombre,
      ofrecerProfundizacion,
      organizacion: emprendimientoGenerico
        ? null
        : entrevista.stakeholder_firma,
      pregunta:
        seguimientoSiguiente ?? seccion.preguntas[indiceObligatoria ?? 0],
      recorridoBreve: seccion.inicioEnChat?.recorridoBreve === true,
    });

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        if (textoFijo) {
          const messageId = generateUUID();
          const textoId = generateUUID();
          const conOferta = clase === "cierre";
          dataStream.write({
            messageId,
            messageMetadata: metadataTurno,
            type: "start",
          });
          dataStream.write({ id: textoId, type: "text-start" });
          dataStream.write({
            delta: textoFijo,
            id: textoId,
            type: "text-delta",
          });
          dataStream.write({ id: textoId, type: "text-end" });
          if (conOferta) {
            const toolCallId = `oferta-cierre-${messageId}`;
            dataStream.write({
              input: { listo: true },
              toolCallId,
              toolName: "ofrecerCierreSeccion",
              type: "tool-input-available",
            });
            dataStream.write({
              output: { ok: true },
              toolCallId,
              type: "tool-output-available",
            });
          }
          try {
            await guardarTurno(
              mensajesATurnos(
                [
                  mensajeTurnoFijo({
                    conOferta,
                    id: messageId,
                    metadata: metadataTurno,
                    texto: textoFijo,
                  }),
                ],
                seccion.id,
                { persistirOfertaEjecutada: true }
              )
            );
          } catch (error) {
            // biome-ignore lint/style/useErrorCause: this subclass forwards options.cause to Error
            throw new ErrorGuardadoTranscripcion({ cause: error });
          }
          if (seccion.inicioEnChat) {
            dataStream.write({
              data: { seccionId: seccion.id },
              transient: true,
              type: "data-turno-guardado",
            });
          }
          if (conOferta) {
            dataStream.write({
              data: { seccionId: seccion.id },
              transient: true,
              type: "data-oferta-cierre-persistida",
            });
          }
          dataStream.write({
            messageMetadata: metadataTurno,
            type: "finish",
          });
          return;
        }

        let avancePendiente: SectionCompletedData | undefined;
        let ofertaPersistida = false;
        const herramientas = {
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
        };
        const result = streamText({
          activeTools: herramientasDelTurno({
            forzarOferta,
            messages: uiMessages,
            ocultarCierre: continua && clase === "seguimiento",
            seguimientoSiguiente,
          }),
          instructions: continua
            ? promptConversacionContinua({
                contextoPrecargado: entrevista.stakeholder_descripcion,
                dicho: dichoPorLaPersona(uiMessages),
                ejemploSeguimiento: ejemploDelObjetivo(
                  seccion,
                  indiceObligatoria
                ),
                emprendimientoGenerico,
                escucha,
                guiaTurno,
                instrucciones: [
                  entrevista.instrucciones_agente,
                  seccion.instrucciones,
                ]
                  .filter((texto) => texto && texto.trim().length > 0)
                  .join("\n"),
                motivoCierre,
                nombre: entrevista.stakeholder_nombre,
                objetivoCompleto: seccion.preguntas[indiceObligatoria ?? 0],
                ofrecerProfundizacion,
                organizacion: emprendimientoGenerico
                  ? null
                  : entrevista.stakeholder_firma,
                preguntaActual:
                  seguimientoSiguiente ??
                  seccion.preguntas[indiceObligatoria ?? 0],
                recorridoBreve: seccion.inicioEnChat?.recorridoBreve === true,
                trato: entrevista.trato,
                turno: turnoDeClase(clase),
              })
            : interviewSystemPrompt({
                cerrarSeccion: forzarOferta,
                descripcionSeccion: seccion.descripcion,
                esUltimoTema,
                etiquetaOrganizacion: seccion.etiquetaOrganizacion,
                firmaEntrevistado: emprendimientoGenerico
                  ? null
                  : entrevista.stakeholder_firma,
                instruccionesEntrevista: entrevista.instrucciones_agente,
                instruccionesSeccion: seccion.instrucciones,
                maxSeguimientos: seccion.maxSeguimientos,
                motivoCierre,
                nombreEntrevistado: entrevista.stakeholder_nombre,
                obligatorias: seccion.obligatorias,
                preguntas: seccion.preguntas,
                preguntaYaHecha: respuestasEnSeccion(uiMessages) > 0,
                reanudacion: uiMessages.length > 0,
                seccionesPrevias,
                seguimientoEsAclaracion: clase === "aclaracion",
                seguimientoEsObligatorio: clase === "obligatoria",
                seguimientoSiguiente,
                seguimientos: seccion.seguimientos,
                seguimientosComoEjemplos: formulacionLibre,
                seguimientosHechos,
                tituloSeccion: seccion.titulo,
                trato: entrevista.trato,
              }),
          messages: modelMessages,
          model: entrevistaSimuladaLocal()
            ? modeloEntrevistaSimulada
            : getLanguageModel(modeloAgente ?? chatModel),
          providerOptions: modeloAgente
            ? opcionesModeloEntrevista(modeloAgente)
            : {
                ...(modelConfig?.gatewayOrder && {
                  gateway: { order: modelConfig.gatewayOrder },
                }),
                ...(modelConfig?.reasoningEffort && {
                  openai: { reasoningEffort: modelConfig.reasoningEffort },
                }),
              },
          ...pasosTurnoEntrevista<typeof herramientas>({
            conSeguimientos: Boolean(
              seccion.seguimientos?.length || seccion.obligatorias?.length
            ),
            forzarOferta,
          }),
          telemetry: {
            functionId: "entrevista-guiada",
            isEnabled: isProductionEnvironment,
          },
          tools: herramientas,
        });

        dataStream.merge(
          streamEntrevista({
            despuesDeGuardar: () => {
              if (seccion.inicioEnChat) {
                dataStream.write({
                  data: { seccionId: seccion.id },
                  transient: true,
                  type: "data-turno-guardado",
                });
              }
              if (ofertaPersistida) {
                dataStream.write({
                  data: { seccionId: seccion.id },
                  transient: true,
                  type: "data-oferta-cierre-persistida",
                });
              }
              if (avancePendiente) {
                dataStream.write({
                  data: avancePendiente,
                  type: "data-seccion-completada",
                });
              }
            },
            guardar: async (responseMessage) => {
              await guardarTurno(
                mensajesATurnos([responseMessage], seccion.id, {
                  persistirOfertaEjecutada: true,
                })
              );
              ofertaPersistida = mensajeOfreceCierreListo(responseMessage);
            },
            metadataTurno,
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
