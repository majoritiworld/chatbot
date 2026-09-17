"use client";

import { type ChangeEvent, useActionState, useCallback, useState } from "react";
import {
  type ActionState,
  actualizarEvento,
  crearEvento,
  eliminarEvento,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { MinutaMarkdown } from "@/components/minuta-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatFechaCalendario } from "@/lib/consultoria/fechas-rango";
import type { EventoDelProyecto } from "@/lib/consultoria/fechas-relevantes";
import {
  type FrecuenciaRecurrencia,
  parseFrecuenciaRecurrencia,
} from "@/lib/consultoria/recurrencia";

const initialState: ActionState = { status: "idle" };

const SELECT_CLASS =
  "h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function diaSemana(fecha: string) {
  return new Intl.DateTimeFormat("es", { weekday: "long" }).format(
    new Date(`${fecha}T00:00:00`)
  );
}

function opcionesRecurrencia(
  fecha: string
): Array<{ value: FrecuenciaRecurrencia; label: string }> {
  const semanal = fecha
    ? `Todas las semanas (los ${diaSemana(fecha)})`
    : "Todas las semanas";
  const quincenal = fecha
    ? `Cada 2 semanas (los ${diaSemana(fecha)})`
    : "Cada 2 semanas";
  const mensual = fecha
    ? `Todos los meses (el día ${new Date(`${fecha}T00:00:00`).getDate()})`
    : "Todos los meses";

  return [
    { label: "No se repite", value: "ninguna" },
    { label: "Todos los días", value: "diaria" },
    { label: semanal, value: "semanal" },
    { label: quincenal, value: "quincenal" },
    { label: mensual, value: "mensual" },
  ];
}

function EliminarEventoForm({
  eventoId,
  proyectoId,
}: {
  eventoId: string;
  proyectoId: string;
}) {
  const [state, formAction, pending] = useActionState(
    eliminarEvento,
    initialState
  );

  return (
    <form action={formAction}>
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="eventoId" type="hidden" value={eventoId} />
      <Button disabled={pending} size="sm" type="submit" variant="ghost">
        {pending ? "Eliminando…" : "Eliminar"}
      </Button>
      <ActionMensaje className="text-xs" state={state} />
    </form>
  );
}

function MinutaEditor({
  defaultValue,
  id,
}: {
  defaultValue: string;
  id: string;
}) {
  const [minuta, setMinuta] = useState(defaultValue);

  const onMinutaChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setMinuta(event.target.value);
    },
    []
  );

  const minutaVisible = minuta.trim();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Minuta</Label>
      <Textarea
        className="min-h-32 font-mono text-sm"
        id={id}
        maxLength={20_000}
        name="minuta"
        onChange={onMinutaChange}
        placeholder="Pega aquí las notas en Markdown."
        value={minuta}
      />
      <p className="text-muted-foreground text-xs">
        Puedes pegar Markdown (títulos, listas, negritas). El cliente lo verá
        con formato al abrir esta fecha.
      </p>
      {minutaVisible ? (
        <section
          aria-labelledby={`${id}-preview`}
          className="max-h-64 overflow-y-auto rounded-xl border border-border bg-background px-3 py-3"
        >
          <h3
            className="mb-2 font-medium text-muted-foreground text-xs"
            id={`${id}-preview`}
          >
            Vista previa
          </h3>
          <MinutaMarkdown markdown={minuta} />
        </section>
      ) : null}
    </div>
  );
}

function EditarEventoForm({
  evento,
  onCancelar,
  proyectoId,
}: {
  evento: EventoDelProyecto;
  onCancelar: () => void;
  proyectoId: string;
}) {
  const [state, formAction, pending] = useActionState(
    actualizarEvento,
    initialState
  );
  const tituloId = `evento-titulo-${evento.id}`;
  const fechaId = `evento-fecha-${evento.id}`;
  const participantesId = `evento-participantes-${evento.id}`;
  const minutaId = `evento-minuta-${evento.id}`;

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="eventoId" type="hidden" value={evento.id} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor={tituloId}>Nombre</Label>
          <Input
            defaultValue={evento.titulo}
            id={tituloId}
            name="titulo"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fechaId}>Fecha</Label>
          <Input
            defaultValue={evento.fecha}
            id={fechaId}
            name="fecha"
            required
            type="date"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={participantesId}>Participantes</Label>
        <Input
          defaultValue={evento.participantes.join(", ")}
          id={participantesId}
          name="participantes"
          placeholder="Ana Pérez, Luis Gómez"
        />
        <p className="text-muted-foreground text-xs">
          Nombres separados por coma.
        </p>
      </div>

      <MinutaEditor defaultValue={evento.minuta ?? ""} id={minutaId} />

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pending} size="sm" type="submit">
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button
          disabled={pending}
          onClick={onCancelar}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancelar
        </Button>
      </div>

      <ActionMensaje className="text-xs" state={state} />
    </form>
  );
}

