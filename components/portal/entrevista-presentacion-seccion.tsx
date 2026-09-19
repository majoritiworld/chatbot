"use client";

import { EntrevistaPantallaTransicion } from "@/components/portal/entrevista-pantalla-transicion";
import { Button } from "@/components/ui/button";
import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";
import { etiquetaProgresoTema } from "@/lib/consultoria/entrevista-piloto";

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
  return (
    <EntrevistaPantallaTransicion>
      <p className="font-medium text-primary text-sm">
        {etiquetaProgresoTema(indice, numeroSecciones)}
      </p>

      <div className="flex flex-col gap-3">
        <h1 className="font-semibold text-3xl tracking-tight">
          {seccion.titulo}
        </h1>
        <div className="rounded-2xl bg-muted px-4 py-3">
          {seccion.descripcion ? (
            <p className="text-lg leading-relaxed">{seccion.descripcion}</p>
          ) : (
            <p className="text-lg leading-relaxed">
              El entrevistador iniciará con una pregunta y profundizará según
              tus respuestas.
            </p>
          )}
        </div>
      </div>

      <Button
        className="w-fit"
        disabled={pending}
        onClick={onContestar}
        type="button"
      >
        {pending ? "Abriendo…" : "Continuar"}
      </Button>
    </EntrevistaPantallaTransicion>
  );
}
