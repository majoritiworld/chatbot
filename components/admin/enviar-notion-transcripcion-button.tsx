"use client";

import { FileTextIcon } from "lucide-react";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { publicarTranscripcionNotion } from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { urlPaginaNotion } from "@/lib/consultoria/notion-transcripcion-contenido";

export function EnviarNotionTranscripcionButton({
  className,
  completada,
  notionPageId,
  stakeholderId,
}: {
  className?: string;
  completada: boolean;
  notionPageId: string | null;
  stakeholderId: string;
}) {
  const [pending, startTransition] = useTransition();

  const handleClick = useCallback(() => {
    startTransition(async () => {
      const resultado = await publicarTranscripcionNotion(stakeholderId);

      if (resultado.status === "error") {
        toast.error(resultado.message);
        return;
      }

      toast.success(
        resultado.alreadyDone
          ? "La transcripción ya estaba en Notion"
          : "Transcripción enviada a Notion"
      );
    });
  }, [stakeholderId]);

  if (notionPageId) {
    return (
      <Button asChild className={className} size="sm" variant="outline">
        <a
          href={urlPaginaNotion(notionPageId)}
          rel="noopener noreferrer"
          target="_blank"
        >
          <FileTextIcon data-icon="inline-start" />
          Ver en Notion
        </a>
      </Button>
    );
  }

  return (
    <Button
      className={className}
      disabled={!completada || pending}
      onClick={handleClick}
      size="sm"
      title={
        completada
          ? "Crear una página en Notion con la transcripción"
          : "Disponible cuando la entrevista esté completada"
      }
      type="button"
      variant="outline"
    >
      <FileTextIcon data-icon="inline-start" />
      {pending ? "Enviando…" : "Enviar a Notion"}
    </Button>
  );
}