function EventoFila({
  evento,
  proyectoId,
}: {
  evento: EventoDelProyecto;
  proyectoId: string;
}) {
  const [editando, setEditando] = useState(false);

  const abrirEdicion = useCallback(() => {
    setEditando(true);
  }, []);

  const cerrarEdicion = useCallback(() => {
    setEditando(false);
  }, []);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-border border-b py-3 last:border-b-0">
      {editando ? (
        <EditarEventoForm
          evento={evento}
          onCancelar={cerrarEdicion}
          proyectoId={proyectoId}
        />
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium text-sm">{evento.titulo}</span>
            <span className="text-muted-foreground text-xs">
              {formatFechaCalendario(evento.fecha)}
              {evento.participantes.length > 0
                ? ` · ${evento.participantes.join(", ")}`
                : ""}
              {evento.minuta ? " · Minuta" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={abrirEdicion}
              size="sm"
              type="button"
              variant="ghost"
            >
              Editar
            </Button>
            <EliminarEventoForm eventoId={evento.id} proyectoId={proyectoId} />
          </div>
        </>
      )}
    </li>
  );
}

function CrearEventoForm({ proyectoId }: { proyectoId: string }) {
  const [state, formAction, pending] = useActionState(
    crearEvento,
    initialState
  );
  const [fecha, setFecha] = useState("");
  const [recurrencia, setRecurrencia] =
    useState<FrecuenciaRecurrencia>("ninguna");

  const onFechaChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setFecha(event.target.value);
  }, []);

  const onRecurrenciaChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setRecurrencia(parseFrecuenciaRecurrencia(event.target.value));
    },
    []
  );

  const seRepite = recurrencia !== "ninguna";

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 border-border border-t pt-4"
    >
      <input name="proyectoId" type="hidden" value={proyectoId} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="evento-titulo">Nuevo evento</Label>
          <Input
            id="evento-titulo"
            name="titulo"
            placeholder="Kickoff con el comité"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="evento-fecha">Fecha</Label>
          <Input
            id="evento-fecha"
            name="fecha"
            onChange={onFechaChange}
            required
            type="date"
            value={fecha}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="evento-recurrencia">Repetición</Label>
          <select
            className={SELECT_CLASS}
            id="evento-recurrencia"
            name="recurrencia"
            onChange={onRecurrenciaChange}
            value={recurrencia}
          >
            {opcionesRecurrencia(fecha).map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            ))}
          </select>
        </div>
        {seRepite ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="evento-fecha-hasta">Se repite hasta</Label>
            <Input
              id="evento-fecha-hasta"
              min={fecha || undefined}
              name="fechaHasta"
              required
              type="date"
            />
          </div>
        ) : null}
      </div>

      {seRepite ? (
        <p className="text-muted-foreground text-xs">
          Se crea una fecha por cada repetición, incluida la inicial, hasta el
          día indicado.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="evento-participantes">Participantes</Label>
        <Input
          id="evento-participantes"
          name="participantes"
          placeholder="Ana Pérez, Luis Gómez"
        />
        <p className="text-muted-foreground text-xs">
          Nombres separados por coma.
        </p>
      </div>

      <Button
        className="w-fit"
        disabled={pending}
        type="submit"
        variant="outline"
      >
        {pending ? "Agregando…" : "Agregar fecha"}
      </Button>

      <ActionMensaje state={state} />
    </form>
  );
}

export function EventosProyecto({
  proyectoId,
  eventos,
}: {
  proyectoId: string;
  eventos: EventoDelProyecto[];
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <div>
        <h2 className="font-medium text-base">Fechas relevantes</h2>
        <p className="text-muted-foreground text-sm">
          Reuniones y otros hitos que el cliente ve en el calendario. Las fechas
          de cada fase se editan al abrirla y no aparecen en el calendario.
        </p>
      </div>

      {eventos.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay reuniones ni eventos extra.
        </p>
      ) : (
        <ul className="flex flex-col">
          {eventos.map((evento) => (
            <EventoFila
              evento={evento}
              key={evento.id}
              proyectoId={proyectoId}
            />
          ))}
        </ul>
      )}

      <CrearEventoForm proyectoId={proyectoId} />
    </section>
  );
}
