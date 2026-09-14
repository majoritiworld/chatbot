"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  aceptarOnboardingEntrevista,
  type OnboardingActionState,
} from "@/app/(portal)/portal/actions";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { Button } from "@/components/ui/button";

const PUNTOS = [
  "La conversación queda guardada para el trabajo de consultoría.",
  "El equipo de Majoriti revisa tus respuestas.",
  "El equipo del cliente ve quién ya completó. Otras personas invitadas no ven tu entrevista.",
  "Puedes guardar y continuar otro día.",
] as const;

const initialState: OnboardingActionState = { status: "idle" };

export function EntrevistaOnboarding({
  entrevistaId,
  mostrarPortal,
  onAceptado,
  proyectoNombre,
  titulo,
}: {
  entrevistaId: string;
  mostrarPortal: boolean;
  onAceptado: () => void;
  proyectoNombre?: string | null;
  titulo?: string;
}) {
  const [state, formAction, pending] = useActionState(
    aceptarOnboardingEntrevista,
    initialState
  );
  const avisoRef = useRef(false);

  useEffect(() => {
    if (state.status !== "success" || avisoRef.current) {
      return;
    }

    avisoRef.current = true;
    onAceptado();
  }, [onAceptado, state.status]);

  const contexto = proyectoNombre
    ? `Esta es una entrevista de Majoriti para ${proyectoNombre}.`
    : "Esta es una entrevista de Majoriti.";

  return (
    <EntrevistaShell mostrarPortal={mostrarPortal} titulo={titulo}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-12">
        <div className="flex flex-col gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">
            Antes de empezar
          </h1>
          <p className="text-muted-foreground text-sm">
            {contexto} Un agente te va a hacer preguntas; no hace falta
            terminarla de una.
          </p>
        </div>

        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
          {PUNTOS.map((punto) => (
            <li key={punto}>{punto}</li>
          ))}
        </ul>

        <form action={formAction} className="flex flex-col gap-3">
          <input name="entrevistaId" type="hidden" value={entrevistaId} />
          {state.status === "error" && state.message ? (
            <p className="text-destructive text-sm" role="alert">
              {state.message}
            </p>
          ) : null}
          <Button className="w-fit" disabled={pending} type="submit">
            {pending ? "Empezando…" : "Empezar entrevista"}
          </Button>
        </form>
      </div>
    </EntrevistaShell>
  );
}
