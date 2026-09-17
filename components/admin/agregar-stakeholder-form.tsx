"use client";

import { useActionState } from "react";
import {
  type ActionState,
  crearStakeholder,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { RolPortalOpciones } from "@/components/admin/rol-portal-opciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = { status: "idle" };

export function AgregarStakeholderForm({ proyectoId }: { proyectoId: string }) {
  const [state, formAction, pending] = useActionState(
    crearStakeholder,
    initialState
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border p-4"
      key={state.status === "success" ? (state.message ?? "ok") : "form"}
    >
      <input name="proyectoId" type="hidden" value={proyectoId} />

      <div>
        <h3 className="font-medium text-sm">Agregar persona</h3>
        <p className="text-muted-foreground text-sm">
          Nombre y apellido por separado. Le enviamos el acceso al portal.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nueva-persona-nombre">Nombre</Label>
          <Input
            autoComplete="given-name"
            id="nueva-persona-nombre"
            name="nombre"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nueva-persona-apellido">Apellido</Label>
          <Input
            autoComplete="family-name"
            id="nueva-persona-apellido"
            name="apellido"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nueva-persona-email">Correo</Label>
          <Input
            autoComplete="email"
            id="nueva-persona-email"
            name="email"
            required
            type="email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nueva-persona-firma">Empresa</Label>
          <Input
            autoComplete="organization"
            id="nueva-persona-firma"
            name="firma"
            placeholder="Opcional"
          />
        </div>
      </div>

      <RolPortalOpciones
        defaultValue="stakeholder"
        descripcion="Define qué ve esta persona al entrar."
        idPrefix="nueva-persona-rol"
      />

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Agregando…" : "Agregar persona"}
      </Button>
    </form>
  );
}
