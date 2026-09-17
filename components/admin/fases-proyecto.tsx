"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type ActionState, crearFase } from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { FaseEstadoBotones } from "@/components/admin/editar-fase-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ETIQUETA_ESTADO,
  type FaseEstado,
  normalizarEstado,
} from "@/lib/consultoria/fase-estado";
import { formatRangoFechas } from "@/lib/consultoria/fechas-rango";
import type { FaseAdmin } from "@/lib/consultoria/stakeholders";

const initialState: ActionState = { status: "idle" };

const BADGE_VARIANT: Record<FaseEstado, "default" | "secondary" | "outline"> = {
  bloqueado: "outline",
  completado: "secondary",
  en_progreso: "default",
};

const BADGE_CLASS: Record<FaseEstado, string> = {
  bloqueado: "",
  completado: "",
  en_progreso: "border-transparent bg-black/60 text-white",
};

function FaseFila({
  fase,
  proyectoId,
}: {
  fase: FaseAdmin;
  proyectoId: string;
}) {
  const estado = normalizarEstado(fase.estado);

  return (
    <li className="flex flex-col gap-2 border-border border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          className="flex-1 font-medium text-sm hover:underline"
          href={`/admin/${proyectoId}/fase/${fase.id}`}
        >
          {fase.orden}. {fase.nombre}
        </Link>
        <span className="font-jetbrains font-light text-muted-foreground text-xs tracking-wide uppercase">
          {formatRangoFechas(fase.fechaEstimada, fase.fechaCierre, "Sin fecha")}
        </span>
        <Badge className={BADGE_CLASS[estado]} variant={BADGE_VARIANT[estado]}>
          {ETIQUETA_ESTADO[estado]}
        </Badge>
        <FaseEstadoBotones
          estado={estado}
          faseId={fase.id}
          proyectoId={proyectoId}
        />
      </div>
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
          El cliente solo puede entrar a las fases desbloqueadas. Abre una fase
          para editar su descripción, fechas, entrevistas y tareas.
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
            <Label htmlFor="fase-fecha">Fecha de inicio</Label>
            <Input id="fase-fecha" name="fechaEstimada" type="date" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fase-fecha-cierre">Fecha de cierre</Label>
            <Input id="fase-fecha-cierre" name="fechaCierre" type="date" />
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
