"use client";

import { useCallback, useState, useTransition } from "react";
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

export function FinalizarEntrevistaButton({
  entrevistaId,
  onCompletada,
}: {
  entrevistaId: string;
  onCompletada?: () => void;
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
            body: JSON.stringify({ entrevistaId, messages }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        );

        const data = (await response.json().catch(() => null)) as {
          error?: string;
          ok?: boolean;
        } | null;

        if (!response.ok) {
          toast.error(data?.error ?? "No se pudo finalizar la entrevista");
          return;
        }

        setOpen(false);
        toast.success(
          "Entrevista finalizada. La transcripción ya está con Majoriti."
        );
        onCompletada?.();
      } catch {
        toast.error("No se pudo finalizar la entrevista");
      }
    });
  }, [entrevistaId, messages, onCompletada, stop]);

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
          Finalizar entrevista
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Terminar la entrevista?</AlertDialogTitle>
          <AlertDialogDescription>
            Se enviará la transcripción a Majoriti y marcará la entrevista como
            completada. No podrás seguir respondiendo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
          >
            {pending ? "Finalizando…" : "Sí, finalizar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
