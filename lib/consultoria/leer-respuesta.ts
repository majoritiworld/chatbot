import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  type LecturaRespuesta,
  validarLectura,
} from "@/lib/consultoria/lectura-respuesta";
import {
  type ModeloEntrevista,
  opcionesModeloEntrevista,
} from "@/lib/consultoria/modelos-entrevista";
import type { ChatMessage } from "@/lib/types";

const LIMITE_MS = 20000;

const lecturaSchema = z.object({
  cobertura: z.array(
    z.object({
      evidencia: z.string(),
      indice: z.number().int(),
      estado: z.enum(["cubierto", "parcial", "pendiente"]),
    })
  ),
  foco: z.string(),
  negativa: z.boolean(),
  profundizar: z.boolean(),
  tipo: z.enum([
    "sustantiva",
    "por_completar",
    "dificultad",
    "no_recuerda",
    "no_quiere",
  ]),
});

const INSTRUCCIONES = `Lees la última respuesta de una persona en una entrevista conversacional. No escribes preguntas.

tipo:
- sustantiva: responde a lo que se le preguntó, aunque sea breve o sea un «no». «La buena onda», «no, no hubo ninguno» o «me ayudó a ordenar mis ideas» son sustantivas.
- por_completar: anuncia algo que todavía no cuenta: «sí, hubo uno», «me pasó algo», «tengo un ejemplo», «sí, una vez».
- dificultad: la pregunta le cuesta o no la entiende: «difícil pregunta», «no sé qué decir», «¿a qué te refieres?».
- no_recuerda: no recuerda o no sabe: «no me acuerdo», «no sabría decirte».
- no_quiere: prefiere no responder o no seguir con ese punto.

profundizar (solo si es sustantiva): true si la respuesta nombra algo sin decir en qué consiste, de modo que una sola pregunta concreta sobre eso aportaría lo que falta para el objetivo activo. Ejemplos de true: una etiqueta general («el ambiente», «estuvo bien», «por el networking») o un hecho mencionado sin contar. false si ya dice qué pasó, qué faltó o por qué, aunque sea en pocas palabras («me faltó saber antes a qué se dedicaba», «me aclaró cómo cobrar»), si es un «no» claro o una ausencia. No decidas por la longitud.

foco: copia literal de 1 a 6 palabras de la última respuesta, la parte a la que conviene conectar el siguiente turno (lo que anunció, el motivo, el hecho). Cadena vacía si no hay nada concreto.

negativa: true solo si la persona expresa malestar con sus palabras (frustración, molestia, decepción, incomodidad). Contar que algo faltó o salió corto no basta. No infieras emociones que no expresa.

cobertura: devuelve una entrada para CADA objetivo posterior al activo, con su índice y estado cubierto, parcial o pendiente. Revisa TODO el historial del participante, no solo su última respuesta. Evalúa el significado, no coincidencias de palabras con la guía. Marca cubierto los objetivos posteriores al activo que la persona ya respondió en cualquier momento, aunque sea con otras palabras. Para cada uno copia en evidencia la frase literal suya (al menos tres palabras) que lo responde. No cuentes una mención de pasada, una palabra en común ni lo que dijo el entrevistador. Ante la duda, marca parcial. Para pendiente, evidencia puede ser vacía. Para parcial, copia lo que ya está respondido, sin marcar todo el objetivo cubierto. Si ya explicó qué valoró de participar, con una frase de varias palabras, el objetivo de resumir ese valor en una frase está cubierto y la evidencia es esa frase. Si una línea contiene varias preguntas, márcala cubierta solo cuando las partes relevantes ya están contestadas. Una respuesta puede cubrir un objetivo aunque no use ninguna palabra de la pregunta. Explicar un beneficio concreto ya responde a una síntesis de valor: no exigir otro resumen. Si contó solo lo que falló en la organización pero no cómo fue el resto de la coordinación, ese objetivo sigue parcialmente pendiente.`;

function textoMensaje(message: ChatMessage) {
  return (message.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}

/**
 * Classifies the last reply with a model so the planner can tell a reply to
 * complete, a hard question or a pass from content. `undefined` on failure:
 * the planner then falls back to its heuristics.
 */
export async function leerRespuesta({
  activo,
  messages,
  modelo,
  objetivos,
}: {
  activo: number;
  messages: ChatMessage[];
  modelo?: ModeloEntrevista;
  objetivos: string[];
}): Promise<LecturaRespuesta | undefined> {
  const ultimo = messages.findLast((message) => message.role === "user");
  const texto = ultimo ? textoMensaje(ultimo) : "";
  if (!texto) {
    return;
  }
  const conversacion = messages
    .map((message) => {
      const contenido = textoMensaje(message);
      if (!contenido) {
        return "";
      }
      return `${message.role === "user" ? "Persona" : "Entrevistador"}: ${contenido}`;
    })
    .filter(Boolean)
    .join("\n");
  const dicho = messages
    .filter((message) => message.role === "user")
    .map(textoMensaje)
    .join("\n");
  const lista = objetivos
    .map((objetivo, indice) => `${indice}. ${objetivo}`)
    .join("\n");
  const id = modelo ?? DEFAULT_CHAT_MODEL;

  try {
    const { output } = await generateText({
      abortSignal: AbortSignal.timeout(LIMITE_MS),
      instructions: INSTRUCCIONES,
      maxRetries: 0,
      model: getLanguageModel(id),
      output: Output.object({ schema: lecturaSchema }),
      prompt: `Objetivos de la entrevista:\n${lista}\n\nObjetivo activo: ${activo}\n\nConversación:\n${conversacion}\n\nÚltima respuesta: ${texto}`,
      ...(modelo ? { providerOptions: opcionesModeloEntrevista(modelo) } : {}),
    });
    if (!output) {
      return;
    }
    return validarLectura({
      activo,
      dicho,
      lectura: {
        ...output,
        cubiertos: output.cobertura.filter(
          (item) => item.estado === "cubierto"
        ),
      },
      objetivos: objetivos.length,
      texto,
    });
  } catch {
    // Timeouts and gateway errors fall back to the planner's heuristics.
  }
}
