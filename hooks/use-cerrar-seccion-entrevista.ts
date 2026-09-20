"use client";

import { useCallback, useRef, useTransition } from "react";
import { toast } from "sonner";
import { useActiveChat } from "@/hooks/use-active-chat";
import { ofertaCierreVigenteEnChat } from "@/lib/consultoria/cierre-seccion";
import { avisoGuardadoRespuestas } from "@/lib/consultoria/entrevista-piloto";
import { MENSAJE_CONTINUAR_SECCION } from "@/lib/consultoria/finalizar-seccion";
import type { SectionCompletedData } from "@/lib/types";

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
    input,
    marcarProgresoGuardado,
    messages,
    onSeccionCompletada,
    seccionId,
    sendMessage,
    setGuardadoEnCurso,
    status,
    stop,
  } = useActiveChat();
  const [pending, startTransition] = useTransition();
  const cerrandoRef = useRef(false);
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

  const cerrarDirecto = useCallback(
    (forzar: boolean) => {
      if (!(entrevistaId && seccionId) || cerrandoRef.current) {
        if (!(entrevistaId && seccionId)) {
          toast.error("No se pudo cerrar la sección");
        }
        return;
      }

      cerrandoRef.current = true;
      startTransition(async () => {
        stop();

        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/entrevista/finalizar`,
            {
              body: JSON.stringify({ entrevistaId, forzar, seccionId }),
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
        } finally {
          cerrandoRef.current = false;
        }
      });
    },
    [entrevistaId, onSeccionCompletada, seccionId, stop]
  );

  const pedirCierre = useCallback(() => {
    cerrarDirecto(false);
  }, [cerrarDirecto]);

  const forzarCierre = useCallback(() => {
    cerrarDirecto(true);
  }, [cerrarDirecto]);

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
    seccionListaParaCerrar: ofertaCierreVigenteEnChat(messages),
  };
}
