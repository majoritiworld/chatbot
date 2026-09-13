"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useActiveChat } from "@/hooks/use-active-chat";

export function GuardarEntrevistaButton({
  entrevistaId,
}: {
  entrevistaId: string;
}) {
  const router = useRouter();
  const { messages, status, stop } = useActiveChat();
  const [pending, startTransition] = useTransition();
  const busy = pending || status === "submitted" || status === "streaming";

  const handleSave = useCallback(() => {
    startTransition(async () => {
      stop();

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/entrevista/guardar`,
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
          toast.error(data?.error ?? "No se pudo guardar el progreso");
          return;
        }

        router.refresh();
        toast.success("Progreso guardado. Puedes continuar cuando quieras.");
      } catch {
        toast.error("No se pudo guardar el progreso");
      }
    });
  }, [entrevistaId, messages, router, stop]);

  return (
    <Button
      className="text-muted-foreground text-xs hover:text-foreground"
      disabled={busy}
      onClick={handleSave}
      size="xs"
      type="button"
      variant="outline"
    >
      {pending ? "Guardando…" : "Guardar"}
    </Button>
  );
}
