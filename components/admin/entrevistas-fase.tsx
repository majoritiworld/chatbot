"use client";

import Link from "next/link";
import { useActionState, useCallback, useState } from "react";
import {
  type ActionState,
  eliminarEntrevista,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EntrevistaDeFaseAdmin } from "@/lib/consultoria/stakeholders";

const initialState: ActionState = { status: "idle" };

function etiquetaEstado(estado: string) {
  if (estado === "completada") {
    return "Completada";
  }
  if (estado === "en_curso") {
    return "En curso";
  }
  return "Pendiente";
}

function EliminarEntrevistaForm({
  entrevistaId,
  faseId,
  proyectoId,
  stakeholderNombre,
}: {
  entrevistaId: string;
  faseId: string;
  proyectoId: string;
  stakeholderNombre: string;
}) {
  const [state, formAction, pending] = useActionState(
    eliminarEntrevista,
    initialState
  );
  const [abierto, setAbierto] = useState(false);
  const abrir = useCallback(() => {
    setAbierto(true);
  }, []);
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (pending) {
        return;
      }
      setAbierto(open);
    },
    [pending]
  );

  return (
    <>
      <Button
        aria-label={`Eliminar entrevista de ${stakeholderNombre}`}
        disabled={pending}
        onClick={abrir}
        size="sm"
        type="button"
        variant="ghost"
      >
        {pending ? "Eliminando…" : "Eliminar"}
      </Button>
      <AlertDialog onOpenChange={onOpenChange} open={abierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta entrevista?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran las respuestas. {stakeholderNombre} sigue en el proyecto
              y puedes volver a enviársela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form action={formAction} className="flex flex-col gap-3">
            <input name="proyectoId" type="hidden" value={proyectoId} />
            <input name="faseId" type="hidden" value={faseId} />
            <input name="entrevistaId" type="hidden" value={entrevistaId} />
            <ActionMensaje className="text-xs" state={state} />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending} type="button">
                Cancelar
              </AlertDialogCancel>
              <Button disabled={pending} type="submit" variant="destructive">
                {pending ? "Eliminando…" : "Eliminar entrevista"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function EntrevistasFase({
  faseId,
  proyectoId,
  entrevistas,
}: {
  faseId: string;
  proyectoId: string;
  entrevistas: EntrevistaDeFaseAdmin[];
}) {
  return (
    <section className="flex flex-col gap-3">
      {entrevistas.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay envíos. Crea el guion abajo y mándalo a la lista de
          correos.
        </p>
      ) : (
        <ul className="flex flex-col rounded-xl border border-border">
          {entrevistas.map((entrevista) => (
            <li
              className="flex flex-wrap items-center gap-2 border-border border-b px-4 py-3 last:border-b-0"
              key={entrevista.id}
            >
              <Link
                className="flex-1 font-medium text-sm hover:underline"
                href={`/admin/${proyectoId}/stakeholder/${entrevista.stakeholderId}`}
              >
                {entrevista.stakeholderNombre}
              </Link>
              <Badge variant="outline">
                {etiquetaEstado(entrevista.estado)}
              </Badge>
              <EliminarEntrevistaForm
                entrevistaId={entrevista.id}
                faseId={faseId}
                proyectoId={proyectoId}
                stakeholderNombre={entrevista.stakeholderNombre}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
