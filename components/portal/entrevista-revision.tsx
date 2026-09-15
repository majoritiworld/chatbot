"use client";

import { Button } from "@/components/ui/button";

export function EntrevistaRevision({
  nombre,
  numeroSecciones,
  onEnviar,
  pending,
}: {
  nombre?: string | null;
  numeroSecciones: number;
  onEnviar: () => void;
  pending: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-3">
        <p className="font-medium text-primary text-sm">Entrevista completa</p>
        <h1 className="font-semibold text-3xl tracking-tight">
          Gracias{nombre?.trim() ? `, ${nombre.trim()}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Terminaste las {numeroSecciones}{" "}
          {numeroSecciones === 1 ? "sección" : "secciones"}. Tus respuestas
          quedaron guardadas y están listas para compartir con el equipo de
          Majoriti.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Al enviarlas, la entrevista quedará cerrada y ya no podrás agregar
          nuevas respuestas.
        </p>
      </div>

      <Button
        className="w-fit"
        disabled={pending}
        onClick={onEnviar}
        type="button"
      >
        {pending ? "Enviando…" : "Enviar entrevista"}
      </Button>
    </div>
  );
}
