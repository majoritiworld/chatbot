"use client";

import { EntrevistaPantallaTransicion } from "@/components/portal/entrevista-pantalla-transicion";
import { Button } from "@/components/ui/button";
import { partirNombre } from "@/lib/consultoria/nombre";

export function EntrevistaBienvenida({
  nombre,
  numeroSecciones,
  onContinuar,
  pending,
}: {
  nombre?: string | null;
  numeroSecciones: number;
  onContinuar: () => void;
  pending: boolean;
}) {
  const primerNombre = nombre ? partirNombre(nombre).nombre : "";
  const saludo = primerNombre
    ? `Hola, ${primerNombre}`
    : "Te damos la bienvenida";

  return (
    <EntrevistaPantallaTransicion>
      <div className="flex flex-col gap-3">
        <h1 className="font-semibold text-3xl tracking-tight">{saludo}</h1>
        <div className="flex flex-col gap-3 rounded-2xl bg-muted px-4 py-3">
          <p className="text-base leading-relaxed">
            La entrevista tiene {numeroSecciones}{" "}
            {numeroSecciones === 1 ? "sección" : "secciones"}. En cada una
            podrás responder con texto o voz, y el entrevistador te hará
            preguntas para profundizar en lo que compartas.
          </p>
          <p className="text-base leading-relaxed">
            Puedes guardar tu progreso y continuar otro día. Antes de cada
            conversación te presentaremos el tema.
          </p>
        </div>
      </div>

      <Button
        className="w-fit"
        disabled={pending}
        onClick={onContinuar}
        type="button"
      >
        {pending ? "Preparando…" : "Continuar"}
      </Button>
    </EntrevistaPantallaTransicion>
  );
}
