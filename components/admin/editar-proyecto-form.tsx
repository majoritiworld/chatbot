"use client";

import { useActionState } from "react";
import {
  type ActionState,
  actualizarProyecto,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { status: "idle" };

export function EditarProyectoForm({
  descripcion,
  proyectoId,
}: {
  descripcion: string | null;
  proyectoId: string;
}) {
  const [state, formAction, pending] = useActionState(
    actualizarProyecto,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="proyecto-descripcion">Descripción</Label>
        <Textarea
          defaultValue={descripcion ?? ""}
          id="proyecto-descripcion"
          name="descripcion"
          placeholder="Qué cubre este proyecto. El cliente lo ve debajo del título en el portal."
        />
      </div>
      <ActionMensaje state={state} />
      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar descripción"}
      </Button>
    </form>
  );
}
