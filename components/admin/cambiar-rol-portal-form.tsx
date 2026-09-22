"use client";

import { useActionState } from "react";
import {
  type ActionState,
  cambiarRolPortalStakeholder,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { RolPortalOpciones } from "@/components/admin/rol-portal-opciones";
import { Button } from "@/components/ui/button";
import type { RolPortal } from "@/lib/consultoria/roles";

const initialState: ActionState = { status: "idle" };

export function CambiarRolPortalForm({
  proyectoId,
  rolActual,
  stakeholderId,
}: {
  proyectoId: string;
  rolActual: RolPortal | null;
  stakeholderId: string;
}) {
  const [state, formAction, pending] = useActionState(
    cambiarRolPortalStakeholder,
    initialState
  );
  const rol = rolActual ?? "stakeholder";

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      key={`${stakeholderId}-${rol}`}
    >
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="stakeholderId" type="hidden" value={stakeholderId} />

      <RolPortalOpciones
        defaultValue={rol}
        idPrefix={`rol-${stakeholderId}`}
        ocultarLeyenda
      />

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar acceso"}
      </Button>
    </form>
  );
}
