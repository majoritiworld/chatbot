/**
 * Shape of what an interview leaves behind: the turn-by-turn transcript and
 * the structured summary the agent writes when it closes. Both live on
 * `entrevista` as jsonb, so everything here is defensive about parsing.
 */

export type RolTurno = "entrevistador" | "entrevistado";

export type TurnoEntrevista = {
  id: string;
  rol: RolTurno;
  texto: string;
  at: string;
  seccionId?: string | null;
  ofertaCierre?: boolean;
};

/** RPC append/complete reject empty texto. Silent close-offer turns use this
 * marker in JSON so they survive persistence without a spoken bubble. */
export const TEXTO_TURNO_SILENTE = "\u200b";

export function textoHabladoTurno(texto: string) {
  return texto.replaceAll(TEXTO_TURNO_SILENTE, "").trim();
}

export function serializarTurnosParaRpc(turnos: TurnoEntrevista[]) {
  return turnos.flatMap((turno) => {
    const hablado = textoHabladoTurno(turno.texto);
    if (hablado.length > 0) {
      return [
        {
          ...turno,
          texto: hablado,
        },
      ];
    }
    if (turno.ofertaCierre !== true) {
      return [];
    }
    return [
      {
        ...turno,
        ofertaCierre: true as const,
        texto: TEXTO_TURNO_SILENTE,
      },
    ];
  });
}

export type RespuestaResumen = {
  pregunta: string;
  respuesta_texto: string;
};

export type SeccionEntrevista = {
  id: string;
  titulo: string;
  descripcion: string;
  preguntas: string[];
};

export type FlujoEntrevista =
  | "bienvenida"
  | "presentacion"
  | "chat"
  | "revision";

export type SeccionCompletada = {
  seccionId: string;
  sintesis: string;
  hallazgos: string[];
  respuestas: RespuestaResumen[];
  completadaEn: string;
  modo: "agente" | "manual";
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

export function parseSecciones(value: unknown): SeccionEntrevista[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const { descripcion, id, preguntas, titulo } = item as Record<
      string,
      unknown
    >;
    const preguntasValidas = parsePreguntas(preguntas);

    if (
      typeof id !== "string" ||
      id.length === 0 ||
      typeof titulo !== "string" ||
      titulo.trim().length === 0 ||
      preguntasValidas.length === 0
    ) {
      return [];
    }

    return [
      {
        descripcion: typeof descripcion === "string" ? descripcion.trim() : "",
        id,
        preguntas: preguntasValidas,
        titulo: titulo.trim(),
      },
    ];
  });
}

export function preguntasDeSecciones(secciones: SeccionEntrevista[]): string[] {
  return secciones.flatMap((seccion) => seccion.preguntas);
}

export function clonarSecciones(
  secciones: SeccionEntrevista[]
): SeccionEntrevista[] {
  return secciones.map((seccion) => ({
    descripcion: seccion.descripcion,
    id: crypto.randomUUID(),
    preguntas: [...seccion.preguntas],
    titulo: seccion.titulo,
  }));
}

export function seccionesDesdeGuionPlano({
  titulo,
  descripcion = "",
  preguntas,
}: {
  titulo: string;
  descripcion?: string;
  preguntas: string[];
}): SeccionEntrevista[] {
  const preguntasValidas = parsePreguntas(preguntas);
  if (preguntasValidas.length === 0 || titulo.trim().length === 0) {
    return [];
  }

  return [
    {
      descripcion: descripcion.trim(),
      id: crypto.randomUUID(),
      preguntas: preguntasValidas,
      titulo: titulo.trim(),
    },
  ];
}

export function resolverAvanceSeccion(
  seccionActual: number,
  numeroSecciones: number
) {
  const siguienteIndice = seccionActual + 1;
  return {
    flujoEstado:
      siguienteIndice < numeroSecciones
        ? ("presentacion" as const)
        : ("revision" as const),
    seccionActual: siguienteIndice,
  };
}

export function haySeccionesPendientes(
  secciones: SeccionEntrevista[],
  completadas: SeccionCompletada[]
) {
  const completadasPorId = new Set(
    completadas.map((completada) => completada.seccionId)
  );
  return secciones.some((seccion) => !completadasPorId.has(seccion.id));
}

