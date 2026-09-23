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
import { agruparPersonasPorAcceso } from "@/lib/consultoria/personas-grupos";
import type { StakeholderAdmin } from "@/lib/consultoria/stakeholders";
import { cn } from "@/lib/utils";

const initialState: ActionState = { status: "idle" };

const PLACEHOLDER = `ana@acme.com, Ana Pérez, ACME
bruno@foo.com, Bruno, Díaz, Foo Partners
carla@bar.com`;

function PersonaCheckbox({
  plantillaId,
  persona,
}: {
  plantillaId: string;
  persona: StakeholderAdmin;
}) {
  const id = `persona-${plantillaId}-${persona.id}`;
  const yaAsignada = Boolean(persona.entrevistaId);

  return (
    <label
      className={cn(
        "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm",
        yaAsignada
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:bg-muted/40"
      )}
      htmlFor={id}
    >
      <input
        className="mt-1"
        disabled={yaAsignada}
        id={id}
        name="personaId"
        type="checkbox"
        value={persona.id}
      />
      <span className="min-w-0">
        <span className="font-medium">{persona.nombreCompleto}</span>
        {persona.firma ? (
          <span className="text-muted-foreground"> · {persona.firma}</span>
        ) : null}
        {yaAsignada ? (
          <span className="block text-muted-foreground text-xs">
            Ya tiene una entrevista en este proyecto
          </span>
        ) : null}
      </span>
    </label>
  );
}

function GrupoDestinatarios({
  personas,
  plantillaId,
  titulo,
}: {
  personas: StakeholderAdmin[];
  plantillaId: string;
  titulo: string;
}) {
  if (personas.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {titulo}
      </p>
      <div className="flex flex-col">
        {personas.map((persona) => (
          <PersonaCheckbox
            key={persona.id}
            persona={persona}
            plantillaId={plantillaId}
          />
        ))}
      </div>
    </div>
  );
}

export function EnviarPlantillaForm({
  personas,
  plantillaId,
  proyectoId,
}: {
  personas: StakeholderAdmin[];
  plantillaId: string;
  proyectoId: string;
}) {
  const [state, formAction, pending] = useActionState(
    enviarPlantillaEntrevista,
    initialState
  );
  const grupos = agruparPersonasPorAcceso(personas);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <input name="plantillaId" type="hidden" value={plantillaId} />

      {personas.length > 0 ? (
        <fieldset className="flex flex-col gap-3 rounded-lg border border-border px-3 py-3">
          <legend className="px-1 font-medium text-sm">En el proyecto</legend>
          <p className="text-muted-foreground text-xs">
            Elige clientes o stakeholders que ya están cargados. Quien ya tiene
            entrevista no se puede volver a asignar.
          </p>
          <div className="flex max-h-64 flex-col gap-3 overflow-y-auto">
            <GrupoDestinatarios
              personas={grupos.clientes}
              plantillaId={plantillaId}
              titulo="Clientes"
            />
            <GrupoDestinatarios
              personas={grupos.stakeholders}
              plantillaId={plantillaId}
              titulo="Stakeholders"
            />
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`destinatarios-${plantillaId}`}>
          {personas.length > 0 ? "Otras personas" : "Destinatarios"}
        </Label>
        <Textarea
          className="min-h-28 text-sm"
          id={`destinatarios-${plantillaId}`}
          name="destinatarios"
          placeholder={PLACEHOLDER}
        />
        <p className="text-muted-foreground text-xs">
          Una persona por línea: email, nombre apellido, firma. También vale
          email, nombre, apellido, firma. Hasta 50. Si ya está en el proyecto
          con entrevista, se omite.
        </p>
        <p className="text-muted-foreground text-xs">
          El correo que sale es de acceso al portal de Majoriti, no un briefing
          de la entrevista. Quien ya tenía cuenta no recibe mail nuevo: avísale
          por WhatsApp o correo que entre al portal, ahí está la entrevista.
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
        descripcion={
          personas.length > 0
            ? "Solo para personas nuevas o sin cuenta. Quien ya es cliente o stakeholder conserva su acceso."
            : "Vale para todas las personas de este envío."
        }
        idPrefix={`rol-${plantillaId}`}
      />

      <ActionMensaje state={state} />

      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Enviando…" : "Enviar entrevista"}
      </Button>
    </form>
  );
}
