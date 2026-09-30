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

const DIACRITICOS = /[\u0300-\u036f]/g;

/** A reformulation after this many failed clarifications offers to move on. */
const ACLARACIONES_ANTES_DE_PASAR = 1;

export type MotivoCierreSeccion =
  | "suficiente"
  | "limite"
  | "no_sabe"
  | "no_profundizar"
  | "sin_comprension";

export type DecisionAntesDelMenu = {
  clase: "aclaracion" | "cierre" | "consultar";
  forzarOferta: boolean;
  motivoCierre?: MotivoCierreSeccion;
  preguntaAReformular?: string;
  seguimientosHechos: number;
};

function textoMensaje(message: ChatMessage) {
  return (message.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}

export function normalizarRespuesta(texto: string) {
  return texto
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function esControl(texto: string) {
  return MENSAJES_DE_CONTROL.has(texto.trim());
}

/** The person did not understand the question. A short reply about the
 * question itself, not a long answer that happens to include those words. */
export function esIncomprension(texto: string) {
  const normal = normalizarRespuesta(texto);
  if (!normal || esControl(texto)) {
    return false;
  }
  const palabras = normal.split(" ").length;
  const sobreLaPregunta =
    /pregunta|que (quiere|quiso|quisiste) decir|a que (se refiere|te refieres|se referia)|puedes repetir|puede repetir|puede reformular|reformule/.test(
      normal
    );
  const noEntendio =
    /no (entendi|comprendi|comprendo|me quedo claro)|me perdi|no cache/.test(
      normal
    );
  if (!(noEntendio || sobreLaPregunta)) {
    return false;
  }
  if (sobreLaPregunta) {
    return palabras <= 24;
  }
  return palabras <= 14;
}

export function esRenunciaAProfundizar(texto: string) {
  const normal = normalizarRespuesta(texto);
  if (!normal || esControl(texto)) {
    return false;
  }
  return /prefiero (no|pasar|seguir)|no quiero (profundizar|seguir|hablar)|pasemos (al|a)|siguiente tema|dejemos (este|ese) tema|no deseo profundizar|no quiero entrar en/.test(
    normal
  );
}

/** The whole reply is that they don't know. A longer answer is content. */
export function esNoSabe(texto: string) {
  const normal = normalizarRespuesta(texto);
  if (!normal || esControl(texto)) {
    return false;
  }
  return /^(no se|no lo se|no sabria( decir(lo)?)?|no tengo idea|no recuerdo)( la verdad| realmente)?$/.test(
    normal
  );
}

function respuestaDeContenido(message: ChatMessage) {
  if (message.role !== "user") {
    return false;
  }
  const texto = textoMensaje(message);
  return texto.length > 0 && !esControl(texto);
}

/**
 * Optional follow-ups that received a real answer. A clarification of the
 * same question, and the "I didn't understand" reply, do not count.
 */
export function seguimientosSustantivosHechos(messages: ChatMessage[]) {
  let pendiente = false;
  let hechos = 0;
  for (const message of messages) {
    if (message.role === "assistant") {
      if (message.metadata?.clase === "seguimiento") {
        pendiente = true;
      }
      continue;
    }
    if (!respuestaDeContenido(message) || !pendiente) {
      continue;
    }
    if (!esIncomprension(textoMensaje(message))) {
      hechos += 1;
      pendiente = false;
    }
  }
  return hechos;
}

function ultimaPreguntaAgente(messages: ChatMessage[]) {
  for (const message of [...messages].reverse()) {
    if (message.role === "assistant") {
      const texto = textoMensaje(message);
      if (texto.length > 0) {
        return texto;
      }
    }
  }
  return "";
}

function aclaracionesYaHechas(messages: ChatMessage[]) {
  let hechas = 0;
  for (const message of [...messages].reverse()) {
    if (
      message.role === "assistant" &&
      message.metadata?.clase !== "aclaracion"
    ) {
      break;
    }
    if (message.role === "assistant") {
      hechas += 1;
    }
  }
  return hechas;
}

/**
 * Decides a partner-firm turn before the follow-up menu is consulted.
 * `consultar` means a substantive follow-up may still be chosen.
 */
export function decidirAntesDelMenu({
  maxSeguimientos,
  messages,
}: {
  maxSeguimientos: number;
  messages: ChatMessage[];
}): DecisionAntesDelMenu {
  const seguimientosHechos = seguimientosSustantivosHechos(messages);
  const ultimo = messages.findLast((message) => message.role === "user");
  const texto = ultimo ? textoMensaje(ultimo) : "";

  if (esIncomprension(texto)) {
    if (aclaracionesYaHechas(messages) >= ACLARACIONES_ANTES_DE_PASAR) {
      return {
        clase: "cierre",
        forzarOferta: true,
        motivoCierre: "sin_comprension",
        seguimientosHechos,
      };
    }
    return {
      clase: "aclaracion",
      forzarOferta: false,
      preguntaAReformular: ultimaPreguntaAgente(messages),
      seguimientosHechos,
    };
  }

  if (esRenunciaAProfundizar(texto)) {
    return {
      clase: "cierre",
      forzarOferta: true,
      motivoCierre: "no_profundizar",
      seguimientosHechos,
    };
  }

  if (seguimientosHechos >= maxSeguimientos) {
    return {
      clase: "cierre",
      forzarOferta: true,
      motivoCierre: "limite",
      seguimientosHechos,
    };
  }

  return {
    clase: "consultar",
    forzarOferta: false,
    seguimientosHechos,
  };
}
