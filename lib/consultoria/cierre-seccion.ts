import { z } from "zod";
import {
  MENSAJE_CONTINUAR_SECCION,
  MENSAJE_FINALIZAR_SECCION,
  MENSAJE_FORZAR_CIERRE_SECCION,
  MENSAJE_GUARDAR_PROGRESO,
} from "@/lib/consultoria/finalizar-seccion";
import type { ChatMessage } from "@/lib/types";

export const cierreSeccionInputSchema = z.object({
  hallazgos: z.array(z.string()).describe("Hallazgos concretos de la sección"),
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
  sintesis: z.string().describe("Síntesis fiel y concisa de la sección"),
});

export type CierreSeccionInput = z.infer<typeof cierreSeccionInputSchema>;

export const ofertaCierreInputSchema = z.object({
  listo: z
    .boolean()
    .describe("true si los temas guía de esta sección ya están cubiertos"),
});

export const pausaSeccionInputSchema = z.object({
  temasPendientes: z
    .array(z.string())
    .describe("Temas guía que todavía faltan cubrir"),
});

function textoUsuario(message: ChatMessage) {
  return (message.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function mensajesTextoParaModelo(
  messages: ChatMessage[]
): ChatMessage[] {
  const limpios: ChatMessage[] = [];
  for (const mensaje of messages) {
    const texto = textoUsuario(mensaje).trim();
    if (!texto) {
      continue;
    }
    limpios.push({
      ...mensaje,
      parts: [{ text: texto, type: "text" }],
    });
  }
  return limpios;
}

export function cierreDeMensaje(
  message: ChatMessage
): CierreSeccionInput | null {
  for (const part of message.parts ?? []) {
    if (part.type !== "tool-ofrecerCierreSeccion" || !("input" in part)) {
      continue;
    }
    const parsed = cierreSeccionInputSchema.safeParse(part.input);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return null;
}

export function cierrePendienteEnChat(
  messages: ChatMessage[]
): CierreSeccionInput | null {
  const last = messages.at(-1);
  if (last?.role !== "assistant") {
    return null;
  }
  return cierreDeMensaje(last);
}

export function agenteOfrecioCierreListo(messages: ChatMessage[]) {
  const last = messages.at(-1);
  if (last?.role !== "assistant") {
    return false;
  }
  for (const part of last.parts ?? []) {
    if (part.type !== "tool-ofrecerCierreSeccion" || !("input" in part)) {
      continue;
    }
    const parsed = ofertaCierreInputSchema.safeParse(part.input);
    if (parsed.success && parsed.data.listo) {
      return true;
    }
  }
  return false;
}

export function ultimoUsuarioPideFinalizar(messages: ChatMessage[]) {
  const mensaje = messages.findLast((item) => item.role === "user");
  if (!mensaje) {
    return false;
  }
  return textoUsuario(mensaje).includes(MENSAJE_FINALIZAR_SECCION);
}

export function ultimoUsuarioFuerzaCierre(messages: ChatMessage[]) {
  const mensaje = messages.findLast((item) => item.role === "user");
  if (!mensaje) {
    return false;
  }
  return textoUsuario(mensaje) === MENSAJE_FORZAR_CIERRE_SECCION;
}

export function herramientasCierreActivas(messages: ChatMessage[]) {
  if (ultimoUsuarioFuerzaCierre(messages)) {
    return ["completarSeccion"] as const;
  }
  if (ultimoUsuarioPideFinalizar(messages)) {
    return ["completarSeccion", "ofrecerContinuarOGuardar"] as const;
  }
  return ["ofrecerCierreSeccion"] as const;
}

export function ultimoUsuarioEligePausa(messages: ChatMessage[]) {
  const mensaje = messages.findLast((item) => item.role === "user");
  if (!mensaje) {
    return false;
  }
  const texto = textoUsuario(mensaje);
  return (
    texto === MENSAJE_CONTINUAR_SECCION || texto === MENSAJE_GUARDAR_PROGRESO
  );
}
