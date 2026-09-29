"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

export function RecuperarSintesisButton({
  entrevistaId,
}: {
  entrevistaId: string;
}) {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  const recuperar = useCallback(async () => {
    setPendiente(true);
    setAviso(null);
    try {
      const response = await fetch("/api/entrevista/sintesis", {
        body: JSON.stringify({ entrevistaId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as { estado?: string };
      if (response.ok && data.estado === "lista") {
        router.refresh();
        return;
      }
      setAviso(
        "No se pudo preparar el resumen. La entrevista sigue enviada y puedes intentarlo de nuevo."
      );
    } catch {
      setAviso(
        "No se pudo preparar el resumen. La entrevista sigue enviada y puedes intentarlo de nuevo."
      );
    } finally {
      setPendiente(false);
    }
  }, [entrevistaId, router]);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        disabled={pendiente}
        onClick={recuperar}
        type="button"
        variant="outline"
      >
        {pendiente ? "Preparando resumen…" : "Recuperar resumen"}
      </Button>
      {aviso ? <p className="text-muted-foreground text-sm">{aviso}</p> : null}
    </div>
  );
}
