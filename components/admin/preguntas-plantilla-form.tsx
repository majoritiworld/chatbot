"use client";

import { useActionState } from "react";
import {
  type ActionState,
  guardarPreguntasPlantilla,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import {
  ConduccionField,
  SeccionesField,
} from "@/components/admin/entrevista-campos";
import { Button } from "@/components/ui/button";
import type {
  ConduccionEntrevista,
  SeccionEntrevista,
} from "@/lib/consultoria/entrevista-contenido";

const initialState: ActionState = { status: "idle" };

export function PreguntasPlantillaForm({
  proyectoId,
  plantillaId,
  secciones,
  conduccion,
}: {
  proyectoId: string;
  plantillaId: string;
  secciones: SeccionEntrevista[];
  conduccion: ConduccionEntrevista;
}) {
  const [state, formAction, pending] = useActionState(
    guardarPreguntasPlantilla,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="plantillaId" type="hidden" value={plantillaId} />

      <ConduccionField defaultValue={conduccion} />

      <SeccionesField defaultValue={secciones} />

      <ActionMensaje state={state} />

      <Button
        className="w-fit"
        disabled={pending}
        type="submit"
        variant="outline"
      >
        {pending ? "Guardando…" : "Guardar guion"}
      </Button>
    </form>
  );
}
