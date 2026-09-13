"use client";

import { useActionState } from "react";
import {
  type ActionState,
  marcarFaseCompletada,
} from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FaseAdmin } from "@/lib/consultoria/stakeholders";

const initialState: ActionState = { status: "idle" };

export function MarcarFaseForm({
  stakeholderId,
  proyectoId,
  fases,
  faseVinculadaId,
}: {
  stakeholderId: string;
  proyectoId: string;
  fases: FaseAdmin[];
  faseVinculadaId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    marcarFaseCompletada,
    initialState
  );

  const defaultFaseId =
    faseVinculadaId ??
    fases.find((fase) => fase.estado !== "completado")?.id ??
    fases[0]?.id ??
    "";

  if (fases.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No hay fases en este proyecto.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-border p-4"
    >
      <input name="stakeholderId" type="hidden" value={stakeholderId} />
      <input name="proyectoId" type="hidden" value={proyectoId} />

      <div>
        <h2 className="font-medium text-base">Fases del proyecto</h2>
        <p className="text-muted-foreground text-sm">
          Al marcar una fase como completada, el portal cliente se actualiza
          vía Realtime.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {fases.map((fase) => (
          <li className="flex items-center gap-2 text-sm" key={fase.id}>
            <span className="flex-1">
              {fase.orden}. {fase.nombre}
            </span>
            <Badge variant="outline">{fase.estado}</Badge>
            {faseVinculadaId === fase.id ? (
              <span className="text-muted-foreground text-xs">vinculada</span>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm" htmlFor="faseId">
            Fase a completar
          </label>
          <select
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
            defaultValue={defaultFaseId}
            id="faseId"
            name="faseId"
            required
          >
            {fases.map((fase) => (
              <option key={fase.id} value={fase.id}>
                {fase.nombre} ({fase.estado})
              </option>
            ))}
          </select>
        </div>

        <Button disabled={pending} type="submit">
          {pending ? "Actualizando…" : "Marcar fase como completada"}
        </Button>
      </div>

      {state.message ? (
        <p
          className={
            state.status === "error"
              ? "text-destructive text-sm"
              : "text-muted-foreground text-sm"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
