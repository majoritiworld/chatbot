import { isTextUIPart } from "ai";
import { mensajeOfreceCierreListo } from "@/lib/consultoria/cierre-seccion";
import type { TurnoEntrevista } from "@/lib/consultoria/entrevista-contenido";
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
 * a structured close-offer flag for the active section. */
export function mensajesATurnos(
  mensajes: ChatMessage[],
  seccionId?: string
): TurnoEntrevista[] {
  return mensajes.flatMap((mensaje) => {
    if (mensaje.role !== "user" && mensaje.role !== "assistant") {
      return [];
    }

    const texto = (mensaje.parts ?? [])
      .filter(isTextUIPart)
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join("\n\n");
    const ofertaCierre = mensajeOfreceCierreListo(mensaje);

    if (!texto) {
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
 */
export function turnosAMensajes(turnos: TurnoEntrevista[]): ChatMessage[] {
  return turnos.map((turno) => {
    const role = turno.rol === "entrevistado" ? "user" : "assistant";
    return {
      id: turno.id,
      metadata: { createdAt: turno.at },
      parts: [
        { text: turno.texto, type: "text" as const },
        ...(turno.ofertaCierre
          ? [parteOfertaCierreReconstruida(turno.id)]
          : []),
      ],
      role,
    };
  });
}
