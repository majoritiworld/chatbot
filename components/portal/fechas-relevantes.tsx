"use client";

import { FileTextIcon } from "lucide-react";
import { MinutaMarkdown } from "@/components/minuta-markdown";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  fechaYaPaso,
  formatFechaCalendario,
} from "@/lib/consultoria/fechas-rango";
import type { EventoDelProyecto } from "@/lib/consultoria/fechas-relevantes";
import { cn } from "@/lib/utils";

const FECHAS_VISIBLES = 3;
const TARJETA_EVENTO = "flex flex-col gap-2 rounded-xl bg-muted px-4 py-3";

export function FechasRelevantes({
  eventos,
}: {
  eventos: EventoDelProyecto[];
}) {
  const hayMasFechas = eventos.length > FECHAS_VISIBLES;

  return (
    <aside className="flex scroll-mt-24 flex-col gap-4 self-start lg:sticky lg:top-8">
      <h2 className="font-medium text-base">Calendario</h2>
      {eventos.length === 0 ? (
        <p className="text-muted-foreground text-sm" data-tour="calendario">
          Todavía no hay fechas en el calendario.
        </p>
      ) : (
        <div
          className="overflow-hidden rounded-xl px-4 py-3 ring-1 ring-foreground/10"
          data-tour="calendario"
        >
          <div className="relative bg-transparent">
            {hayMasFechas ? (
              <div aria-hidden className="pointer-events-none invisible">
                <ListaFechas eventos={eventos.slice(0, FECHAS_VISIBLES)} />
                <div className="h-11" />
              </div>
            ) : null}
            <div
              className={
                hayMasFechas
                  ? "absolute inset-0 overflow-y-auto overscroll-contain"
                  : undefined
              }
            >
              <ListaFechas eventos={eventos} interactivo />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function ListaFechas({
  eventos,
  interactivo = false,
}: {
  eventos: EventoDelProyecto[];
  interactivo?: boolean;
}) {
  return (
    <ol className="flex flex-col gap-3">
      {eventos.map((evento) => (
        <EventoCalendario
          evento={evento}
          interactivo={interactivo}
          key={evento.id}
        />
      ))}
    </ol>
  );
}

function CuerpoEvento({
  evento,
  pasado,
}: {
  evento: EventoDelProyecto;
  pasado: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <time
            className="font-jetbrains font-light text-muted-foreground text-xs tracking-wide uppercase"
            dateTime={evento.fecha}
          >
            {formatFechaCalendario(evento.fecha)}
          </time>
          <span
            className={cn(
              "font-medium text-sm",
              pasado && "text-muted-foreground line-through"
            )}
          >
            {evento.titulo}
            {pasado ? <span className="sr-only"> (pasado)</span> : null}
          </span>
        </div>
        {pasado ? (
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-muted-foreground">
            <FileTextIcon aria-hidden className="size-3.5" />
          </span>
        ) : null}
      </div>
      {evento.participantes.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {evento.participantes.map((nombre) => (
            <li key={`${evento.id}-${nombre}`}>
              <Badge className="bg-background" variant="outline">
                {nombre}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function EventoCalendario({
  evento,
  interactivo,
}: {
  evento: EventoDelProyecto;
  interactivo: boolean;
}) {
  const pasado = fechaYaPaso(evento.fecha);

  if (!(interactivo && pasado)) {
    return (
      <li className={TARJETA_EVENTO}>
        <CuerpoEvento evento={evento} pasado={pasado} />
      </li>
    );
  }

  return (
    <li>
      <Dialog>
        <DialogTrigger asChild>
          <button
            aria-haspopup="dialog"
            aria-label={`Ver minuta: ${evento.titulo}`}
            className={cn(
              TARJETA_EVENTO,
              "w-full cursor-pointer text-left ring-foreground/10 transition-shadow hover:ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            title="Ver minuta"
            type="button"
          >
            <CuerpoEvento evento={evento} pasado={pasado} />
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{evento.titulo}</DialogTitle>
            <DialogDescription>
              {formatFechaCalendario(evento.fecha)}
            </DialogDescription>
          </DialogHeader>
          {evento.minuta ? (
            <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
              <MinutaMarkdown markdown={evento.minuta} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Todavía no hay minuta para esta fecha.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </li>
  );
}
