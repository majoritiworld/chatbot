import { isTextUIPart } from "ai";
import { mensajeOfreceCierreListo } from "@/lib/consultoria/cierre-seccion";
import {
  type TurnoEntrevista,
  textoHabladoTurno,
} from "@/lib/consultoria/entrevista-contenido";
import type { ChatMessage } from "@/lib/types";

function parteOfertaCierreReconstruida(
  turnoId: string
): NonNullable<ChatMessage["parts"]>[number] {
  return {
    input: { listo: true },
    output: { ok: true },
    state: "output-available",
    toolCallId: `oferta-cierre-${turnoId}`,
    type: "tool-ofrecerCierreSeccion",
  };
}

/** UI messages carry structured parts; the transcript keeps spoken text and
 * a close-offer flag only when the server persisted an executed tool. */
export function mensajesATurnos(
  mensajes: ChatMessage[],
  seccionId?: string,
  opciones?: { persistirOfertaEjecutada?: boolean }
): TurnoEntrevista[] {
  return mensajes.flatMap((mensaje) => {
    if (mensaje.role !== "user" && mensaje.role !== "assistant") {
      return [];
    }

    const texto = textoHabladoTurno(
      (mensaje.parts ?? [])
        .filter(isTextUIPart)
        .map((part) => part.text)
        .join("\n\n")
    );
    const ofertaCierre = Boolean(
      opciones?.persistirOfertaEjecutada && mensajeOfreceCierreListo(mensaje)
    );

    if (!(texto || ofertaCierre)) {
      return [];
    }

    return [
      {
        at: mensaje.metadata?.createdAt ?? new Date().toISOString(),
        id: mensaje.id,
        ...(ofertaCierre ? { ofertaCierre: true } : {}),
        rol: mensaje.role === "user" ? "entrevistado" : "entrevistador",
        seccionId: seccionId ?? null,
        texto,
      } satisfies TurnoEntrevista,
    ];
  });
}

/**
 * Replays a stored transcript as chat messages so reloading the interview
 * shows the conversation so far instead of restarting the greeting.
 * Only the persisted close-offer flag is restored as a tool part.
 */
export function turnosAMensajes(turnos: TurnoEntrevista[]): ChatMessage[] {
  return turnos.map((turno) => {
    const hablado = textoHabladoTurno(turno.texto);
    const parts: NonNullable<ChatMessage["parts"]> = [];
    if (hablado.length > 0) {
      parts.push({ text: hablado, type: "text" });
    }
    if (turno.ofertaCierre) {
      parts.push(parteOfertaCierreReconstruida(turno.id));
    }
    return {
      id: turno.id,
      metadata: { createdAt: turno.at },
      parts,
      role: turno.rol === "entrevistado" ? "user" : "assistant",
    };
  });
}
