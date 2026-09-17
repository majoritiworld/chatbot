"use client";

import { useActionState } from "react";
import {
  type ActionState,
  crearTarea,
  eliminarTarea,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  PersonaDelProyecto,
  TareaDeFaseAdmin,
} from "@/lib/consultoria/tareas";

const initialState: ActionState = { status: "idle" };

const SELECT_CLASS =
  "h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function etiquetaEstado(estado: string) {
  if (estado === "completada") {
    return "Hecha";
  }
  return "Pendiente";
}

function EliminarTareaForm({
  faseId,
  proyectoId,
  tareaId,
}: {
  faseId: string;
  proyectoId: string;
  tareaId: string;
}) {
  const [state, formAction, pending] = useActionState(
    eliminarTarea,
    initialState
  );

  return (
    <form action={formAction}>
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="faseId" type="hidden" value={faseId} />
      <input name="tareaId" type="hidden" value={tareaId} />
      <Button disabled={pending} size="sm" type="submit" variant="ghost">
        {pending ? "Eliminando…" : "Eliminar"}
      </Button>
      <ActionMensaje className="text-xs" state={state} />
    </form>
  );
}

function CrearTareaForm({
  faseId,
  personas,
  proyectoId,
}: {
  faseId: string;
  personas: PersonaDelProyecto[];
  proyectoId: string;
}) {
  const [state, formAction, pending] = useActionState(crearTarea, initialState);

  if (personas.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Para asignar un responsable, primero agrega personas al proyecto.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 border-border border-t pt-4"
    >
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="faseId" type="hidden" value={faseId} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="tarea-nombre">Nueva tarea</Label>
          <Input
            id="tarea-nombre"
            name="nombre"
            placeholder="Enviar organigrama"
            required
          />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <Label htmlFor="tarea-responsable">Persona responsable</Label>
          <select
            className={SELECT_CLASS}
            defaultValue=""
            id="tarea-responsable"
            name="stakeholderId"
            required
          >
            <option disabled value="">
              Elige a alguien del proyecto
            </option>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.nombreCompleto}
              </option>
            ))}
          </select>
        </div>
        <Button disabled={pending} type="submit" variant="outline">
          {pending ? "Agregando…" : "Agregar tarea"}
        </Button>
      </div>

      <ActionMensaje state={state} />
    </form>
  );
}

export function TareasFase({
  faseId,
  personas,
  proyectoId,
  tareas,
}: {
  faseId: string;
  personas: PersonaDelProyecto[];
  proyectoId: string;
  tareas: TareaDeFaseAdmin[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-medium text-base">Tareas</h2>
        <p className="text-muted-foreground text-sm">
          Checklist que el cliente ve en esta fase, con la persona a cargo.
        </p>
      </div>

      {tareas.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay tareas. Agrégalas abajo.
        </p>
      ) : (
        <ul className="flex flex-col rounded-xl border border-border">
          {tareas.map((tarea) => (
            <li
              className="flex flex-wrap items-center gap-2 border-border border-b px-4 py-3 last:border-b-0"
              key={tarea.id}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium text-sm">{tarea.nombre}</span>
                <span className="text-muted-foreground text-xs">
                  {tarea.stakeholderNombre}
                </span>
              </div>
              <Badge variant="outline">{etiquetaEstado(tarea.estado)}</Badge>
              <EliminarTareaForm
                faseId={faseId}
                proyectoId={proyectoId}
                tareaId={tarea.id}
              />
            </li>
          ))}
        </ul>
      )}

      <CrearTareaForm
        faseId={faseId}
        personas={personas}
        proyectoId={proyectoId}
      />
    </section>
  );
}
