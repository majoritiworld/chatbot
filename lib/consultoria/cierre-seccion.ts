import { z } from "zod";
import {
  ofertaCierreVigenteEnTurnos,
  type TurnoEntrevista,
  textoHabladoTurno,
} from "@/lib/consultoria/entrevista-contenido";
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
    if (part.type !== "tool-completarSeccion" || !("input" in part)) {
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

function herramientaCierreEjecutada(message: ChatMessage) {
  if (message.role !== "assistant") {
    return false;
  }
  for (const part of message.parts ?? []) {
    if (part.type !== "tool-ofrecerCierreSeccion") {
      continue;
    }
    if (!("state" in part) || part.state !== "output-available") {
      continue;
    }
    if (!("input" in part && "output" in part)) {
      continue;
    }
    const parsed = ofertaCierreInputSchema.safeParse(part.input);
    if (parsed.success && parsed.data.listo) {
      return true;
    }
  }
  return false;
}

export function mensajeOfreceCierreListo(message: ChatMessage) {
  return herramientaCierreEjecutada(message);
}

export function autorizarCierreDirecto({
  forzar,
  seccionActivaId,
  seccionSolicitadaId,
  turnosPersistidos,
}: {
  forzar: boolean;
  seccionActivaId: string | undefined;
  seccionSolicitadaId: string;
  turnosPersistidos: TurnoEntrevista[];
}) {
  if (seccionActivaId !== seccionSolicitadaId) {
    return "Esta sección ya no está activa";
  }
  if (forzar) {
    return null;
  }
  if (!ofertaCierreVigenteEnTurnos(turnosPersistidos, seccionSolicitadaId)) {
    return "Esta sección todavía no está lista para cerrar";
  }
  return null;
}

export function instruccionesSintesisCierre({
  forzar,
  preguntas,
  tituloSeccion,
}: {
  forzar: boolean;
  preguntas: string[];
  tituloSeccion: string;
}) {
  const guia = preguntas
    .map((pregunta, indice) => `${indice + 1}. ${pregunta}`)
    .join("\n");
  const cobertura = forzar
    ? "Cierra con lo que haya. En las preguntas guía no cubiertas indica que no se respondieron."
    : "Los temas guía de esta sección ya están cubiertos. Resume solo lo dicho.";

  return `Prepara el cierre estructurado de la sección "${tituloSeccion}".
${cobertura}
No inventes hechos. Basa síntesis, hallazgos y respuestas solo en la conversación.
Incluye una entrada en respuestas por cada pregunta guía.

Preguntas guía:
${guia}`;
}

export function textoConversacionCierre(turnos: TurnoEntrevista[]) {
  return turnos
    .flatMap((turno) => {
      const texto = textoHabladoTurno(turno.texto);
      if (!texto) {
        return [];
      }
      const rol =
        turno.rol === "entrevistado" ? "Entrevistado" : "Entrevistador";
      return [`${rol}: ${texto}`];
    })
    .join("\n");
}

export function agenteOfrecioCierreListo(messages: ChatMessage[]) {
  const last = messages.at(-1);
  if (!last) {
    return false;
  }
  return mensajeOfreceCierreListo(last);
}

export function ofertaCierreVigenteEnChat(messages: ChatMessage[]) {
  return messages.some((message) => mensajeOfreceCierreListo(message));
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
