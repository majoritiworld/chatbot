"use client";

import { useActionState } from "react";
import {
  type ActionState,
  crearPlantillaEntrevista,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import {
  FaseSelect,
  SeccionesField,
} from "@/components/admin/entrevista-campos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FaseAdmin } from "@/lib/consultoria/stakeholders";

const initialState: ActionState = { status: "idle" };

export function CrearPlantillaForm({
  proyectoId,
  fases,
  faseId,
}: {
  proyectoId: string;
  fases: FaseAdmin[];
  faseId?: string;
}) {
  const [state, formAction, pending] = useActionState(
    crearPlantillaEntrevista,
    initialState
  );
  const faseFija = faseId ?? "";

  if (fases.length === 0 && !faseFija) {
    return (
      <div className="flex flex-col gap-1 rounded-xl border border-border p-4">
        <h2 className="font-medium text-base">Crear entrevista agéntica</h2>
        <p className="text-muted-foreground text-sm">
          Crea una fase primero: el skill se cuelga de una fase, y sin eso no
          hay dónde enviarla.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input name="proyectoId" type="hidden" value={proyectoId} />
      {faseFija ? <input name="faseId" type="hidden" value={faseFija} /> : null}

      <p className="text-muted-foreground text-sm">
        El guion es el mismo para todos. Al enviarla, el agente se refiere a
        cada firma socia por su nombre.
      </p>

      <div
        className={
          faseFija ? "flex flex-col gap-1.5" : "grid gap-3 sm:grid-cols-2"
        }
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="plantilla-nombre">Nombre</Label>
          <Input
            id="plantilla-nombre"
            name="nombre"
            placeholder="Diagnóstico de stakeholders"
            required
          />
        </div>
        {faseFija ? null : <FaseSelect fases={fases} id="plantilla-faseId" />}
      </div>

      <SeccionesField />

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Guardando…" : "Crear entrevista agéntica"}
      </Button>
    </form>
  );
}
