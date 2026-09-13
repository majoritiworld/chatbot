"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  type ActionState,
  entrarComoStakeholder,
} from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";

const initialState: ActionState = { status: "idle" };

function BotonEnviar() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} size="xs" type="submit" variant="outline">
      {pending ? "Entrando…" : "Ver portal"}
    </Button>
  );
}

export function EntrarComoStakeholderButton({
  stakeholderId,
}: {
  stakeholderId: string;
}) {
  const [state, formAction] = useActionState(
    entrarComoStakeholder,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input name="stakeholderId" type="hidden" value={stakeholderId} />
      <BotonEnviar />
      {state.status === "error" && state.message ? (
        <p className="max-w-48 text-destructive text-xs" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
