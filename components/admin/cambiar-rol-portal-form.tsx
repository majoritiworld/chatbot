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
      className="flex flex-col gap-4 rounded-xl border border-border p-4"
      key={`${stakeholderId}-${rol}`}
    >
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="stakeholderId" type="hidden" value={stakeholderId} />

      <div>
        <h2 className="font-medium text-base">Acceso al portal</h2>
        <p className="text-muted-foreground text-sm">
          {rolActual
            ? "Cambia cómo entra esta persona la próxima vez que abra el portal."
            : "Todavía no tiene cuenta. Si ya le enviaste la entrevista, elige el acceso y guarda."}
        </p>
      </div>

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
