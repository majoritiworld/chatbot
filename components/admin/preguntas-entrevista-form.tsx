"use client";

import { useActionState } from "react";
import {
  type ActionState,
  guardarPreguntasEntrevista,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { SeccionesField } from "@/components/admin/entrevista-campos";
import { Button } from "@/components/ui/button";
import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";

const initialState: ActionState = { status: "idle" };

export function PreguntasEntrevistaForm({
  stakeholderId,
  proyectoId,
  entrevistaId,
  secciones,
}: {
  stakeholderId: string;
  proyectoId: string;
  entrevistaId: string;
  secciones: SeccionEntrevista[];
}) {
  const [state, formAction, pending] = useActionState(
    guardarPreguntasEntrevista,
    initialState
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border p-4"
    >
      <input name="stakeholderId" type="hidden" value={stakeholderId} />
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="entrevistaId" type="hidden" value={entrevistaId} />

      <div>
        <h2 className="font-medium text-base">Guion de la entrevista</h2>
        <p className="text-muted-foreground text-sm">
          Los cambios aplican a la próxima respuesta del entrevistador.
        </p>
      </div>

      <SeccionesField defaultValue={secciones} />

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar secciones"}
      </Button>
    </form>
  );
}
