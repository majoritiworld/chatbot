/**
 * Shape of what an interview leaves behind: the turn-by-turn transcript and
 * the structured summary the agent writes when it closes. Both live on
 * `entrevista` as jsonb, so everything here is defensive about parsing.
 */

export type RolTurno = "entrevistador" | "entrevistado";

export type TurnoEntrevista = {
  rol: RolTurno;
  texto: string;
  at: string;
};

export type RespuestaResumen = {
  pregunta: string;
  respuesta_texto: string;
};

export type ResumenEntrevista = {
  sintesis: string;
  hallazgos: string[];
  respuestas: RespuestaResumen[];
};

export const RESUMEN_VACIO: ResumenEntrevista = {
  hallazgos: [],
  respuestas: [],
  sintesis: "",
};

function esRolTurno(value: unknown): value is RolTurno {
  return value === "entrevistador" || value === "entrevistado";
}

export function parsePreguntas(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
}

export function parseTranscripcion(value: unknown): TurnoEntrevista[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const { rol, texto, at } = item as Record<string, unknown>;

    if (!(esRolTurno(rol) && typeof texto === "string") || texto.length === 0) {
      return [];
    }

    return [
      {
        at: typeof at === "string" ? at : new Date(0).toISOString(),
        rol,
        texto,
      },
    ];
  });
}

export function parseResumen(value: unknown): ResumenEntrevista | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const { sintesis, hallazgos, respuestas } = value as Record<string, unknown>;

  return {
    hallazgos: Array.isArray(hallazgos)
      ? hallazgos.filter((item): item is string => typeof item === "string")
      : [],
    respuestas: Array.isArray(respuestas)
      ? respuestas.flatMap((item) => {
          if (typeof item !== "object" || item === null) {
            return [];
          }
          const { pregunta, respuesta_texto } = item as Record<string, unknown>;
          return typeof pregunta === "string" &&
            typeof respuesta_texto === "string"
            ? [{ pregunta, respuesta_texto }]
            : [];
        })
      : [],
    sintesis: typeof sintesis === "string" ? sintesis : "",
  };
}

/**
 * A reload wipes the browser-side message list, so an incoming batch is not
 * authoritative about what came before. Keep everything already stored and
 * append only turns we have never seen.
 */
export function fusionarTurnos(
  previos: TurnoEntrevista[],
  entrantes: TurnoEntrevista[]
): TurnoEntrevista[] {
  const vistos = new Set(previos.map((turno) => `${turno.rol}::${turno.texto}`));
  const nuevos = entrantes.filter(
    (turno) => !vistos.has(`${turno.rol}::${turno.texto}`)
  );

  return nuevos.length > 0 ? [...previos, ...nuevos] : previos;
}

const ETIQUETA_ROL: Record<RolTurno, string> = {
  entrevistado: "Entrevistado",
  entrevistador: "Entrevistador",
};

const DIACRITICOS = /[\u0300-\u036f]/g;
const NO_ALFANUMERICO = /[^a-z0-9]+/g;
const GUIONES_EXTREMOS = /^-+|-+$/g;

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .replace(NO_ALFANUMERICO, "-")
    .replace(GUIONES_EXTREMOS, "");
}

function fechaValida(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type ArchivoTranscripcion = {
  filename: string;
  content: string;
};

/**
 * Turns are stored in arrival order, so the array is already chronological;
 * `at` is unreliable for sorting because older rows default to the epoch.
 */
export function construirArchivoTranscripcion({
  nombre,
  firma,
  proyecto,
  fecha,
  turnos,
}: {
  nombre: string;
  firma: string | null;
  proyecto: string | null;
  fecha: string | null;
  turnos: TurnoEntrevista[];
}): ArchivoTranscripcion {
  const momento = fechaValida(fecha) ?? new Date();

  const metadatos = [
    `- **Fecha:** ${new Intl.DateTimeFormat("es", { dateStyle: "long" }).format(momento)}`,
    firma ? `- **Firma:** ${firma}` : null,
    proyecto ? `- **Proyecto:** ${proyecto}` : null,
  ].filter(Boolean);

  const cuerpo =
    turnos.length === 0
      ? "_La entrevista no dejó turnos registrados._"
      : turnos
          .map(
            (turno) => `**${ETIQUETA_ROL[turno.rol]}**\n\n${turno.texto.trim()}`
          )
          .join("\n\n");

  return {
    content: `# Transcripción — ${nombre}\n\n${metadatos.join("\n")}\n\n---\n\n${cuerpo}\n`,
    filename: `transcripcion-${slug(nombre)}-${momento.toISOString().slice(0, 10)}.md`,
  };
}
