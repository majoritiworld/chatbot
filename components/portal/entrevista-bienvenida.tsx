"use client";

import { Button } from "@/components/ui/button";

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
  const saludo = nombre?.trim()
    ? `Hola, ${nombre.trim()}`
    : "Te damos la bienvenida";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-3">
        <p className="font-medium text-primary text-sm">Entrevista agéntica</p>
        <h1 className="font-semibold text-3xl tracking-tight">{saludo}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          La entrevista tiene {numeroSecciones}{" "}
          {numeroSecciones === 1 ? "sección" : "secciones"}. En cada una podrás
          responder con texto o voz, y el entrevistador te hará preguntas para
          profundizar en lo que compartas.
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Puedes guardar tu progreso y continuar otro día. Antes de cada
          conversación te presentaremos el tema.
        </p>
      </div>

      <Button
        className="w-fit"
        disabled={pending}
        onClick={onContinuar}
        type="button"
      >
        {pending ? "Preparando…" : "Continuar"}
      </Button>
    </div>
  );
}
