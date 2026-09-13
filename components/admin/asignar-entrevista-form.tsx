"use client";

import { useActionState } from "react";
import {
  type ActionState,
  asignarEntrevista,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PlantillaAdmin } from "@/lib/consultoria/plantillas";

const initialState: ActionState = { status: "idle" };

export function AsignarEntrevistaForm({
  stakeholderId,
  proyectoId,
  nombre,
  plantillas,
}: {
  stakeholderId: string;
  proyectoId: string;
  nombre: string;
  plantillas: PlantillaAdmin[];
}) {
  const [state, formAction, pending] = useActionState(
    asignarEntrevista,
    initialState
  );

  if (plantillas.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {nombre} no tiene entrevista. Crea una entrevista agéntica en el
        proyecto para asignársela.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border p-4"
    >
      <input name="stakeholderId" type="hidden" value={stakeholderId} />
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="nombre" type="hidden" value={nombre} />

      <div>
        <h2 className="font-medium text-base">Asignar entrevista</h2>
        <p className="text-muted-foreground text-sm">
          {nombre} tiene acceso al portal pero no tiene entrevista. Elige el
          skill que le toca.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="asignar-plantillaId">Entrevista agéntica</Label>
        <select
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
          id="asignar-plantillaId"
          name="plantillaId"
          required
        >
          {plantillas.map((plantilla) => (
            <option key={plantilla.id} value={plantilla.id}>
              {plantilla.nombre} · fase {plantilla.faseOrden}.{" "}
              {plantilla.faseNombre}
            </option>
          ))}
        </select>
      </div>

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Creando…" : "Asignar entrevista"}
      </Button>
    </form>
  );
}
