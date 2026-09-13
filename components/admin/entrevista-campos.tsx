"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ETIQUETA_ESTADO,
  normalizarEstado,
} from "@/lib/consultoria/fase-estado";
import type { FaseAdmin } from "@/lib/consultoria/stakeholders";

const PLACEHOLDER_PREGUNTAS = `¿Cuáles son los principales retos del área hoy?
¿Qué decisiones se toman sin datos suficientes?
¿Qué cambiarías primero si pudieras?`;

/** Interviewing on a blocked phase is pointless: that phase opens on assign. */
export function faseSugerida(fases: FaseAdmin[]): string {
  const abierta = fases.find(
    (fase) => normalizarEstado(fase.estado) === "en_progreso"
  );

  return abierta?.id ?? fases[0]?.id ?? "";
}

export function FaseSelect({
  id,
  fases,
  defaultValue,
}: {
  id: string;
  fases: FaseAdmin[];
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Fase</Label>
      <select
        className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
        defaultValue={defaultValue ?? faseSugerida(fases)}
        id={id}
        name="faseId"
        required
      >
        {fases.map((fase) => (
          <option key={fase.id} value={fase.id}>
            {fase.orden}. {fase.nombre} (
            {ETIQUETA_ESTADO[normalizarEstado(fase.estado)]})
          </option>
        ))}
      </select>
    </div>
  );
}

export function PreguntasField({
  id,
  defaultValue,
}: {
  id: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Preguntas guía</Label>
      <Textarea
        className="min-h-28 text-sm"
        defaultValue={defaultValue}
        id={id}
        name="preguntas"
        placeholder={PLACEHOLDER_PREGUNTAS}
        required
      />
      <p className="text-muted-foreground text-xs">
        Una por línea. El entrevistador de IA las usa como temas a cubrir, no
        las lee tal cual.
      </p>
    </div>
  );
}
