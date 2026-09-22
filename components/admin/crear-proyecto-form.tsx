"use client";

import { useActionState } from "react";
import { type ActionState, crearProyecto } from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { status: "idle" };

export function CrearProyectoForm() {
  const [state, formAction, pending] = useActionState(
    crearProyecto,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <h2 className="font-medium text-sm">Nuevo proyecto</h2>
        <p className="text-muted-foreground text-sm">
          Después de crearlo defines sus fases y las entrevistas agénticas.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proyecto-nombre">Proyecto</Label>
          <Input
            id="proyecto-nombre"
            name="nombre"
            placeholder="Diagnóstico comercial"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="proyecto-cliente">Cliente</Label>
          <Input
            id="proyecto-cliente"
            name="cliente"
            placeholder="Acme"
            required
          />
        </div>
      </div>

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Creando…" : "Crear proyecto"}
      </Button>
    </form>
  );
}
