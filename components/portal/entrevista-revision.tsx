"use client";

import { EntrevistaPantallaTransicion } from "@/components/portal/entrevista-pantalla-transicion";
import { Button } from "@/components/ui/button";
import {
  etiquetaEntregaPendiente,
  explicacionEntregaPendiente,
  textoTemasTerminados,
} from "@/lib/consultoria/entrevista-piloto";

/** Undelivered review from a previous visit, or a failed submit after close. */

export function EntrevistaRevision({
  errorEntrega = false,
  numeroSecciones,
  onEnviar,
  pending,
}: {
  errorEntrega?: boolean;
  numeroSecciones: number;
  onEnviar: () => void;
  pending: boolean;
}) {
  return (
    <EntrevistaPantallaTransicion>
      <div className="flex flex-col gap-3">
        <h1 className="font-semibold text-3xl tracking-tight">
          Finalizar entrevista
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {textoTemasTerminados(numeroSecciones)}{" "}
          {explicacionEntregaPendiente()}
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Al finalizar, la entrevista quedará cerrada y ya no podrás agregar
          más.
        </p>
        {errorEntrega ? (
          <p className="text-destructive text-sm" role="alert">
            No se pudo entregar. Lo ya cerrado sigue guardado; inténtalo de
            nuevo.
          </p>
        ) : null}
      </div>

      <Button
        className="w-fit"
        disabled={pending}
        onClick={onEnviar}
        type="button"
      >
        {etiquetaEntregaPendiente({ errorEntrega, pending })}
      </Button>
    </EntrevistaPantallaTransicion>
  );
}
