"use client";

import { CheckIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  useCallback,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { marcarTarea } from "@/app/(portal)/portal/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FaseEstado } from "@/lib/consultoria/fase-estado";
import type {
  EntrevistaDelPortal,
  FaseDelPortal,
  TareaDelPortal,
} from "@/lib/consultoria/fases";
import { formatRangoFechas } from "@/lib/consultoria/fechas-rango";
import { cn } from "@/lib/utils";

const PILL_SEMAFORO = {
  completado: "border-emerald-200 bg-emerald-50 text-[#2c6330]",
  en_curso: "border-amber-200 bg-amber-50 text-[#b37f1f]",
  pendiente: "border-red-200 bg-red-50 text-[#7d1616]",
} as const;

const ETIQUETA_PORTAL: Record<FaseEstado, string> = {
  bloqueado: "Pendiente",
  completado: "Completado",
  en_progreso: "En curso",
};

const MARKER_STYLES: Record<FaseEstado, string> = {
  bloqueado: "border-border/70 bg-muted text-muted-foreground",
  completado: "border-border bg-secondary text-secondary-foreground",
  en_progreso: "border-primary bg-primary text-primary-foreground",
};

function Marker({ estado, orden }: { estado: FaseEstado; orden: number }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border font-medium text-sm",
        MARKER_STYLES[estado]
      )}
    >
      {estado === "completado" ? (
        <CheckIcon className="size-4" />
      ) : (
        <span>{orden}</span>
      )}
    </span>
  );
}

function etiquetaEntrevista(estado: string) {
  if (estado === "completada") {
    return "Completada";
  }
  if (estado === "en_curso") {
    return "En curso";
  }
  return "Pendiente";
}

function pillEntrevista(estado: string) {
  if (estado === "completada") {
    return PILL_SEMAFORO.completado;
  }
  if (estado === "en_curso") {
    return PILL_SEMAFORO.en_curso;
  }
  return PILL_SEMAFORO.pendiente;
}

function EntrevistaEstadoBadge({ estado }: { estado: string }) {
  return (
    <Badge className={pillEntrevista(estado)} variant="outline">
      {etiquetaEntrevista(estado)}
    </Badge>
  );
}

function filaChrome({
  completada,
  esPropia,
}: {
  completada: boolean;
  esPropia: boolean;
}) {
  if (!esPropia) {
    return "bg-transparent ring-1 ring-foreground/20";
  }

  return cn(
    "ring-1 ring-foreground/10",
    completada ? "bg-emerald-500/5" : "bg-muted"
  );
}

function ctaEntrevista(estado: string) {
  if (estado === "completada") {
    return "Ver entrevista";
  }
  if (estado === "en_curso") {
    return "Continuar entrevista";
  }
  return "Empezar entrevista";
}

