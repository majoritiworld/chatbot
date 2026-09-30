"use client";

import { useActionState } from "react";
import { type ActionState, guardarMarca } from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ActionState = { status: "idle" };

export function MarcaProyectoForm({
  avisoRespuestas,
  color,
  contactoEmail,
  contactoNombre,
  correoAsunto,
  correoCuerpo,
  correoFirma,
  correoRemitente,
  invitacion,
  nombrePublico,
  proyectoId,
  slug,
  textoBienvenida,
  titulo,
}: {
  avisoRespuestas: string | null;
  color: string | null;
  contactoEmail: string | null;
  contactoNombre: string | null;
  correoAsunto: string | null;
  correoCuerpo: string | null;
  correoFirma: string | null;
  correoRemitente: string | null;
  /** Null until the migration adds the invitation columns. */
  invitacion: { asunto: string | null; cuerpo: string | null } | null;
  nombrePublico: string | null;
  proyectoId: string;
  slug: string | null;
  textoBienvenida: string | null;
  titulo: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    guardarMarca,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input name="proyectoId" type="hidden" value={proyectoId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marca-slug">Identificador del enlace</Label>
        <Input
          autoComplete="off"
          defaultValue={slug ?? ""}
          id="marca-slug"
          name="slug"
          placeholder="compliance-latam-2026"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marca-nombre">Nombre público del cliente</Label>
        <Input
          defaultValue={nombrePublico ?? ""}
          id="marca-nombre"
          name="nombrePublico"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marca-logo">Logo</Label>
        <Input
          accept="image/png,image/jpeg,image/webp,image/gif"
          id="marca-logo"
          name="logo"
          type="file"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marca-color">Color principal</Label>
        <Input
          defaultValue={color ?? ""}
          id="marca-color"
          name="color"
          placeholder="#1f4b3a"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marca-titulo">Título de la iniciativa</Label>
        <Input defaultValue={titulo ?? ""} id="marca-titulo" name="titulo" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marca-bienvenida">Texto de bienvenida</Label>
        <Textarea
          defaultValue={textoBienvenida ?? ""}
          id="marca-bienvenida"
          name="textoBienvenida"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marca-aviso">Aviso antes de empezar</Label>
        <Textarea
          defaultValue={avisoRespuestas ?? ""}
          id="marca-aviso"
          name="avisoRespuestas"
          placeholder="Una línea por punto. Una fase puede reemplazarlo."
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marca-asunto">Asunto del correo de confirmación</Label>
        <Input
          defaultValue={correoAsunto ?? ""}
          id="marca-asunto"
          name="correoAsunto"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marca-cuerpo">Cuerpo del correo de confirmación</Label>
        <Textarea
          defaultValue={correoCuerpo ?? ""}
          id="marca-cuerpo"
          name="correoCuerpo"
        />
      </div>
      {invitacion ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marca-invitacion-asunto">
              Asunto del correo de invitación
            </Label>
            <Input
              defaultValue={invitacion.asunto ?? ""}
              id="marca-invitacion-asunto"
              name="invitacionAsunto"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marca-invitacion-cuerpo">
              Cuerpo del correo de invitación
            </Label>
            <Textarea
              defaultValue={invitacion.cuerpo ?? ""}
              id="marca-invitacion-cuerpo"
              name="invitacionCuerpo"
              placeholder="La duración, el guardado y el acceso se agregan solos."
            />
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-xs">
          Los textos de invitación estarán disponibles cuando se aplique la
          migración de correos.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marca-remitente">Nombre en el remitente</Label>
        <Input
          defaultValue={correoRemitente ?? ""}
          id="marca-remitente"
          name="correoRemitente"
          placeholder="Vacío: nombre público del cliente"
        />
        <p className="text-muted-foreground text-xs">
          Se muestra como «nombre vía Majoriti», en la confirmación y en la
          invitación.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="marca-firma">Firma de los correos</Label>
        <Input
          defaultValue={correoFirma ?? ""}
          id="marca-firma"
          name="correoFirma"
          placeholder="Vacío: Equipo y nombre del cliente"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="marca-contacto-nombre">Nombre de contacto</Label>
          <Input
            defaultValue={contactoNombre ?? ""}
            id="marca-contacto-nombre"
            name="contactoNombre"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="marca-contacto-email">Correo de contacto</Label>
          <Input
            autoComplete="email"
            defaultValue={contactoEmail ?? ""}
            id="marca-contacto-email"
            name="contactoEmail"
            type="email"
          />
          <p className="text-muted-foreground text-xs">
            Recibe las respuestas a los correos. Sin él, no se envían.
          </p>
        </div>
      </div>
      <ActionMensaje state={state} />
      <Button className="w-fit" disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar marca"}
      </Button>
    </form>
  );
}
