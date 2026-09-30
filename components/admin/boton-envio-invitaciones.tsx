"use client";

import { useActionState } from "react";
import { solicitarEnvioInvitacionesFase } from "@/app/(admin)/admin/invitacion-fase-accion";
import { Button } from "@/components/ui/button";

export function BotonEnvioInvitaciones({ faseId }: { faseId: string }) {
  const [mensaje, accion, pendiente] = useActionState(
    solicitarEnvioInvitacionesFase.bind(null, faseId),
    null
  );

  return (
    <form action={accion} className="flex flex-col gap-2">
      <Button
        className="w-fit"
        disabled={pendiente}
        type="submit"
        variant="outline"
      >
        Enviar invitaciones de esta fase
      </Button>
      {mensaje ? (
        <p className="text-sm" role="status">
          {mensaje}
        </p>
      ) : null}
    </form>
  );
}