function EntrevistaFila({
  entrevista,
  faseBloqueada,
}: {
  entrevista: EntrevistaDelPortal;
  faseBloqueada: boolean;
}) {
  const completada = entrevista.estado === "completada";
  const puedeAbrir = !faseBloqueada && entrevista.puedeResponder && !completada;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ring-1 ring-foreground/10",
        entrevista.esPropia
          ? completada
            ? "bg-emerald-500/5"
            : "bg-muted"
          : "bg-muted/30"
      )}
      data-tour={entrevista.esPropia && !puedeAbrir ? "entrevista" : undefined}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5 font-medium text-sm",
            !entrevista.esPropia && "text-muted-foreground"
          )}
        >
          <span className="truncate">{entrevista.stakeholderNombre}</span>
          {entrevista.esPropia ? (
            <span className="shrink-0 font-normal text-muted-foreground">
              (tú)
            </span>
          ) : null}
          {entrevista.puedeResponder ? null : (
            <span
              className="inline-flex shrink-0 text-muted-foreground"
              title="No responde esta entrevista"
            >
              <LockIcon aria-hidden="true" className="size-3.5" />
              <span className="sr-only">No responde esta entrevista</span>
            </span>
          )}
        </span>
        <EntrevistaEstadoBadge estado={entrevista.estado} />
      </div>
      {puedeAbrir ? (
        <Button asChild className="rounded-full" size="sm">
          <Link
            className="scroll-mt-24"
            data-tour={entrevista.esPropia ? "entrevista" : undefined}
            href={`/portal/entrevista/${entrevista.id}`}
          >
            {ctaEntrevista(entrevista.estado)}
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function TareaFila({
  disabled,
  tarea,
}: {
  disabled: boolean;
  tarea: TareaDelPortal;
}) {
  const router = useRouter();
  const [completada, setCompletada] = useOptimistic(tarea.completada);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const checkboxId = `tarea-${tarea.id}`;

  const onToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const siguiente = event.target.checked;
      setError(null);
      startTransition(async () => {
        setCompletada(siguiente);
        const resultado = await marcarTarea(tarea.id, siguiente);
        if (!resultado.ok) {
          setError(resultado.message ?? "No se pudo guardar");
          return;
        }
        router.refresh();
      });
    },
    [router, setCompletada, tarea.id]
  );

  return (
    <div className="flex flex-col gap-1">
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5",
          filaChrome({ completada, esPropia: tarea.esPropia }),
          disabled && "cursor-not-allowed opacity-70"
        )}
        htmlFor={checkboxId}
      >
        <input
          checked={completada}
          className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
          disabled={disabled || pending}
          id={checkboxId}
          onChange={onToggle}
          type="checkbox"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              "font-medium text-sm",
              !tarea.esPropia && "text-muted-foreground",
              completada && "text-muted-foreground line-through"
            )}
          >
            {tarea.nombre}
          </span>
          <span className="text-muted-foreground text-sm">
            {tarea.responsableNombre}
          </span>
        </span>
      </label>
      {error ? <p className="px-3 text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function FaseContenido({ fase }: { fase: FaseDelPortal }) {
  const bloqueada = fase.estado === "bloqueado";
  const tieneEntrevistas = fase.entrevistas.length > 0;
  const tieneTareas = fase.tareas.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-medium text-base",
              bloqueada && "text-muted-foreground"
            )}
          >
            {fase.nombre}
          </span>
          <Badge
            className="border-border bg-muted text-muted-foreground"
            variant="outline"
          >
            {ETIQUETA_PORTAL[fase.estado]}
          </Badge>
        </div>
        <span className="shrink-0 pt-0.5 text-right font-jetbrains font-light text-muted-foreground text-xs tracking-wide uppercase">
          {formatRangoFechas(fase.fechaEstimada, fase.fechaCierre)}
        </span>
      </div>
      {fase.descripcion && fase.estado === "en_progreso" ? (
        <p className="w-3/4 text-muted-foreground text-sm">
          {fase.descripcion}
        </p>
      ) : null}

      {tieneEntrevistas ? (
        <div className="mt-3 flex flex-col gap-2">
          <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Entrevistas
          </h3>
          <ul className="flex flex-col gap-2">
            {fase.entrevistas.map((entrevista) => (
              <li key={entrevista.id}>
                <EntrevistaFila
                  entrevista={entrevista}
                  faseBloqueada={bloqueada}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tieneTareas ? (
        <div
          className={cn(
            "flex flex-col gap-2",
            tieneEntrevistas ? "mt-4" : "mt-3"
          )}
        >
          <h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Tareas
          </h3>
          <ul className="flex flex-col gap-2">
            {fase.tareas.map((tarea) => (
              <li key={tarea.id}>
                <TareaFila disabled={bloqueada} tarea={tarea} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function FaseStepper({ fases }: { fases: FaseDelPortal[] }) {
  return (
    <ol className="flex flex-col">
      {fases.map((fase, index) => {
        const bloqueada = fase.estado === "bloqueado";
        const esUltima = index === fases.length - 1;

        return (
          <li className="flex gap-4" key={fase.id}>
            <div className="flex flex-col items-center">
              <Marker estado={fase.estado} orden={fase.orden} />
              {!esUltima && (
                <span
                  aria-hidden="true"
                  className="w-px flex-1 bg-border"
                  data-slot="fase-connector"
                />
              )}
            </div>

            <div
              className={cn(
                "flex flex-1 scroll-mt-24 rounded-xl px-4 py-3 ring-1 ring-foreground/10",
                esUltima ? "pb-3" : "mb-6",
                bloqueada && "bg-muted/30"
              )}
              data-tour={index === 0 ? "fases" : undefined}
            >
              <FaseContenido fase={fase} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
