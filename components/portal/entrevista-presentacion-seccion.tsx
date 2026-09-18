"use client";

import { CheckIcon } from "lucide-react";
import { EntrevistaPantallaTransicion } from "@/components/portal/entrevista-pantalla-transicion";
import { Button } from "@/components/ui/button";
import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";
import { cn } from "@/lib/utils";

function etiquetaPaso({
  actual,
  completada,
  numeroSecciones,
  orden,
}: {
  actual: boolean;
  completada: boolean;
  numeroSecciones: number;
  orden: number;
}) {
  if (completada) {
    return `Sección ${orden} de ${numeroSecciones}, completada`;
  }

  if (actual) {
    return `Sección ${orden} de ${numeroSecciones}, actual`;
  }

  return `Sección ${orden} de ${numeroSecciones}, pendiente`;
}

function EntrevistaProgreso({
  indice,
  numeroSecciones,
}: {
  indice: number;
  numeroSecciones: number;
}) {
  const numeroActual = indice + 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-primary">
          Sección {numeroActual} de {numeroSecciones}
        </span>
        <span className="text-muted-foreground">
          {Math.round((indice / numeroSecciones) * 100)}% completado
        </span>
      </div>
      <ol
        aria-label="Progreso de la entrevista"
        className="flex w-full items-center"
      >
        {Array.from({ length: numeroSecciones }, (_, paso) => {
          const orden = paso + 1;
          const completada = paso < indice;
          const actual = paso === indice;
          const esUltima = orden === numeroSecciones;

          return (
            <li
              aria-current={actual ? "step" : undefined}
              aria-label={etiquetaPaso({
                actual,
                completada,
                numeroSecciones,
                orden,
              })}
              className={cn("flex items-center", !esUltima && "min-w-0 flex-1")}
              key={orden}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border font-medium text-xs",
                  completada &&
                    "border-border bg-secondary text-secondary-foreground",
                  actual && "border-primary bg-primary text-primary-foreground",
                  !(completada || actual) &&
                    "border-border/70 bg-background text-muted-foreground"
                )}
              >
                {completada ? (
                  <CheckIcon className="size-3" />
                ) : (
                  <span>{orden}</span>
                )}
              </span>
              {esUltima ? null : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-2 h-px min-w-2 flex-1",
                    completada ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

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
      <EntrevistaProgreso indice={indice} numeroSecciones={numeroSecciones} />

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
        {pending ? "Abriendo…" : "Contestar"}
      </Button>
    </EntrevistaPantallaTransicion>
  );
}
