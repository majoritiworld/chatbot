"use client";

import { useActionState } from "react";
import {
  type ActionState,
  guardarPreguntasEntrevista,
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

export function PreguntasEntrevistaForm({
  stakeholderId,
  proyectoId,
  entrevistaId,
  secciones,
  conduccion,
}: {
  stakeholderId: string;
  proyectoId: string;
  entrevistaId: string;
  secciones: SeccionEntrevista[];
  conduccion: ConduccionEntrevista;
}) {
  const [state, formAction, pending] = useActionState(
    guardarPreguntasEntrevista,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input name="stakeholderId" type="hidden" value={stakeholderId} />
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="entrevistaId" type="hidden" value={entrevistaId} />

      <ConduccionField defaultValue={conduccion} />

      <SeccionesField defaultValue={secciones} />

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar secciones"}
      </Button>
    </form>
  );
}
