"use client";

import { DownloadIcon } from "lucide-react";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { descargarTranscripcion } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";

export function DescargarTranscripcionButton({
  stakeholderId,
  completada,
  className,
}: {
  stakeholderId: string;
  completada: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  const handleClick = useCallback(() => {
    startTransition(async () => {
      const resultado = await descargarTranscripcion(stakeholderId);

      if (resultado.status === "error") {
        toast.error(resultado.message);
        return;
      }

      const url = URL.createObjectURL(
        new Blob([resultado.content], { type: "text/markdown;charset=utf-8" })
      );
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = resultado.filename;
      enlace.click();
      URL.revokeObjectURL(url);
    });
  }, [stakeholderId]);

  return (
    <Button
      className={className}
      disabled={!completada || pending}
      onClick={handleClick}
      size="sm"
      title={
        completada
          ? "Descargar la transcripción en Markdown"
          : "Disponible cuando la entrevista esté completada"
      }
      type="button"
      variant="outline"
    >
      <DownloadIcon data-icon="inline-start" />
      {pending ? "Generando…" : "Descargar transcripción"}
    </Button>
  );
}
