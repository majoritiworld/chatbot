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
  entrevistas,
  proyectoId,
  stakeholderId,
}: {
  entrevistas: { id: string; nombre: string; estado: string }[];
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
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="stakeholderId" type="hidden" value={stakeholderId} />

      <div>
        <h2 className="font-medium text-base">Invitar a esta entrevista</h2>
        <p className="text-muted-foreground text-sm">
          Envía el portal: entra con su correo y un código. Si ya tiene cuenta,
          no se crea otra ni se cambia su rol.
        </p>
      </div>

      <label className="flex flex-col gap-2 text-sm">
        Entrevista que recibirá la persona
        <select
          className="w-full rounded-md border bg-background p-2"
          defaultValue=""
          disabled={pending}
          name="entrevistaId"
          required
        >
          <option disabled value="">
            Selecciona una entrevista
          </option>
          {entrevistas.map((entrevista) => (
            <option key={entrevista.id} value={entrevista.id}>
              {entrevista.nombre} · {entrevista.estado} · {entrevista.id}
            </option>
          ))}
        </select>
      </label>

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Enviando…" : "Enviar invitación"}
      </Button>
    </form>
  );
}
