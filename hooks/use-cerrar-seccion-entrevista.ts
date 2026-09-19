"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { useActiveChat } from "@/hooks/use-active-chat";
import { agenteOfrecioCierreListo } from "@/lib/consultoria/cierre-seccion";
import { avisoGuardadoRespuestas } from "@/lib/consultoria/entrevista-piloto";
import {
  MENSAJE_CONTINUAR_SECCION,
  MENSAJE_FINALIZAR_SECCION,
  MENSAJE_FORZAR_CIERRE_SECCION,
} from "@/lib/consultoria/finalizar-seccion";

export function useCerrarSeccionEntrevista() {
  const {
    entrevistaId,
    input,
    marcarProgresoGuardado,
    messages,
    seccionId,
    sendMessage,
    setGuardadoEnCurso,
    status,
    stop,
  } = useActiveChat();
  const [pending, startTransition] = useTransition();
  const busy = pending || status === "submitted" || status === "streaming";
  const hayBorrador = input.trim().length > 0;

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
      setGuardadoEnCurso(true);

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
          toast.error(
            data?.error ??
              "No se pudo guardar. Revisa la conexión e inténtalo de nuevo."
          );
          return;
        }

        marcarProgresoGuardado();
        toast.success(avisoGuardadoRespuestas(hayBorrador));
      } catch {
        toast.error(
          "No se pudo guardar. Revisa la conexión e inténtalo de nuevo."
        );
      } finally {
        setGuardadoEnCurso(false);
      }
    });
  }, [
    entrevistaId,
    hayBorrador,
    marcarProgresoGuardado,
    messages,
    seccionId,
    setGuardadoEnCurso,
    stop,
  ]);

  return {
    busy,
    continuar,
    forzarCierre,
    guardarProgreso,
    pedirCierre,
    seccionListaParaCerrar: agenteOfrecioCierreListo(messages),
  };
}