export function consolidarRespuestasEntrevista(
  secciones: SeccionEntrevista[],
  completadas: SeccionCompletada[]
): ResumenEntrevista {
  const completadasPorId = new Map(
    completadas.map((item) => [item.seccionId, item])
  );
  const respuestas = secciones.flatMap((seccion) => {
    const completada = completadasPorId.get(seccion.id);
    if (completada?.respuestas.length) {
      return completada.respuestas;
    }
    return seccion.preguntas.map((pregunta) => ({
      pregunta,
      respuesta_texto: "Ver transcripción completa.",
    }));
  });
  const hallazgos = secciones.flatMap(
    (seccion) => completadasPorId.get(seccion.id)?.hallazgos ?? []
  );
  const sintesisPorSeccion = secciones.flatMap((seccion) => {
    const sintesis = completadasPorId.get(seccion.id)?.sintesis.trim();
    return sintesis ? [`${seccion.titulo}: ${sintesis}`] : [];
  });

  return {
    hallazgos,
    respuestas,
    sintesis: sintesisPorSeccion.length
      ? sintesisPorSeccion.join("\n\n")
      : "Entrevista completada. Revisar la transcripción completa.",
  };
}

export function parseSeccionesCompletadas(value: unknown): SeccionCompletada[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const { completadaEn, hallazgos, modo, respuestas, seccionId, sintesis } =
      item as Record<string, unknown>;

    if (
      typeof seccionId !== "string" ||
      typeof sintesis !== "string" ||
      typeof completadaEn !== "string" ||
      (modo !== "agente" && modo !== "manual")
    ) {
      return [];
    }

    return [
      {
        completadaEn,
        hallazgos: Array.isArray(hallazgos)
          ? hallazgos.filter(
              (hallazgo): hallazgo is string => typeof hallazgo === "string"
            )
          : [],
        modo,
        respuestas: Array.isArray(respuestas)
          ? respuestas.flatMap((respuesta) => {
              if (typeof respuesta !== "object" || respuesta === null) {
                return [];
              }
              const { pregunta, respuesta_texto } = respuesta as Record<
                string,
                unknown
              >;
              return typeof pregunta === "string" &&
                typeof respuesta_texto === "string"
                ? [{ pregunta, respuesta_texto }]
                : [];
            })
          : [],
        seccionId,
        sintesis,
      },
    ];
  });
}

export function parseTranscripcion(value: unknown): TurnoEntrevista[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const { at, id, ofertaCierre, rol, seccionId, texto } = item as Record<
      string,
      unknown
    >;

    if (!(esRolTurno(rol) && typeof texto === "string")) {
      return [];
    }

    const hablado = textoHabladoTurno(texto);
    const oferta = ofertaCierre === true;
    if (hablado.length === 0 && !oferta) {
      return [];
    }

    return [
      {
        at: typeof at === "string" ? at : new Date(0).toISOString(),
        id:
          typeof id === "string" && id.length > 0
            ? id
            : `legacy-${index}-${typeof at === "string" ? at : "unknown"}`,
        ...(oferta ? { ofertaCierre: true } : {}),
        rol,
        seccionId: typeof seccionId === "string" ? seccionId : null,
        texto: hablado,
      },
    ];
  });
}

export function turnosDeSeccion(
  turnos: TurnoEntrevista[],
  seccionId: string,
  incluirLegacy = false
) {
  return turnos.filter(
    (turno) =>
      turno.seccionId === seccionId || (incluirLegacy && !turno.seccionId)
  );
}

export function ofertaCierreVigenteEnTurnos(
  turnos: TurnoEntrevista[],
  seccionId: string | null | undefined
) {
  if (!seccionId) {
    return false;
  }

  return turnos.some(
    (turno) => turno.ofertaCierre === true && turno.seccionId === seccionId
  );
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
  const vistos = new Set(previos.map((turno) => turno.id));
  const nuevos = entrantes.filter((turno) => !vistos.has(turno.id));

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

export function tituloTranscripcion(nombre: string) {
  return `Transcripción — ${nombre}`;
}

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

  const hablados = turnos.filter(
    (turno) => textoHabladoTurno(turno.texto).length > 0
  );
  const cuerpo =
    hablados.length === 0
      ? "_La entrevista no dejó turnos registrados._"
      : hablados
          .map(
            (turno) =>
              `**${ETIQUETA_ROL[turno.rol]}**\n\n${textoHabladoTurno(turno.texto)}`
          )
          .join("\n\n");

  return {
    content: `# ${tituloTranscripcion(nombre)}\n\n${metadatos.join("\n")}\n\n---\n\n${cuerpo}\n`,
    filename: `transcripcion-${slug(nombre)}-${momento.toISOString().slice(0, 10)}.md`,
  };
}
