export const FRECUENCIAS_RECURRENCIA = [
  "ninguna",
  "diaria",
  "semanal",
  "quincenal",
  "mensual",
] as const;

export type FrecuenciaRecurrencia = (typeof FRECUENCIAS_RECURRENCIA)[number];

export function parseFrecuenciaRecurrencia(
  value: string
): FrecuenciaRecurrencia {
  for (const frecuencia of FRECUENCIAS_RECURRENCIA) {
    if (frecuencia === value) {
      return frecuencia;
    }
  }

  return "ninguna";
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OCURRENCIAS = 366;

function parseUtcDate(iso: string): Date | null {
  if (!FECHA_ISO.test(iso)) {
    return null;
  }

  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    return null;
  }

  return date;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function ocurrenciaEn(
  inicio: Date,
  frecuencia: Exclude<FrecuenciaRecurrencia, "ninguna">,
  index: number
): Date {
  switch (frecuencia) {
    case "diaria": {
      const date = new Date(inicio.getTime());
      date.setUTCDate(inicio.getUTCDate() + index);
      return date;
    }
    case "semanal": {
      const date = new Date(inicio.getTime());
      date.setUTCDate(inicio.getUTCDate() + index * 7);
      return date;
    }
    case "quincenal": {
      const date = new Date(inicio.getTime());
      date.setUTCDate(inicio.getUTCDate() + index * 14);
      return date;
    }
    case "mensual": {
      const day = inicio.getUTCDate();
      const month = inicio.getUTCMonth() + index;
      const lastDay = new Date(
        Date.UTC(inicio.getUTCFullYear(), month + 1, 0)
      ).getUTCDate();
      return new Date(
        Date.UTC(inicio.getUTCFullYear(), month, Math.min(day, lastDay))
      );
    }
    default: {
      throw new Error("Frecuencia de recurrencia no soportada.");
    }
  }
}

export function expandirFechasRecurrentes({
  inicio,
  hasta,
  frecuencia,
}: {
  inicio: string;
  hasta: string | null;
  frecuencia: FrecuenciaRecurrencia;
}): { ok: true; fechas: string[] } | { ok: false; message: string } {
  const fechaInicio = parseUtcDate(inicio);
  if (!fechaInicio) {
    return { message: "Fecha inválida.", ok: false };
  }

  if (frecuencia === "ninguna") {
    return { fechas: [inicio], ok: true };
  }

  if (!hasta) {
    return {
      message: "Indica hasta cuándo se repite la fecha.",
      ok: false,
    };
  }

  const fechaHasta = parseUtcDate(hasta);
  if (!fechaHasta) {
    return { message: "La fecha final es inválida.", ok: false };
  }

  if (hasta < inicio) {
    return {
      message: "La fecha final debe ser igual o posterior a la inicial.",
      ok: false,
    };
  }

  const fechas: string[] = [];
  let index = 0;

  while (index < MAX_OCURRENCIAS) {
    const ocurrencia = ocurrenciaEn(fechaInicio, frecuencia, index);
    if (ocurrencia.getTime() > fechaHasta.getTime()) {
      break;
    }

    fechas.push(formatUtcDate(ocurrencia));
    index += 1;
  }

  if (fechas.length === 0) {
    return { message: "No se generó ninguna fecha.", ok: false };
  }

  const siguiente = ocurrenciaEn(fechaInicio, frecuencia, fechas.length);
  if (siguiente.getTime() <= fechaHasta.getTime()) {
    return {
      message:
        "La serie tendría más de 366 fechas. Elige una fecha final más cercana.",
      ok: false,
    };
  }

  return { fechas, ok: true };
}
