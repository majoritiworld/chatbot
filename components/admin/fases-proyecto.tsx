"use client";

import { useActionState } from "react";
import {
  type ActionState,
  cambiarEstadoFase,
  crearFase,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ETIQUETA_ESTADO,
  type FaseEstado,
  normalizarEstado,
} from "@/lib/consultoria/fase-estado";
import type { FaseAdmin } from "@/lib/consultoria/stakeholders";

const initialState: ActionState = { status: "idle" };

const BADGE_VARIANT: Record<FaseEstado, "default" | "secondary" | "outline"> = {
  bloqueado: "outline",
  completado: "secondary",
  en_progreso: "default",
};

function formatFecha(fecha: string | null) {
  if (!fecha) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${fecha}T00:00:00`));
}

function FaseFila({
  fase,
  proyectoId,
}: {
  fase: FaseAdmin;
  proyectoId: string;
}) {
  const [state, formAction, pending] = useActionState(
    cambiarEstadoFase,
    initialState
  );
  const estado = normalizarEstado(fase.estado);

  return (
    <li className="flex flex-col gap-2 border-border border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex-1 font-medium text-sm">
          {fase.orden}. {fase.nombre}
        </span>
        <span className="text-muted-foreground text-xs">
          {formatFecha(fase.fechaEstimada)}
        </span>
        <Badge variant={BADGE_VARIANT[estado]}>{ETIQUETA_ESTADO[estado]}</Badge>

        <form action={formAction} className="flex items-center gap-2">
          <input name="proyectoId" type="hidden" value={proyectoId} />
          <input name="faseId" type="hidden" value={fase.id} />

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
      </div>

      <ActionMensaje className="text-xs" state={state} />
    </li>
  );
}

export function FasesProyecto({
  proyectoId,
  fases,
}: {
  proyectoId: string;
  fases: FaseAdmin[];
}) {
  const [state, formAction, pending] = useActionState(crearFase, initialState);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <div>
        <h2 className="font-medium text-base">Fases</h2>
        <p className="text-muted-foreground text-sm">
          El cliente solo puede entrar a las fases desbloqueadas. La primera
          fase del proyecto se crea abierta.
        </p>
      </div>

      {fases.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay fases. Crea la primera para poder colgar una entrevista
          agéntica.
        </p>
      ) : (
        <ul className="flex flex-col">
          {fases.map((fase) => (
            <FaseFila fase={fase} key={fase.id} proyectoId={proyectoId} />
          ))}
        </ul>
      )}

      <form
        action={formAction}
        className="flex flex-col gap-3 border-border border-t pt-4"
      >
        <input name="proyectoId" type="hidden" value={proyectoId} />

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-56 flex-1 flex-col gap-1.5">
            <Label htmlFor="fase-nombre">Nueva fase</Label>
            <Input
              id="fase-nombre"
              name="nombre"
              placeholder="Entrevistas de diagnóstico"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fase-fecha">Fecha estimada</Label>
            <Input id="fase-fecha" name="fechaEstimada" type="date" />
          </div>
          <Button disabled={pending} type="submit" variant="outline">
            {pending ? "Agregando…" : "Agregar fase"}
          </Button>
        </div>

        <ActionMensaje state={state} />
      </form>
    </section>
  );
}
