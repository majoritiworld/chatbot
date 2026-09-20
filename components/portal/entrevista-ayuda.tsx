"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PUNTOS = [
  "Las preguntas aparecen en el chat. Responde una a una, por escrito o con Hablar.",
  "Guardar conserva las respuestas ya enviadas de este tema. El texto que todavía no enviaste no se guarda.",
  "Cuando el tema esté cubierto, cierra ese tema para pasar al siguiente. Enviar la entrevista es un paso aparte, al final.",
] as const;

export function EntrevistaAyuda({
  abierta,
  className,
  onOpenChange,
}: {
  abierta?: boolean;
  className?: string;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const [interna, setInterna] = useState(false);
  const controlada = onOpenChange !== undefined;
  const dialogoAbierto = controlada ? Boolean(abierta) : interna;
  const setDialogoAbierto = controlada ? onOpenChange : setInterna;
  const abrir = useCallback(() => {
    setDialogoAbierto(true);
  }, [setDialogoAbierto]);

  return (
    <>
      <Button
        className={
          className ?? "text-muted-foreground text-xs hover:text-foreground"
        }
        onClick={abrir}
        size="xs"
        type="button"
        variant="ghost"
      >
        Cómo funciona
      </Button>
      <Dialog onOpenChange={setDialogoAbierto} open={dialogoAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cómo funciona</DialogTitle>
            <DialogDescription>
              Puedes cerrar esta ayuda y seguir respondiendo.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
            {PUNTOS.map((punto) => (
              <li key={punto}>{punto}</li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm leading-relaxed">
            ¿Necesitas ayuda?{" "}
            <a
              className="text-foreground underline underline-offset-2"
              href="https://wa.me/972587623357"
              rel="noopener noreferrer"
              target="_blank"
            >
              Escríbenos por WhatsApp
            </a>
            .
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
