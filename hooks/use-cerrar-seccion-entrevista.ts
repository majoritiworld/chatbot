"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { useActiveChat } from "@/hooks/use-active-chat";
import { agenteOfrecioCierreListo } from "@/lib/consultoria/cierre-seccion";
import {
  MENSAJE_CONTINUAR_SECCION,
  MENSAJE_FINALIZAR_SECCION,
  MENSAJE_FORZAR_CIERRE_SECCION,
} from "@/lib/consultoria/finalizar-seccion";

const AVISO_GUARDADO =
  "Progreso guardado. Puedes salir y volver a entrar cuando quieras.";

export function useCerrarSeccionEntrevista() {
  const {
    entrevistaId,
    marcarProgresoGuardado,
    messages,
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
    enviar(MENSAJE_FORZAR_CIERRE_SECCION);
  }, [enviar]);

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
