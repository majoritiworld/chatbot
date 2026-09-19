"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  aceptarOnboardingEntrevista,
  type OnboardingActionState,
} from "@/app/(portal)/portal/actions";
import { EntrevistaPantallaTransicion } from "@/components/portal/entrevista-pantalla-transicion";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { Button } from "@/components/ui/button";

const PUNTOS_USO = [
  "Se guardan de forma exclusiva para ComplianceLatam.",
  "El equipo de Majoriti las revisa durante el proyecto para analizarlas, generar insights y apoyar a la organización.",
  "No hace falta terminar de una: puedes guardar y continuar otro día.",
] as const;

const initialState: OnboardingActionState = { status: "idle" };

export function EntrevistaOnboarding({
  entrevistaId,
  mostrarPortal,
  onAceptado,
  titulo,
}: {
  entrevistaId: string;
  mostrarPortal: boolean;
  onAceptado: () => void;
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

  return (
    <EntrevistaShell mostrarPortal={mostrarPortal} titulo={titulo}>
      <EntrevistaPantallaTransicion>
        <div className="flex flex-col gap-3">
          <h1 className="font-semibold text-[28px] tracking-tight">
            Antes de empezar
          </h1>
          <p className="text-lg leading-relaxed">
            Esta es una entrevista agéntica: un agente de IA te va a hacer
            preguntas y conversar contigo, en vez de un formulario fijo.
          </p>
          <p className="italic text-muted-foreground text-sm leading-relaxed">
            La preparó el equipo de Majoriti junto con ComplianceLatam para este
            proyecto de consultoría.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-medium text-lg">Cómo se usan tus respuestas</p>
          <div className="rounded-xl bg-muted px-5 py-5">
            <ul className="flex list-disc flex-col gap-2 pl-5 text-base leading-relaxed">
              {PUNTOS_USO.map((punto) => (
                <li key={punto}>{punto}</li>
              ))}
            </ul>
          </div>
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          <input name="entrevistaId" type="hidden" value={entrevistaId} />
          <p className="text-muted-foreground text-sm leading-relaxed">
            Al aceptar, confirmas que leíste cómo se usan tus respuestas y
            puedes empezar.
          </p>
          {state.status === "error" && state.message ? (
            <p className="text-destructive text-lg" role="alert">
              {state.message}
            </p>
          ) : null}
          <Button
            className="h-11 w-fit text-lg"
            disabled={pending}
            type="submit"
          >
            {pending ? "Aceptando…" : "Aceptar y empezar"}
          </Button>
        </form>
      </EntrevistaPantallaTransicion>
    </EntrevistaShell>
  );
}
