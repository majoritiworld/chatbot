"use client";

import { useActionState } from "react";
import {
  type ActionState,
  actualizarStakeholder,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { status: "idle" };

export function EditarStakeholderForm({
  proyectoId,
  stakeholderId,
  nombre,
  apellido,
  email,
  firma,
}: {
  proyectoId: string;
  stakeholderId: string;
  nombre: string;
  apellido: string | null;
  email: string;
  firma: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    actualizarStakeholder,
    initialState
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border p-4"
      key={`${stakeholderId}-${nombre}-${apellido ?? ""}-${email}-${firma ?? ""}`}
    >
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="stakeholderId" type="hidden" value={stakeholderId} />

      <div>
        <h2 className="font-medium text-base">Datos de la persona</h2>
        <p className="text-muted-foreground text-sm">
          Nombre, apellido, correo y empresa. Si cambia el correo, entra al
          portal con el nuevo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stakeholder-nombre">Nombre</Label>
          <Input
            autoComplete="given-name"
            defaultValue={nombre}
            id="stakeholder-nombre"
            name="nombre"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stakeholder-apellido">Apellido</Label>
          <Input
            autoComplete="family-name"
            defaultValue={apellido ?? ""}
            id="stakeholder-apellido"
            name="apellido"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stakeholder-email">Correo</Label>
          <Input
            autoComplete="email"
            defaultValue={email}
            id="stakeholder-email"
            name="email"
            required
            type="email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stakeholder-firma">Empresa</Label>
          <Input
            autoComplete="organization"
            defaultValue={firma ?? ""}
            id="stakeholder-firma"
            name="firma"
            placeholder="Opcional"
          />
        </div>
      </div>

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar datos"}
      </Button>
    </form>
  );
}
