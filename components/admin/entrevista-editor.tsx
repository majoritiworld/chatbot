"use client";

import {
  type ChangeEvent,
  useActionState,
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  type ActionState,
  guardarContenidoEntrevista,
} from "@/app/(admin)/admin/actions";
import { ActionMensaje } from "@/components/admin/action-mensaje";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  ResumenEntrevista,
  TurnoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";

const initialState: ActionState = { status: "idle" };

export function EntrevistaEditor({
  stakeholderId,
  proyectoId,
  entrevistaId,
  transcripcionInicial,
  resumenInicial,
}: {
  stakeholderId: string;
  proyectoId: string;
  entrevistaId: string;
  transcripcionInicial: TurnoEntrevista[];
  resumenInicial: ResumenEntrevista | null;
}) {
  const [transcripcionJson, setTranscripcionJson] = useState(
    JSON.stringify(transcripcionInicial, null, 2)
  );
  const [resumenJson, setResumenJson] = useState(
    JSON.stringify(
      resumenInicial ?? { hallazgos: [], respuestas: [], sintesis: "" },
      null,
      2
    )
  );
  const [state, formAction, pending] = useActionState(
    guardarContenidoEntrevista,
    initialState
  );

  const onTranscripcionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setTranscripcionJson(event.target.value);
    },
    []
  );
  const onResumenChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setResumenJson(event.target.value);
    },
    []
  );

  const turnosVista = useMemo(() => {
    try {
      return JSON.parse(transcripcionJson) as TurnoEntrevista[];
    } catch {
      return transcripcionInicial;
    }
  }, [transcripcionJson, transcripcionInicial]);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-base">Transcripción</h2>

        {turnosVista.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aún no hay turnos guardados. Se llenan a medida que avanza la
            entrevista.
          </p>
        ) : (
          <ol className="flex flex-col gap-3 rounded-xl border border-border p-4">
            {turnosVista.map((turno) => (
              <li className="flex flex-col gap-1" key={turno.id}>
                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  {turno.rol === "entrevistador"
                    ? "Entrevistador"
                    : "Entrevistado"}
                </span>
                <p className="whitespace-pre-wrap text-sm">{turno.texto}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <form action={formAction} className="flex flex-col gap-4">
        <input name="entrevistaId" type="hidden" value={entrevistaId} />
        <input name="stakeholderId" type="hidden" value={stakeholderId} />
        <input name="proyectoId" type="hidden" value={proyectoId} />

        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-sm" htmlFor="transcripcion">
            Transcripción (JSON editable)
          </label>
          <Textarea
            className="min-h-48 font-mono text-xs"
            id="transcripcion"
            name="transcripcion"
            onChange={onTranscripcionChange}
            value={transcripcionJson}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-medium text-sm" htmlFor="resumen">
            Resumen estructurado (JSON editable)
          </label>
          <Textarea
            className="min-h-48 font-mono text-xs"
            id="resumen"
            name="resumen"
            onChange={onResumenChange}
            value={resumenJson}
          />
        </div>

        <ActionMensaje state={state} />

        <Button className="w-fit" disabled={pending} type="submit">
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>
    </div>
  );
}
