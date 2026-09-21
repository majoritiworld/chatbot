"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { useActiveChat } from "@/hooks/use-active-chat";
import { agenteOfrecioCierreListo } from "@/lib/consultoria/cierre-seccion";
import {
  MENSAJE_CONTINUAR_SECCION,
  MENSAJE_FINALIZAR_SECCION,
} from "@/lib/consultoria/finalizar-seccion";
import type { SectionCompletedData } from "@/lib/types";

const AVISO_GUARDADO =
  "Progreso guardado. Puedes salir y volver a entrar cuando quieras.";

function avanceDeCierre(data: unknown): SectionCompletedData | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const avance = data as {
    flujoEstado?: unknown;
    seccionActual?: unknown;
    seccionId?: unknown;
  };
  if (
    (avance.flujoEstado !== "bienvenida" &&
      avance.flujoEstado !== "presentacion" &&
      avance.flujoEstado !== "chat" &&
      avance.flujoEstado !== "revision") ||
    typeof avance.seccionActual !== "number" ||
    typeof avance.seccionId !== "string"
  ) {
    return null;
  }
  return {
    flujoEstado: avance.flujoEstado,
    seccionActual: avance.seccionActual,
    seccionId: avance.seccionId,
  };
}

export function useCerrarSeccionEntrevista() {
  const {
    entrevistaId,
    marcarProgresoGuardado,
    messages,
    onSeccionCompletada,
    seccionId,
    sendMessage,
    status,
    stop,
  } = useActiveChat();
  const [pending, startTransition] = useTransition();
  const busy = pending || status === "submitted" || status === "streaming";

  const enviar = useCallback(
    (texto: string) => {
      sendMessage({
        parts: [{ text: texto, type: "text" }],
        role: "user",
      });
    },
    [sendMessage]
  );

  const pedirCierre = useCallback(() => {
    enviar(MENSAJE_FINALIZAR_SECCION);
  }, [enviar]);

  const forzarCierre = useCallback(() => {
    if (!(entrevistaId && seccionId)) {
      toast.error("No se pudo cerrar la sección");
      return;
    }

    startTransition(async () => {
      stop();

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/entrevista/finalizar`,
          {
            body: JSON.stringify({ entrevistaId, messages, seccionId }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        );
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        const avance = avanceDeCierre(data);

        if (!(response.ok && avance)) {
          toast.error(data?.error ?? "No se pudo cerrar la sección");
          return;
        }

        onSeccionCompletada?.(avance);
      } catch {
        toast.error("No se pudo cerrar la sección");
      }
    });
  }, [entrevistaId, messages, onSeccionCompletada, seccionId, stop]);

  const continuar = useCallback(() => {
    enviar(MENSAJE_CONTINUAR_SECCION);
  }, [enviar]);

  const guardarProgreso = useCallback(() => {
    if (!(entrevistaId && seccionId)) {
      toast.error("No se pudo guardar el progreso");
      return;
    }

    startTransition(async () => {
      stop();

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/entrevista/guardar`,
          {
            body: JSON.stringify({ entrevistaId, messages, seccionId }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        );

        const data = (await response.json().catch(() => null)) as {
          error?: string;
          ok?: boolean;
        } | null;

        if (!response.ok) {
          toast.error(data?.error ?? "No se pudo guardar el progreso");
          return;
        }

        marcarProgresoGuardado();
        toast.success(AVISO_GUARDADO);
      } catch {
        toast.error("No se pudo guardar el progreso");
      }
    });
  }, [entrevistaId, marcarProgresoGuardado, messages, seccionId, stop]);

  return {
    busy,
    continuar,
    forzarCierre,
    guardarProgreso,
    pedirCierre,
    seccionListaParaCerrar: agenteOfrecioCierreListo(messages),
  };
}
