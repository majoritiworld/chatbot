"use client";

import { useActionState } from "react";
import {
  type ActionState,
  enviarPlantillaEntrevista,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { RolPortalOpciones } from "@/components/admin/rol-portal-opciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { status: "idle" };

const PLACEHOLDER = `ana@acme.com, Ana Pérez, ACME
bruno@foo.com, Bruno, Díaz, Foo Partners
carla@bar.com`;

export function EnviarPlantillaForm({
  proyectoId,
  plantillaId,
}: {
  proyectoId: string;
  plantillaId: string;
}) {
  const [state, formAction, pending] = useActionState(
    enviarPlantillaEntrevista,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="plantillaId" type="hidden" value={plantillaId} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`destinatarios-${plantillaId}`}>Destinatarios</Label>
        <Textarea
          className="min-h-28 text-sm"
          id={`destinatarios-${plantillaId}`}
          name="destinatarios"
          placeholder={PLACEHOLDER}
          required
        />
        <p className="text-muted-foreground text-xs">
          Una persona por línea: email, nombre apellido, firma. También vale
          email, nombre, apellido, firma. Hasta 50. Si ya está en el proyecto
          con entrevista, se omite.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`firma-default-${plantillaId}`}>
          Firma por defecto
        </Label>
        <Input
          id={`firma-default-${plantillaId}`}
          name="firmaDefault"
          placeholder="Opcional, si una línea no trae firma"
        />
      </div>

      <RolPortalOpciones
        defaultValue="stakeholder"
        descripcion="Vale para todas las personas de este envío."
        idPrefix={`rol-${plantillaId}`}
      />

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Enviando…" : "Enviar entrevista"}
      </Button>
    </form>
  );
}
