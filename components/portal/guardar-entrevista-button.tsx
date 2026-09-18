"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveChat } from "@/hooks/use-active-chat";
import { cn } from "@/lib/utils";

const AVISO_GUARDADO =
  "Progreso guardado. Puedes salir y volver a entrar cuando quieras.";

export function GuardarEntrevistaButton({
  entrevistaId,
  seccionId,
}: {
  entrevistaId: string;
  seccionId: string;
}) {
  const { marcarProgresoGuardado, messages, progresoGuardado, status, stop } =
    useActiveChat();
  const [pending, startTransition] = useTransition();
  const ocupado = pending || status === "submitted" || status === "streaming";
  const noClickeable = ocupado || progresoGuardado;

  const handleSave = useCallback(() => {
    if (noClickeable) {
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
      } catch {
        toast.error("No se pudo guardar el progreso");
      }
    });
  }, [
    entrevistaId,
    marcarProgresoGuardado,
    messages,
    noClickeable,
    seccionId,
    stop,
  ]);

  const boton = (
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
  );

  if (!progresoGuardado) {
    return boton;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{boton}</TooltipTrigger>
      <TooltipContent>{AVISO_GUARDADO}</TooltipContent>
    </Tooltip>
  );
}
