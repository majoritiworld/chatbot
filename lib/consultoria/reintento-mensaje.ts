import type { ChatMessage } from "@/lib/types";

export function ultimoMensajeUsuario(
  messages: ChatMessage[]
): ChatMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages.at(index);
    if (message?.role === "user") {
      return message;
    }
  }
  return null;
}

export function payloadReintento(message: ChatMessage) {
  return {
    messageId: message.id,
    parts: message.parts,
    role: "user" as const,
  };
}

export function crearAvisadorError(ventanaMs = 2000) {
  let ultimo = { en: 0, mensaje: "" };
  return (mensaje: string, emitir: (texto: string) => void) => {
    const ahora = Date.now();
    if (mensaje === ultimo.mensaje && ahora - ultimo.en < ventanaMs) {
      return false;
    }
    ultimo = { en: ahora, mensaje };
    emitir(mensaje);
    return true;
  };
}

export const avisarErrorUnaVez = crearAvisadorError();
