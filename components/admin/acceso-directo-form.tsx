"use client";

import { useActionState } from "react";
import {
  type ActionState,
  actualizarAccesoDirecto,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { status: "idle" };

export function AccesoDirectoForm({
  accesoDirecto,
  proyectoId,
}: {
  accesoDirecto: boolean;
  proyectoId: string;
}) {
  const [state, formAction, pending] = useActionState(
    actualizarAccesoDirecto,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <label
        className="flex items-start gap-2 text-sm"
        htmlFor="acceso-directo"
      >
        <input
          className="mt-1"
          defaultChecked={accesoDirecto}
          id="acceso-directo"
          name="accesoDirecto"
          type="checkbox"
          value="1"
        />
        <span>Entrar solo con el correo, sin código</span>
      </label>
      <ActionMensaje state={state} />
      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar entrada"}
      </Button>
    </form>
  );
}
