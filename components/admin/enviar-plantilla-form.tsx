"use client";

import { useActionState } from "react";
import {
  type ActionState,
  enviarPlantillaEntrevista,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { status: "idle" };

const PLACEHOLDER = `ana@acme.com, Ana Pérez, ACME
bruno@foo.com, Bruno Díaz, Foo Partners
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
          Una persona por línea: email, nombre, firma. Hasta 50. Si ya está en
          el proyecto con entrevista, se omite.
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

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium text-sm">Acceso al portal</legend>
        <p className="text-muted-foreground text-xs">
          Vale para todas las personas de este envío.
        </p>
        <label
          className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          htmlFor={`rol-stakeholder-${plantillaId}`}
        >
          <input
            className="mt-1"
            defaultChecked
            id={`rol-stakeholder-${plantillaId}`}
            name="rol"
            type="radio"
            value="stakeholder"
          />
          <span>
            <span className="font-medium">Stakeholder</span>
            <span className="block text-muted-foreground text-xs">
              Entra directo a su entrevista. Firmas socias y otros invitados
              externos.
            </span>
          </span>
        </label>
        <label
          className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          htmlFor={`rol-cliente-${plantillaId}`}
        >
          <input
            className="mt-1"
            id={`rol-cliente-${plantillaId}`}
            name="rol"
            type="radio"
            value="cliente"
          />
          <span>
            <span className="font-medium">Cliente</span>
            <span className="block text-muted-foreground text-xs">
              Ve todas las fases y quién ya completó. El equipo interno del
              proyecto.
            </span>
          </span>
        </label>
      </fieldset>

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Enviando…" : "Enviar entrevista"}
      </Button>
    </form>
  );
}
