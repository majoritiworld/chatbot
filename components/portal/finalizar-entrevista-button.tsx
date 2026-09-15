"use client";

import { type MouseEvent, useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useActiveChat } from "@/hooks/use-active-chat";
import type { SectionCompletedData } from "@/lib/types";

export function FinalizarEntrevistaButton({
  entrevistaId,
  onSeccionCompletada,
  seccionId,
}: {
  entrevistaId: string;
  onSeccionCompletada: (data: SectionCompletedData) => void;
  seccionId: string;
}) {
  const { messages, status, stop } = useActiveChat();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = pending || status === "submitted" || status === "streaming";

  const handleConfirm = useCallback(() => {
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
          flujoEstado?: SectionCompletedData["flujoEstado"];
          ok?: boolean;
          seccionActual?: number;
        } | null;

        if (
          !response.ok ||
          !data?.flujoEstado ||
          typeof data.seccionActual !== "number"
        ) {
          toast.error(data?.error ?? "No se pudo finalizar la sección");
          return;
        }

        setOpen(false);
        onSeccionCompletada({
          flujoEstado: data.flujoEstado,
          seccionActual: data.seccionActual,
          seccionId,
        });
      } catch {
        toast.error("No se pudo finalizar la sección");
      }
    });
  }, [entrevistaId, messages, onSeccionCompletada, seccionId, stop]);
  const handleDialogConfirm = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      handleConfirm();
    },
    [handleConfirm]
  );

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button
          className="text-muted-foreground text-xs hover:text-foreground"
          disabled={busy}
          size="xs"
          type="button"
          variant="outline"
        >
          Finalizar sección
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Terminar esta sección?</AlertDialogTitle>
          <AlertDialogDescription>
            Guardaremos lo conversado y avanzarás al siguiente tema. No podrás
            agregar más respuestas en esta sección.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={handleDialogConfirm}>
            {pending ? "Finalizando…" : "Sí, finalizar sección"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
