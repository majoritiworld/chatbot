"use client";

import { useActionState } from "react";
import {
  type ActionState,
  actualizarFase,
  cambiarEstadoFase,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type FaseEstado,
  normalizarEstado,
} from "@/lib/consultoria/fase-estado";
import type { FaseAdmin } from "@/lib/consultoria/stakeholders";

const initialState: ActionState = { status: "idle" };

export function FaseEstadoBotones({
  faseId,
  proyectoId,
  estado,
}: {
  faseId: string;
  proyectoId: string;
  estado: FaseEstado;
}) {
  const [state, formAction, pending] = useActionState(
    cambiarEstadoFase,
    initialState
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input name="proyectoId" type="hidden" value={proyectoId} />
        <input name="faseId" type="hidden" value={faseId} />

        {estado === "en_progreso" ? null : (
          <Button
            disabled={pending}
            name="estado"
            size="sm"
            type="submit"
            value="en_progreso"
            variant="outline"
          >
            {estado === "completado" ? "Reabrir" : "Desbloquear"}
          </Button>
        )}
        {estado === "completado" ? null : (
          <Button
            disabled={pending}
            name="estado"
            size="sm"
            type="submit"
            value="completado"
            variant="outline"
          >
            Completar
          </Button>
        )}
        {estado === "en_progreso" ? (
          <Button
            disabled={pending}
            name="estado"
            size="sm"
            type="submit"
            value="bloqueado"
            variant="ghost"
          >
            Bloquear
          </Button>
        ) : null}
      </form>
      <ActionMensaje className="text-xs" state={state} />
    </div>
  );
}

export function EditarFaseForm({
  fase,
  proyectoId,
}: {
  fase: FaseAdmin;
  proyectoId: string;
}) {
  const [state, formAction, pending] = useActionState(
    actualizarFase,
    initialState
  );
  const estado = normalizarEstado(fase.estado);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <div>
        <h2 className="font-medium text-base">Datos de la fase</h2>
        <p className="text-muted-foreground text-sm">
          Título, descripción y fechas que ve el cliente en el portal.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input name="proyectoId" type="hidden" value={proyectoId} />
        <input name="faseId" type="hidden" value={fase.id} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-nombre">Título</Label>
          <Input
            defaultValue={fase.nombre}
            id="fase-nombre"
            name="nombre"
            required
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fase-fecha-inicio">Fecha de inicio</Label>
            <Input
              defaultValue={fase.fechaEstimada ?? ""}
              id="fase-fecha-inicio"
              name="fechaEstimada"
              type="date"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fase-fecha-cierre">Fecha de cierre</Label>
            <Input
              defaultValue={fase.fechaCierre ?? ""}
              id="fase-fecha-cierre"
              name="fechaCierre"
              type="date"
            />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          El cliente verá el rango, por ejemplo Del 28/09 al 07/10.
        </p>

        <div className="flex w-3/4 flex-col gap-1.5">
          <Label htmlFor="fase-descripcion">Descripción</Label>
          <Textarea
            defaultValue={fase.descripcion ?? ""}
            id="fase-descripcion"
            name="descripcion"
            placeholder="Qué cubre esta fase y qué esperamos del cliente."
          />
        </div>

        <ActionMensaje state={state} />

        <Button className="w-fit" disabled={pending} type="submit">
          {pending ? "Guardando…" : "Guardar fase"}
        </Button>
      </form>

      <div className="border-border border-t pt-4">
        <p className="mb-2 text-muted-foreground text-sm">Estado</p>
        <FaseEstadoBotones
          estado={estado}
          faseId={fase.id}
          proyectoId={proyectoId}
        />
      </div>
    </section>
  );
}
