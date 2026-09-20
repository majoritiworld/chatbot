"use client";

import { EntrevistaPantallaTransicion } from "@/components/portal/entrevista-pantalla-transicion";
import { Button } from "@/components/ui/button";
import { textoTemasTerminados } from "@/lib/consultoria/entrevista-piloto";

/** Interviews that already reached revision, or a failed submit after close. */

export function EntrevistaRevision({
  errorEntrega = false,
  nombre,
  numeroSecciones,
  onEnviar,
  pending,
}: {
  errorEntrega?: boolean;
  nombre?: string | null;
  numeroSecciones: number;
  onEnviar: () => void;
  pending: boolean;
}) {
  return (
    <EntrevistaPantallaTransicion>
      <div className="flex flex-col gap-3">
        <p className="font-medium text-primary text-sm">Listo para enviar</p>
        <h1 className="font-semibold text-3xl tracking-tight">
          Gracias{nombre?.trim() ? `, ${nombre.trim()}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {textoTemasTerminados(numeroSecciones)} Tus respuestas quedaron
          guardadas. Todavía no se han enviado.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Al enviarlas, la entrevista quedará cerrada y ya no podrás agregar
          nuevas respuestas.
        </p>
        {errorEntrega ? (
          <p className="text-destructive text-sm" role="alert">
            No se pudo enviar. Tus respuestas siguen guardadas; inténtalo de
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
        {pending ? "Enviando…" : "Enviar entrevista"}
      </Button>
    </EntrevistaPantallaTransicion>
  );
}
