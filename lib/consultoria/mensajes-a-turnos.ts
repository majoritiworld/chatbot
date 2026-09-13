import { isTextUIPart } from "ai";
import type { TurnoEntrevista } from "@/lib/consultoria/entrevista-contenido";
import type { ChatMessage } from "@/lib/types";

/** UI messages carry structured parts; the transcript keeps only their text. */
export function mensajesATurnos(mensajes: ChatMessage[]): TurnoEntrevista[] {
  return mensajes.flatMap((mensaje) => {
    if (mensaje.role !== "user" && mensaje.role !== "assistant") {
      return [];
    }

    const texto = (mensaje.parts ?? [])
      .filter(isTextUIPart)
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join("\n\n");

    if (!texto) {
      return [];
    }

    return [
      {
        at: mensaje.metadata?.createdAt ?? new Date().toISOString(),
        rol: mensaje.role === "user" ? "entrevistado" : "entrevistador",
        texto,
      } satisfies TurnoEntrevista,
    ];
  });
}

/**
 * Replays a stored transcript as chat messages so reloading the interview
 * shows the conversation so far instead of restarting the greeting.
 */
export function turnosAMensajes(turnos: TurnoEntrevista[]): ChatMessage[] {
  return turnos.map((turno, index) => ({
    id: `turno-${index}`,
    metadata: { createdAt: turno.at },
    parts: [{ text: turno.texto, type: "text" as const }],
    role: turno.rol === "entrevistado" ? "user" : "assistant",
  }));
}
