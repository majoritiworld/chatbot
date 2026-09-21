"use client";

import { useActionState } from "react";
import {
  type ActionState,
  invitarEntrevistaAsignada,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { status: "idle" };

export function InvitarEntrevistaForm({
  entrevistaId,
  proyectoId,
  stakeholderId,
}: {
  entrevistaId: string;
  proyectoId: string;
  stakeholderId: string;
}) {
  const [state, formAction, pending] = useActionState(
    invitarEntrevistaAsignada,
    initialState
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border p-4"
    >
      <input name="entrevistaId" type="hidden" value={entrevistaId} />
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="stakeholderId" type="hidden" value={stakeholderId} />

      <div>
        <h2 className="font-medium text-base">Invitar a esta entrevista</h2>
        <p className="text-muted-foreground text-sm">
          Envía el enlace de esta asignación. Si ya tiene cuenta, no se crea
          otra ni se cambia su rol.
        </p>
      </div>

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Enviando…" : "Enviar invitación"}
      </Button>
    </form>
  );
}
