import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import { partirSeguimiento } from "@/lib/consultoria/entrevista-contenido";

const evaluacionSchema = z.object({
  recomendado: z
    .number()
    .int()
    .describe(
      "Índice del seguimiento más útil para este turno entre los que tienen condicionSeCumple=true y yaRespondido=false, o -1 si ninguno"
    ),
  seguimientos: z.array(
    z.object({
      condicionSeCumple: z
        .boolean()
        .describe("true si la condición se cumple en lo dicho hasta ahora"),
      evidencia: z
        .string()
        .describe(
          "Si la condición depende de algo que la persona afirmó, la frase literal de la persona que lo afirma; si no, cadena vacía"
        ),
      indice: z.number().int(),
      yaRespondido: z
        .boolean()
        .describe(
          "true si la persona ya dio esa información, aunque sea en parte, con otras palabras o de pasada"
        ),
    })
  ),
});

const PRIORITARIO = /^prioritario\b/i;
const CONDICION_AFIRMADA = /\bsi (dice|menciona|considera)\b/i;
const NO_SABE = /\bno (s[eé]|sabr[ií]a|lo s[eé]|tengo claro)\b/i;

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A condition about what the person said needs their own words behind it;
 * "I don't know" never asserts anything. */
function evidenciaValida(evidencia: string, dichoPorLaPersona: string) {
  const cita = normalizar(evidencia);
  return (
    cita.length > 0 && !NO_SABE.test(cita) && dichoPorLaPersona.includes(cita)
  );
}

/**
 * The conversational model tends to walk the menu and re-ask covered topics.
 * A separate structured pass decides which follow-up, if any, still applies;
 * the agent only phrases that one, without its condition. `null` means
 * nothing is left to ask; `undefined` means the evaluation failed.
 */
export async function siguienteSeguimiento({
  conversacion,
  dichoPorLaPersona,
  preguntaPrincipal,
  previas,
  seguimientos,
}: {
  conversacion: string;
  /** Only the participant's own words, to verify quoted evidence. */
  dichoPorLaPersona: string;
  preguntaPrincipal: string;
  previas: string;
  seguimientos: string[];
}): Promise<string | null | undefined> {
  const menu = seguimientos
    .map((item, indice) => {
      const { condicion, pregunta } = partirSeguimiento(item);
      return `${indice}. Condición: ${condicion || "(sin condición)"} | Pregunta: ${pregunta}`;
    })
    .join("\n");

  try {
    const { output } = await generateText({
      instructions: `Evalúas seguimientos opcionales de una entrevista. No escribes preguntas.
Para cada seguimiento del menú, decide con lo que la persona ya dijo (en esta sección y en las anteriores):
- condicionSeCumple: si su condición describe lo que ocurre en la conversación.
- yaRespondido: si la persona ya dio la información que pide la pregunta, aunque sea en parte, con otras palabras o de pasada. Si el entrevistador ya hizo esa pregunta o una equivalente, también es true.
Sé estricto: ante la duda sobre si ya lo dijo, marca yaRespondido=true. No supongas que algo no existe porque no se mencionó.
Una condición que depende de algo que la persona dijo (por ejemplo "Si dice que no utilizan…", "Si menciona…", "Si considera que…") solo se cumple si lo dijo explícitamente. "No sé", "no sabría decir" o no mencionarlo no equivalen a decir que no, y en ese caso esa condición no se cumple.
- evidencia: si la condición depende de algo que la persona afirmó, copia literalmente la frase suya que lo afirma. Si no hay una frase que lo afirme, la condición no se cumple.
- recomendado: el seguimiento más útil ahora entre los aplicables, pensando en lo que la persona acaba de decir; -1 si ninguno aplica.

Pregunta principal de la sección: ${preguntaPrincipal}

Menú:
${menu}`,
      model: getLanguageModel(DEFAULT_CHAT_MODEL),
      output: Output.object({ schema: evaluacionSchema }),
      prompt: `${previas ? `Secciones anteriores:\n${previas}\n\n` : ""}Conversación de esta sección:\n${conversacion}`,
    });
    if (!output) {
      return;
    }
    const dicho = normalizar(dichoPorLaPersona);
    const aplicables = new Set(
      output.seguimientos
        .filter((item) => {
          if (!item.condicionSeCumple || item.yaRespondido) {
            return false;
          }
          const { condicion } = partirSeguimiento(
            seguimientos.at(item.indice) ?? ""
          );
          return (
            !CONDICION_AFIRMADA.test(condicion) ||
            evidenciaValida(item.evidencia, dicho)
          );
        })
        .map((item) => item.indice)
    );
    const prioritario = seguimientos.findIndex(
      (item, indice) =>
        aplicables.has(indice) &&
        PRIORITARIO.test(partirSeguimiento(item).condicion)
    );
    let elegido = aplicables.has(output.recomendado) ? output.recomendado : -1;
    if (prioritario >= 0) {
      elegido = prioritario;
    } else if (elegido < 0 && aplicables.size > 0) {
      elegido = Math.min(...aplicables);
    }
    const seguimiento = seguimientos.at(elegido);
    return elegido >= 0 && seguimiento
      ? partirSeguimiento(seguimiento).pregunta
      : null;
  } catch (error) {
    console.error("No se pudieron evaluar los seguimientos", error);
  }
}

const cubiertasSchema = z.object({
  preguntas: z.array(
    z.object({
      indice: z.number().int(),
      yaRespondido: z
        .boolean()
        .describe(
          "true solo si la persona ya dio esa información, aunque sea con otras palabras"
        ),
    })
  ),
});

/** Indices of obligatory questions already answered. An evaluation failure
 * returns none, so the interview still asks them instead of skipping. */
export async function obligatoriasYaCubiertas({
  conversacion,
  dichoPorLaPersona,
  obligatorias,
  previas,
}: {
  conversacion: string;
  dichoPorLaPersona: string;
  obligatorias: string[];
  previas: string;
}): Promise<number[]> {
  if (obligatorias.length === 0 || dichoPorLaPersona.trim().length === 0) {
    return [];
  }
  const lista = obligatorias
    .map((pregunta, indice) => `${indice}. ${pregunta}`)
    .join("\n");
  try {
    const { output } = await generateText({
      instructions: `Marca cada pregunta obligatoria como yaRespondido solo si la persona ya dio esa información, aunque sea en parte, con otras palabras o de pasada. Si no la dio, yaRespondido es false. No inventes respuestas. Ante la duda, yaRespondido es false.

Preguntas:
${lista}`,
      model: getLanguageModel(DEFAULT_CHAT_MODEL),
      output: Output.object({ schema: cubiertasSchema }),
      prompt: `${previas ? `Secciones anteriores:\n${previas}\n\n` : ""}Conversación:\n${conversacion}`,
    });
    if (!output) {
      return [];
    }
    return output.preguntas
      .filter(
        (item) =>
          item.yaRespondido &&
          item.indice >= 0 &&
          item.indice < obligatorias.length
      )
      .map((item) => item.indice);
  } catch (error) {
    console.error("No se pudieron evaluar las preguntas obligatorias", error);
    return [];
  }
}
