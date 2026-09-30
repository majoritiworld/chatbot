"use client";

import { useActionState } from "react";
import {
  type ActionState,
  actualizarFase,
  cambiarEstadoFase,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type FaseEstado,
  normalizarEstado,
} from "@/lib/consultoria/fase-estado";
import type { FaseAdmin } from "@/lib/consultoria/stakeholders";

const initialState: ActionState = { status: "idle" };

export function FaseEstadoBotones({
  faseId,
  proyectoId,
  estado,
}: {
  faseId: string;
  proyectoId: string;
  estado: FaseEstado;
}) {
  const [state, formAction, pending] = useActionState(
    cambiarEstadoFase,
    initialState
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input name="proyectoId" type="hidden" value={proyectoId} />
        <input name="faseId" type="hidden" value={faseId} />

        {estado === "en_progreso" ? null : (
          <Button
            disabled={pending}
            name="estado"
            size="sm"
            type="submit"
            value="en_progreso"
            variant="outline"
          >
            {estado === "completado" ? "Reabrir" : "Desbloquear"}
          </Button>
        )}
        {estado === "completado" ? null : (
          <Button
            disabled={pending}
            name="estado"
            size="sm"
            type="submit"
            value="completado"
            variant="outline"
          >
            Completar
          </Button>
        )}
        {estado === "en_progreso" ? (
          <Button
            disabled={pending}
            name="estado"
            size="sm"
            type="submit"
            value="bloqueado"
            variant="ghost"
          >
            Bloquear
          </Button>
        ) : null}
      </form>
      <ActionMensaje className="text-xs" state={state} />
    </div>
  );
}

export function EditarFaseForm({
  fase,
  proyectoId,
}: {
  fase: FaseAdmin;
  proyectoId: string;
}) {
  const [state, formAction, pending] = useActionState(
    actualizarFase,
    initialState
  );
  const estado = normalizarEstado(fase.estado);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <input name="proyectoId" type="hidden" value={proyectoId} />
        <input name="faseId" type="hidden" value={fase.id} />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-nombre">Título</Label>
          <Input
            defaultValue={fase.nombre}
            id="fase-nombre"
            name="nombre"
            required
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fase-fecha-inicio">Fecha de inicio</Label>
            <Input
              defaultValue={fase.fechaEstimada ?? ""}
              id="fase-fecha-inicio"
              name="fechaEstimada"
              type="date"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fase-fecha-cierre">Fecha de cierre</Label>
            <Input
              defaultValue={fase.fechaCierre ?? ""}
              id="fase-fecha-cierre"
              name="fechaCierre"
              type="date"
            />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          El cliente verá el rango, por ejemplo 28/09-07/10.
        </p>

        <div className="flex w-3/4 flex-col gap-1.5">
          <Label htmlFor="fase-descripcion">Descripción</Label>
          <Textarea
            defaultValue={fase.descripcion ?? ""}
            id="fase-descripcion"
            name="descripcion"
            placeholder="Qué cubre esta fase y qué esperamos del cliente."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-minutos">Duración sugerida, en minutos</Label>
          <Input
            defaultValue={fase.minutos ?? ""}
            id="fase-minutos"
            inputMode="numeric"
            name="minutos"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-bienvenida">Bienvenida de esta fase</Label>
          <Textarea
            defaultValue={fase.textoBienvenida ?? ""}
            id="fase-bienvenida"
            name="textoBienvenida"
            placeholder="Vacío: se usa la del proyecto."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-aviso">Aviso de esta fase</Label>
          <Textarea
            defaultValue={fase.avisoRespuestas ?? ""}
            id="fase-aviso"
            name="avisoRespuestas"
            placeholder="Vacío: se usa el del proyecto. Una línea por punto."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-asunto">Asunto del correo de confirmación</Label>
          <Input
            defaultValue={fase.correoAsunto ?? ""}
            id="fase-asunto"
            name="correoAsunto"
            placeholder="Vacío: se usa el del proyecto."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-remitente">Nombre visible del remitente</Label>
          <Input
            defaultValue={fase.correoRemitente ?? ""}
            id="fase-remitente"
            name="correoRemitente"
            placeholder="Vacío: se usa el del proyecto."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-cuerpo">Cuerpo del correo de confirmación</Label>
          <Textarea
            defaultValue={fase.correoCuerpo ?? ""}
            id="fase-cuerpo"
            name="correoCuerpo"
            placeholder="Vacío: se usa el del proyecto."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-firma">Firma del correo</Label>
          <Input
            defaultValue={fase.correoFirma ?? ""}
            id="fase-firma"
            name="correoFirma"
            placeholder="Vacío: se usa la del proyecto."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-invitacion-asunto">
            Asunto de la invitación
          </Label>
          <Input
            defaultValue={fase.invitacionAsunto ?? ""}
            id="fase-invitacion-asunto"
            name="invitacionAsunto"
            placeholder="Vacío: se usa el del proyecto."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-invitacion-cuerpo">
            Cuerpo de la invitación
          </Label>
          <Textarea
            defaultValue={fase.invitacionCuerpo ?? ""}
            id="fase-invitacion-cuerpo"
            name="invitacionCuerpo"
            placeholder="Vacío: se usa el del proyecto. La duración, el guardado y el acceso se agregan solos."
          />
        </div>
        {fase.acceso ? (
          <div className="flex flex-col gap-1.5">
            <input
              name="accesoEnlacePersonalEditable"
              type="hidden"
              value="1"
            />
            <div className="flex items-center gap-2">
              <input
                className="size-4"
                defaultChecked={fase.acceso.enlacePersonal}
                id="fase-acceso-enlace"
                name="accesoEnlacePersonal"
                type="checkbox"
              />
              <Label htmlFor="fase-acceso-enlace">
                Invitar con enlace personal
              </Label>
            </div>
            <p className="text-muted-foreground text-xs">
              El enlace abre la entrevista sin correo ni código. Correo y código
              siguen disponibles. Al desactivarlo, los enlaces ya enviados dejan
              de funcionar.
            </p>
            {fase.acceso.soloCorreo ? (
              <p className="text-muted-foreground text-xs">
                Esta fase también se abre escribiendo solo el correo en la
                página del proyecto.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            El modo de acceso de la invitación estará disponible cuando se
            aplique la migración de acceso.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-bloque">Bloque comercial</Label>
          <Textarea
            defaultValue={fase.bloqueComercial ?? ""}
            id="fase-bloque"
            name="bloqueComercial"
            placeholder="Vacío: esta fase no incluye bloque comercial."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-bloque-etiqueta">Texto del enlace</Label>
          <Input
            defaultValue={fase.bloqueComercialEtiqueta ?? ""}
            id="fase-bloque-etiqueta"
            name="bloqueComercialEtiqueta"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fase-bloque-url">Enlace del bloque</Label>
          <Input
            defaultValue={fase.bloqueComercialUrl ?? ""}
            id="fase-bloque-url"
            name="bloqueComercialUrl"
            placeholder="https://"
            type="url"
          />
        </div>

        <ActionMensaje state={state} />

        <Button className="w-fit" disabled={pending} type="submit">
          {pending ? "Guardando…" : "Guardar fase"}
        </Button>
      </form>

      <div className="border-border border-t pt-4">
        <p className="mb-2 text-muted-foreground text-sm">Estado</p>
        <FaseEstadoBotones
          estado={estado}
          faseId={fase.id}
          proyectoId={proyectoId}
        />
      </div>
    </div>
  );
}
