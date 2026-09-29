"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  aceptarOnboardingEntrevista,
  type OnboardingActionState,
} from "@/app/(portal)/portal/actions";
import { EntrevistaBienvenida } from "@/components/portal/entrevista-bienvenida";
import { EntrevistaPantallaTransicion } from "@/components/portal/entrevista-pantalla-transicion";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { useMarcaParticipante } from "@/components/portal/marca-participante";
import { Button } from "@/components/ui/button";
import { lineasAviso } from "@/lib/consultoria/comunicacion";
import { contextoConMarca, puntosUsoConMarca } from "@/lib/consultoria/marca";

const initialState: OnboardingActionState = { status: "idle" };

export function EntrevistaOnboarding({
  cliente,
  correoUsuario,
  entrevistaId,
  minutos,
  mostrarPortal,
  nombre,
  numeroSecciones,
  onAceptado,
  titulo,
}: {
  cliente?: string | null;
  correoUsuario?: string | null;
  entrevistaId: string;
  minutos?: number | null;
  mostrarPortal: boolean;
  nombre?: string | null;
  numeroSecciones: number;
  onAceptado: () => void;
  titulo?: string;
}) {
  const marca = useMarcaParticipante();
  const [paso, setPaso] = useState<"saludo" | "disclaimer">("saludo");
  const [state, formAction, pending] = useActionState(
    aceptarOnboardingEntrevista,
    initialState
  );
  const avisoRef = useRef(false);
  const irAlDisclaimer = useCallback(() => {
    setPaso("disclaimer");
  }, []);

  useEffect(() => {
    if (state.status !== "success" || avisoRef.current) {
      return;
    }

    avisoRef.current = true;
    onAceptado();
  }, [onAceptado, state.status]);

  return (
    <EntrevistaShell
      compactoMovil
      correoUsuario={correoUsuario}
      mostrarPortal={mostrarPortal}
      titulo={titulo}
    >
      {paso === "saludo" ? (
        <EntrevistaBienvenida
          minutos={minutos}
          nombre={nombre}
          numeroSecciones={numeroSecciones}
          onContinuar={irAlDisclaimer}
        />
      ) : (
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
              {contextoConMarca(marca, cliente ?? null)}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="font-medium text-lg">Cómo se usan tus respuestas</p>
            <div className="rounded-xl bg-muted px-5 py-5">
              <ul className="flex list-disc flex-col gap-2 pl-5 text-base leading-relaxed">
                {(marca.avisoRespuestas
                  ? lineasAviso(marca.avisoRespuestas)
                  : [...puntosUsoConMarca(marca, cliente ?? null)]
                ).map((punto) => (
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
      )}
    </EntrevistaShell>
  );
}
