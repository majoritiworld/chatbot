"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useActiveChat } from "@/hooks/use-active-chat";
import { avisoGuardadoRespuestas } from "@/lib/consultoria/entrevista-piloto";
import { cn } from "@/lib/utils";

export function GuardarEntrevistaButton({
  compacto = false,
  demoFalloGuardar = false,
  entrevistaId,
  seccionId,
}: {
  compacto?: boolean;
  demoFalloGuardar?: boolean;
  entrevistaId: string;
  seccionId: string;
}) {
  const {
    demoAislada,
    input,
    marcarProgresoGuardado,
    messages,
    progresoGuardado,
    setGuardadoEnCurso,
    status,
    stop,
  } = useActiveChat();
  const [pending, startTransition] = useTransition();
  const ocupado = pending || status === "submitted" || status === "streaming";
  const noClickeable = ocupado || progresoGuardado;
  const hayBorrador = input.trim().length > 0;

  const handleSave = useCallback(() => {
    if (noClickeable) {
      return;
    }

    startTransition(async () => {
      if (demoAislada) {
        if (demoFalloGuardar) {
          toast.error(
            "No se pudo guardar. Revisa la conexión e inténtalo de nuevo."
          );
          return;
        }
        marcarProgresoGuardado();
        toast.success(avisoGuardadoRespuestas(hayBorrador));
        return;
      }

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
    demoAislada,
    demoFalloGuardar,
    entrevistaId,
    hayBorrador,
    marcarProgresoGuardado,
    messages,
    noClickeable,
    seccionId,
    setGuardadoEnCurso,
    stop,
  ]);

  return (
    <div className={cn("flex flex-col items-end", !compacto && "gap-1")}>
      <Button
        aria-disabled={noClickeable}
        className={cn(
          "text-muted-foreground hover:text-foreground",
          compacto && "h-11 px-2.5 font-medium text-sm shadow-none",
          progresoGuardado &&
            "cursor-not-allowed opacity-50 hover:text-muted-foreground"
        )}
        data-tour={compacto ? undefined : "entrevista-guardar"}
        disabled={ocupado}
        onClick={handleSave}
        size={compacto ? "sm" : "xs"}
        type="button"
        variant={compacto ? "ghost" : "outline"}
      >
        {pending ? "Guardando…" : "Guardar"}
      </Button>
      {compacto || hayBorrador ? null : progresoGuardado ? (
        <p className="max-w-48 text-right text-muted-foreground text-xs">
          Respuestas de este tema guardadas
        </p>
      ) : null}
    </div>
  );
}
