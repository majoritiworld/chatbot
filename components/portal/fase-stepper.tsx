import { CheckIcon, LockIcon, MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ETIQUETA_ESTADO,
  type FaseEstado,
} from "@/lib/consultoria/fase-estado";
import type {
  EntrevistaDelPortal,
  FaseDelPortal,
} from "@/lib/consultoria/fases";
import { cn } from "@/lib/utils";

const BADGE_VARIANT: Record<
  FaseEstado,
  "default" | "secondary" | "outline"
> = {
  bloqueado: "outline",
  en_progreso: "default",
  completado: "secondary",
};

const MARKER_STYLES: Record<FaseEstado, string> = {
  bloqueado: "border-border/70 bg-muted text-muted-foreground",
  en_progreso: "border-primary bg-primary text-primary-foreground",
  completado: "border-border bg-secondary text-secondary-foreground",
};

function formatFecha(fecha: string | null) {
  if (!fecha) {
    return "Sin fecha estimada";
  }

  const parsed = new Date(`${fecha}T00:00:00`);
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function Marker({ estado, orden }: { estado: FaseEstado; orden: number }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border font-medium text-sm",
        MARKER_STYLES[estado]
      )}
    >
      {estado === "completado" && <CheckIcon className="size-4" />}
      {estado === "bloqueado" && <LockIcon className="size-3.5" />}
      {estado === "en_progreso" && orden}
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

function EntrevistaEstadoBadge({ estado }: { estado: string }) {
  const completada = estado === "completada";
  const enCurso = estado === "en_curso";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm",
        completada && "font-medium text-emerald-600 dark:text-emerald-400",
        enCurso && "font-medium text-primary",
        !(completada || enCurso) && "text-muted-foreground"
      )}
    >
      {completada ? <CheckIcon className="size-3.5" /> : null}
      {etiquetaEntrevista(estado)}
    </span>
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

  const contenido = (
    <div className="flex flex-1 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5 font-medium text-sm",
            !entrevista.puedeResponder && !completada && "text-muted-foreground"
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
        {puedeAbrir ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-primary text-sm">
            <MessageSquareIcon className="size-3.5" />
            {ctaEntrevista(entrevista.estado)}
          </span>
        ) : null}
      </div>
      <EntrevistaEstadoBadge estado={entrevista.estado} />
    </div>
  );

  if (puedeAbrir) {
    return (
      <Link
        className="flex rounded-lg px-3 py-2.5 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
        href={`/portal/entrevista/${entrevista.id}`}
      >
        {contenido}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "flex rounded-lg px-3 py-2.5 ring-1 ring-foreground/10",
        completada ? "bg-emerald-500/5" : "bg-muted/30"
      )}
    >
      {contenido}
    </div>
  );
}

function FaseContenido({ fase }: { fase: FaseDelPortal }) {
  const bloqueada = fase.estado === "bloqueado";
  const tieneEntrevistas = fase.entrevistas.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-medium text-base",
            bloqueada && "text-muted-foreground"
          )}
        >
          {fase.nombre}
        </span>
        <Badge variant={BADGE_VARIANT[fase.estado]}>
          {ETIQUETA_ESTADO[fase.estado]}
        </Badge>
      </div>
      <span className="text-muted-foreground text-sm">
        {formatFecha(fase.fechaEstimada)}
      </span>

      {tieneEntrevistas ? (
        <ul className="mt-3 flex flex-col gap-2">
          {fase.entrevistas.map((entrevista) => (
            <li key={entrevista.id}>
              <EntrevistaFila
                entrevista={entrevista}
                faseBloqueada={bloqueada}
              />
            </li>
          ))}
        </ul>
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
                "flex flex-1 rounded-xl px-4 py-3 ring-1 ring-foreground/10",
                esUltima ? "pb-3" : "mb-6",
                bloqueada && "bg-muted/30"
              )}
            >
              <FaseContenido fase={fase} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
