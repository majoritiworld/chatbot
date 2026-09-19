"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useActiveChat } from "@/hooks/use-active-chat";
import { avisoGuardadoRespuestas } from "@/lib/consultoria/entrevista-piloto";
import { cn } from "@/lib/utils";

export function GuardarEntrevistaButton({
  entrevistaId,
  seccionId,
}: {
  entrevistaId: string;
  seccionId: string;
}) {
  const {
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
    noClickeable,
    seccionId,
    setGuardadoEnCurso,
    stop,
  ]);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        aria-disabled={noClickeable}
        className={cn(
          "text-muted-foreground text-xs hover:text-foreground",
          progresoGuardado &&
            "cursor-not-allowed opacity-50 hover:text-muted-foreground"
        )}
        data-tour="entrevista-guardar"
        disabled={ocupado}
        onClick={handleSave}
        size="xs"
        type="button"
        variant="outline"
      >
        {pending ? "Guardando…" : "Guardar"}
      </Button>
      {hayBorrador ? (
        <p className="max-w-48 text-right text-muted-foreground text-xs">
          Hay texto sin enviar
        </p>
      ) : null}
      {progresoGuardado && !hayBorrador ? (
        <p className="max-w-48 text-right text-muted-foreground text-xs">
          Respuestas de este tema guardadas
        </p>
      ) : null}
    </div>
  );
}
