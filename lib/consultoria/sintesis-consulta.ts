import { z } from "zod";

const SILENCIO = "\u200b";
const LARGO_MINIMO_CITA = 8;
const MAXIMO_CITAS = 4;

const COMILLAS = [
  ['"', '"'],
  ["«", "»"],
  ["“", "”"],
  ["‘", "’"],
] as const;

export type TurnoParaCita = {
  rol: "entrevistador" | "entrevistado";
  texto: string;
};

export type SintesisConsulta = {
  citas: string[];
  sintesis: string;
};

export const sintesisConsultaSchema = z.object({
  citas: z
    .array(z.string())
    .describe(
      "De cero a cuatro citas copiadas literalmente de lo que dijo el participante"
    ),
  sintesis: z
    .string()
    .describe(
      "Párrafo breve con hallazgos, experiencias y propuestas del participante"
    ),
});

function textoHablado(texto: string) {
  return texto.replaceAll(SILENCIO, "").trim();
}

export function citaPropuesta(valor: string) {
  const cita = valor.trim();
  for (const [abre, cierra] of COMILLAS) {
    if (
      cita.startsWith(abre) &&
      cita.endsWith(cierra) &&
      cita.length > abre.length + cierra.length
    ) {
      return cita.slice(abre.length, -cierra.length).trim();
    }
  }
  return cita;
}

/**
 * Keeps only proposals that appear, unchanged, inside a participant turn.
 * Interviewer lines and paraphrases are dropped. Fewer than four is valid.
 */
export function citasLiteralesDelParticipante(
  propuestas: string[],
  turnos: TurnoParaCita[]
) {
  const dichos = turnos.flatMap((turno) => {
    if (turno.rol !== "entrevistado") {
      return [];
    }
    const texto = textoHablado(turno.texto);
    return texto ? [texto] : [];
  });
  const aceptadas: string[] = [];
  const vistas = new Set<string>();

  for (const propuesta of propuestas) {
    if (aceptadas.length >= MAXIMO_CITAS) {
      break;
    }
    const cita = citaPropuesta(propuesta);
    if (cita.length < LARGO_MINIMO_CITA || vistas.has(cita)) {
      continue;
    }
    if (!dichos.some((texto) => texto.includes(cita))) {
      continue;
    }
    vistas.add(cita);
    aceptadas.push(cita);
  }

  return aceptadas;
}

export function parseSintesisConsulta(value: unknown): SintesisConsulta | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const { citas, sintesis } = value as Record<string, unknown>;
  if (typeof sintesis !== "string" || sintesis.trim().length === 0) {
    return null;
  }

  return {
    citas: Array.isArray(citas)
      ? citas.flatMap((cita) => (typeof cita === "string" ? [cita] : []))
      : [],
    sintesis: sintesis.trim(),
  };
}

export function sintesisConsultaGuardada(resumen: unknown) {
  if (typeof resumen !== "object" || resumen === null) {
    return null;
  }
  return parseSintesisConsulta((resumen as Record<string, unknown>).consulta);
}

export function instruccionesSintesisConsulta() {
  return `Redacta la síntesis de consulta de una entrevista ya completada.

La síntesis es un párrafo breve con los principales hallazgos, experiencias y propuestas del participante.
Distingue lo que el participante opina de lo que presenta como un hecho que él mismo relata.
No infieras respuestas a temas que no se exploraron. Si un tema no aparece en la conversación, no lo menciones.
No atribuyas al participante frases del entrevistador.

Las citas son como máximo cuatro fragmentos copiados carácter por carácter de turnos del participante (Entrevistado).
No cites al entrevistador. No reformules ni corrijas el texto. Si no hay suficientes frases propias, devuelve menos citas.
Cada cita debe aparecer tal cual en lo que dijo el participante.`;
}
