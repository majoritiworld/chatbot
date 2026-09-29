"use client";

import { EntrevistaPantallaTransicion } from "@/components/portal/entrevista-pantalla-transicion";
import { useMarcaParticipante } from "@/components/portal/marca-participante";
import { Button } from "@/components/ui/button";
import { textoDuracionEntrevista } from "@/lib/consultoria/entrevista-piloto";
import { textoBienvenidaParticipante } from "@/lib/consultoria/marca";
import { partirNombre } from "@/lib/consultoria/nombre";

export function EntrevistaBienvenida({
  minutos,
  nombre,
  numeroSecciones,
  onContinuar,
}: {
  minutos?: number | null;
  nombre?: string | null;
  numeroSecciones: number;
  onContinuar: () => void;
}) {
  const marca = useMarcaParticipante();
  const primerNombre = nombre ? partirNombre(nombre).nombre : "";
  const saludo = primerNombre
    ? `Hola, ${primerNombre}`
    : "Te damos la bienvenida";
  const temas = numeroSecciones === 1 ? "un tema" : `${numeroSecciones} temas`;

  return (
    <EntrevistaPantallaTransicion>
      <div className="flex flex-col gap-3">
        <h1 className="font-semibold text-[28px] tracking-tight">{saludo}</h1>
        <p className="text-lg leading-relaxed">
          {marca.textoBienvenida ?? textoBienvenidaParticipante(marca, temas)}
        </p>
        <p className="text-lg leading-relaxed">
          {textoDuracionEntrevista(numeroSecciones, minutos)} No hace falta
          terminarla de una: puedes guardar y volver otro día.
        </p>
        <p className="text-muted-foreground text-base leading-relaxed">
          A continuación te pediremos que confirmes cómo se usan tus respuestas.
        </p>
      </div>

      <Button
        className="h-11 w-fit text-lg"
        onClick={onContinuar}
        type="button"
      >
        Continuar
      </Button>
    </EntrevistaPantallaTransicion>
  );
}
