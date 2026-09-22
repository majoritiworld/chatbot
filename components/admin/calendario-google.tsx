"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/(admin)/admin/actions";
import {
  desconectarCalendario,
  importarEventoCalendario,
  importarSerieCalendario,
} from "@/app/(admin)/admin/calendario-actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Button } from "@/components/ui/button";
import type { EventoGoogleListo } from "@/lib/consultoria/google-evento";

const initialState: ActionState = { status: "idle" };

export type ReunionGoogle = EventoGoogleListo & { enPortal: boolean };

function textoCuando(evento: ReunionGoogle) {
  if (!evento.hora) {
    return evento.fecha;
  }
  return `${evento.fecha} · ${evento.hora}`;
}

function AgregarReunion({
  evento,
  proyectoId,
}: {
  evento: ReunionGoogle;
  proyectoId: string;
}) {
  const [state, formAction, pending] = useActionState(
    importarEventoCalendario,
    initialState
  );

  if (evento.enPortal) {
    return <span className="text-muted-foreground text-xs">En el portal</span>;
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input name="googleEventId" type="hidden" value={evento.id} />
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <Button disabled={pending} size="sm" type="submit" variant="outline">
        {pending ? "Agregando…" : "Agregar"}
      </Button>
      <ActionMensaje className="text-xs" state={state} />
    </form>
  );
}

function AgregarSerie({
  cantidad,
  proyectoId,
  serieId,
}: {
  cantidad: number;
  proyectoId: string;
  serieId: string;
}) {
  const [state, formAction, pending] = useActionState(
    importarSerieCalendario,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="serieId" type="hidden" value={serieId} />
      <Button disabled={pending} size="sm" type="submit" variant="ghost">
        {pending ? "Agregando…" : `Agregar las ${cantidad}`}
      </Button>
      <ActionMensaje className="text-xs" state={state} />
    </form>
  );
}

function ListaReuniones({
  eventos,
  proyectoId,
}: {
  eventos: ReunionGoogle[];
  proyectoId: string;
}) {
  const seriesVistas = new Set<string>();

  return (
    <ul className="flex flex-col">
      {eventos.map((evento) => {
        const pendientes = evento.serieId
          ? eventos.filter(
              (item) => item.serieId === evento.serieId && !item.enPortal
            ).length
          : 0;
        const mostrarSerie =
          Boolean(evento.serieId) &&
          pendientes > 1 &&
          !seriesVistas.has(evento.serieId ?? "");
        if (evento.serieId && mostrarSerie) {
          seriesVistas.add(evento.serieId);
        }

        return (
          <li
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-border border-b py-3 last:border-b-0"
            key={evento.id}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium text-sm">{evento.titulo}</span>
              <span className="text-muted-foreground text-xs">
                {textoCuando(evento)}
                {evento.participantes.length > 0
                  ? ` · ${evento.participantes.join(", ")}`
                  : ""}
              </span>
            </div>
            <AgregarReunion evento={evento} proyectoId={proyectoId} />
            {mostrarSerie && evento.serieId ? (
              <AgregarSerie
                cantidad={pendientes}
                proyectoId={proyectoId}
                serieId={evento.serieId}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function CalendarioGoogle({
  aviso,
  conectado,
  configurado,
  email,
  eventos,
  proyectoId,
}: {
  aviso: string | null;
  conectado: boolean;
  configurado: boolean;
  email: string | null;
  eventos: ReunionGoogle[];
  proyectoId: string;
}) {
  const [state, formAction, pending] = useActionState(
    desconectarCalendario,
    initialState
  );

  if (!configurado) {
    return (
      <p className="text-muted-foreground text-sm">
        Para elegir reuniones de Google Calendar agrega GOOGLE_CLIENT_ID y
        GOOGLE_CLIENT_SECRET.
      </p>
    );
  }

  if (!conectado) {
    return (
      <div className="flex flex-col gap-2">
        {aviso ? <p className="text-sm">{aviso}</p> : null}
        <Button asChild className="w-fit" size="sm" variant="outline">
          <a href={`/api/google/calendar/connect?proyecto=${proyectoId}`}>
            Conectar Google Calendar
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Conectado como {email ?? "tu cuenta de Google"}. Elige qué reuniones
          ve este cliente. Cuando Granola termine la nota, se publica en esa
          fecha.
        </p>
        <form action={formAction}>
          <input name="proyectoId" type="hidden" value={proyectoId} />
          <Button disabled={pending} size="sm" type="submit" variant="ghost">
            {pending ? "Desconectando…" : "Desconectar"}
          </Button>
        </form>
      </div>
      <ActionMensaje state={state} />
      {aviso ? <p className="text-sm">{aviso}</p> : null}
      {eventos.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay reuniones en los próximos 60 días.
        </p>
      ) : (
        <ListaReuniones eventos={eventos} proyectoId={proyectoId} />
      )}
    </div>
  );
}
