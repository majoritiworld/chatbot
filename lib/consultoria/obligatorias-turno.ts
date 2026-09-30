import { MAX_SEGUIMIENTOS } from "@/lib/consultoria/entrevista-contenido";
import { etiquetaCierreTema } from "@/lib/consultoria/entrevista-piloto";
import {
  MENSAJE_CONTINUAR_SECCION,
  MENSAJE_FINALIZAR_SECCION,
  MENSAJE_FORZAR_CIERRE_SECCION,
  MENSAJE_GUARDAR_PROGRESO,
} from "@/lib/consultoria/finalizar-seccion";
import type { ChatMessage } from "@/lib/types";

const MENSAJES_DE_CONTROL = new Set([
  MENSAJE_CONTINUAR_SECCION,
  MENSAJE_FINALIZAR_SECCION,
  MENSAJE_FORZAR_CIERRE_SECCION,
  MENSAJE_GUARDAR_PROGRESO,
  etiquetaCierreTema(false),
  etiquetaCierreTema(true),
]);

function textoMensaje(message: ChatMessage) {
  return (message.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

function esRespuesta(message: ChatMessage) {
  if (message.role !== "user") {
    return false;
  }
  const texto = textoMensaje(message);
  return texto.length > 0 && !MENSAJES_DE_CONTROL.has(texto);
}

/** Optional follow-ups already answered. Obligatory questions are ignored,
 * so two access questions do not spend the cap of two. */
export function seguimientosOpcionalesHechos(messages: ChatMessage[]) {
  let esperaRespuesta = false;
  let hechos = 0;
  for (const message of messages) {
    if (message.role === "assistant") {
      esperaRespuesta = message.metadata?.clase === "seguimiento";
    }
    if (esRespuesta(message) && esperaRespuesta) {
      hechos += 1;
      esperaRespuesta = false;
    }
  }
  return hechos;
}

export function indicesObligatoriasFormuladas(messages: ChatMessage[]) {
  const indices: number[] = [];
  for (const message of messages) {
    if (
      message.role !== "assistant" ||
      message.metadata?.clase !== "obligatoria"
    ) {
      continue;
    }
    const indice = message.metadata.indiceObligatoria;
    if (typeof indice === "number" && !indices.includes(indice)) {
      indices.push(indice);
    }
  }
  return indices;
}

export type DecisionTurnoObligatorio = {
  clase: "principal" | "obligatoria" | "seguimiento" | "cierre";
  forzarOferta: boolean;
  indiceObligatoria?: number;
  preguntarOpcional: boolean;
  seguimientoSiguiente?: string;
  seguimientosHechos: number;
};

/**
 * Decides the next turn when a section has obligatory questions that must
 * not spend the optional follow-up cap. `cubiertas` are indices the person
 * already answered without being asked again. `null` means no optional
 * follow-up applies; `undefined` means that evaluation did not run.
 */
export function resolverTurnoConObligatorias({
  cubiertas,
  messages,
  obligatorias,
  seguimientoOpcional,
  tieneSeguimientos,
}: {
  cubiertas: number[];
  messages: ChatMessage[];
  obligatorias: string[];
  seguimientoOpcional: string | null | undefined;
  tieneSeguimientos: boolean;
}): DecisionTurnoObligatorio {
  const hechos = seguimientosOpcionalesHechos(messages);
  const base = {
    preguntarOpcional: false,
    seguimientosHechos: hechos,
  };
  const respondio = messages.some((message) => esRespuesta(message));
  if (!respondio) {
    return { ...base, clase: "principal", forzarOferta: false };
  }

  const formuladas = new Set(indicesObligatoriasFormuladas(messages));
  const yaCubiertas = new Set(cubiertas);
  const pendiente = obligatorias.findIndex(
    (_pregunta, indice) => !(formuladas.has(indice) || yaCubiertas.has(indice))
  );
  if (pendiente >= 0) {
    return {
      ...base,
      clase: "obligatoria",
      forzarOferta: false,
      indiceObligatoria: pendiente,
      seguimientoSiguiente: obligatorias[pendiente],
    };
  }

  if (!tieneSeguimientos) {
    return { ...base, clase: "cierre", forzarOferta: true };
  }

  const ultimo = messages.findLast((message) => message.role === "user");
  const ultimoEsRespuesta = Boolean(ultimo && esRespuesta(ultimo));
  const tope = ultimoEsRespuesta && hechos >= MAX_SEGUIMIENTOS;
  if (tope || seguimientoOpcional === null) {
    return { ...base, clase: "cierre", forzarOferta: true };
  }
  if (seguimientoOpcional) {
    return {
      ...base,
      clase: "seguimiento",
      forzarOferta: false,
      seguimientoSiguiente: seguimientoOpcional,
    };
  }
  return {
    ...base,
    clase: "cierre",
    forzarOferta: false,
    preguntarOpcional: true,
  };
}
