"use client";

import { Button } from "@/components/ui/button";
import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";

export function EntrevistaPresentacionSeccion({
  indice,
  numeroSecciones,
  onContestar,
  pending,
  seccion,
}: {
  indice: number;
  numeroSecciones: number;
  onContestar: () => void;
  pending: boolean;
  seccion: SeccionEntrevista;
}) {
  const numeroActual = indice + 1;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium text-primary">
            Sección {numeroActual} de {numeroSecciones}
          </span>
          <span className="text-muted-foreground">
            {Math.round((indice / numeroSecciones) * 100)}% completado
          </span>
        </div>
        <progress
          aria-label="Progreso de la entrevista"
          className="h-2 w-full overflow-hidden rounded-full accent-primary"
          max={numeroSecciones}
          value={indice}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="font-semibold text-3xl tracking-tight">
          {seccion.titulo}
        </h1>
        {seccion.descripcion ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {seccion.descripcion}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm leading-relaxed">
            El entrevistador iniciará con una pregunta y profundizará según tus
            respuestas.
          </p>
        )}
      </div>

      <Button
        className="w-fit"
        disabled={pending}
        onClick={onContestar}
        type="button"
      >
        {pending ? "Abriendo…" : "Contestar"}
      </Button>
    </div>
  );
}
