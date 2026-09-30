import {
  parseSintesisConsulta,
  type SintesisConsulta,
} from "@/lib/consultoria/sintesis-consulta";

/**
 * Shape of what an interview leaves behind: the turn-by-turn transcript and
 * the structured summary the agent writes when it closes. Both live on
 * `entrevista` as jsonb, so everything here is defensive about parsing.
 */

export type RolTurno = "entrevistador" | "entrevistado";

export type ClaseTurnoAgente =
  | "principal"
  | "obligatoria"
  | "seguimiento"
  | "aclaracion";

export type TurnoEntrevista = {
  id: string;
  rol: RolTurno;
  texto: string;
  at: string;
  seccionId?: string | null;
  ofertaCierre?: boolean;
  /** Set on the interviewer's turn so obligatory questions do not spend the
   * optional follow-up cap. Absent on older transcripts. */
  clase?: ClaseTurnoAgente;
  indiceObligatoria?: number;
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

/**
 * `descripcion` is shown to the participant. `instrucciones`, `seguimientos`
 * and `obligatorias` only reach the agent. With `seguimientos`, `preguntas`
 * holds the main question and the follow-ups are an optional menu capped at
 * `MAX_SEGUIMIENTOS`. `obligatorias` are always asked, unless already
 * answered, and do not spend that cap. `etiquetaOrganizacion` chooses
 * "empresa" or the default "firma socia" in the agent prompt.
 */
export type EtiquetaOrganizacion = "empresa" | "firma";

export type SeccionEntrevista = {
  id: string;
  titulo: string;
  descripcion: string;
  preguntas: string[];
  instrucciones?: string;
  obligatorias?: string[];
  seguimientos?: string[];
  /** When set, follow-ups are a cap of substantive questions. A clarification
   * does not spend it. Absent means the shared cap of `MAX_SEGUIMIENTOS`. */
  maxSeguimientos?: number;
  etiquetaOrganizacion?: EtiquetaOrganizacion;
};

export const MAX_SEGUIMIENTOS = 2;

export type TratoEntrevista = "tu" | "usted";

/** Interview-level agent settings, copied into every assigned interview. */
export type ConduccionEntrevista = {
  instruccionesAgente: string;
  trato: TratoEntrevista;
};

export function parseTrato(value: unknown): TratoEntrevista {
  return value === "usted" ? "usted" : "tu";
}

/** Rules that belong to the agent. They must never reach a public text. */
const PATRONES_INSTRUCCION_INTERNA = [
  /pregunta principal/i,
  /seguimientos?/i,
  /como m[aá]ximo/i,
  /\bmen[uú]\b/i,
  /no explorado/i,
  /\b(haz|hazla|hazlos|elige|prioriza|interpretes|distingue|reg[ií]stralo|presupongas|di esto)\b/i,
  /\bsi no (menciona|explica|precisa|distingue|queda|identifica|aborda|eval[uú]a|concreta|aterriza|habla|describe)\b/i,
  /^\s*[-*•]\s/m,
];

export function contieneInstruccionesInternas(texto: string) {
  return PATRONES_INSTRUCCION_INTERNA.some((patron) => patron.test(texto));
}

const SEPARADOR_CONDICION = /:\s+(?=¿|[A-ZÁÉÍÓÚÑ])/;

/** "Si no menciona X: ¿Pregunta?" → condition and the question to ask. */
export function partirSeguimiento(seguimiento: string) {
  const match = SEPARADOR_CONDICION.exec(seguimiento);
  if (!match) {
    return { condicion: "", pregunta: seguimiento.trim() };
  }
  return {
    condicion: seguimiento.slice(0, match.index).trim(),
    pregunta: seguimiento.slice(match.index + match[0].length).trim(),
  };
}

/** What may travel to the participant's browser. */
export function seccionesPublicas(
  secciones: SeccionEntrevista[]
): SeccionEntrevista[] {
  return secciones.map(({ descripcion, id, preguntas, titulo }) => ({
    descripcion,
    id,
    preguntas,
    titulo,
  }));
}

export function seccionesConDescripcionInterna(secciones: SeccionEntrevista[]) {
  return secciones.filter((seccion) =>
    contieneInstruccionesInternas(seccion.descripcion)
  );
}

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
  /** Client consultation summary. Absent until it is saved after submit. */
  consulta?: SintesisConsulta;
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

    const {
      descripcion,
      etiquetaOrganizacion,
      id,
      instrucciones,
      maxSeguimientos,
      obligatorias,
      preguntas,
      seguimientos,
      titulo,
    } = item as Record<string, unknown>;
    const preguntasValidas = parsePreguntas(preguntas);
    const obligatoriasValidas = parsePreguntas(obligatorias);
    const seguimientosValidos = parsePreguntas(seguimientos);
    const instruccionesValidas =
      typeof instrucciones === "string" ? instrucciones.trim() : "";
    const maximoValido =
      typeof maxSeguimientos === "number" &&
      Number.isInteger(maxSeguimientos) &&
      maxSeguimientos > 0
        ? maxSeguimientos
        : undefined;

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
        ...(etiquetaOrganizacion === "empresa"
          ? { etiquetaOrganizacion: "empresa" as const }
          : {}),
        ...(instruccionesValidas
          ? { instrucciones: instruccionesValidas }
          : {}),
        ...(maximoValido ? { maxSeguimientos: maximoValido } : {}),
        ...(obligatoriasValidas.length > 0
          ? { obligatorias: obligatoriasValidas }
          : {}),
        preguntas: preguntasValidas,
        ...(seguimientosValidos.length > 0
          ? { seguimientos: seguimientosValidos }
          : {}),
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
    ...(seccion.etiquetaOrganizacion === "empresa"
      ? { etiquetaOrganizacion: "empresa" as const }
      : {}),
    ...(seccion.instrucciones ? { instrucciones: seccion.instrucciones } : {}),
    ...(seccion.maxSeguimientos
      ? { maxSeguimientos: seccion.maxSeguimientos }
      : {}),
    ...(seccion.obligatorias?.length
      ? { obligatorias: [...seccion.obligatorias] }
      : {}),
    preguntas: [...seccion.preguntas],
    ...(seccion.seguimientos?.length
      ? { seguimientos: [...seccion.seguimientos] }
      : {}),
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

    const {
      at,
      clase,
      id,
      indiceObligatoria,
      ofertaCierre,
      rol,
      seccionId,
      texto,
    } = item as Record<string, unknown>;

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
        ...(clase === "principal" ||
        clase === "obligatoria" ||
        clase === "seguimiento" ||
        clase === "aclaracion"
          ? { clase }
          : {}),
        ...(typeof indiceObligatoria === "number" &&
        Number.isInteger(indiceObligatoria) &&
        indiceObligatoria >= 0
          ? { indiceObligatoria }
          : {}),
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

  const { consulta, sintesis, hallazgos, respuestas } = value as Record<
    string,
    unknown
  >;
  const consultaGuardada = parseSintesisConsulta(consulta);

  return {
    ...(consultaGuardada ? { consulta: consultaGuardada } : {}),
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
  fase,
  fecha,
  turnos,
}: {
  nombre: string;
  firma: string | null;
  proyecto: string | null;
  fase?: string | null;
  fecha: string | null;
  turnos: TurnoEntrevista[];
}): ArchivoTranscripcion {
  const momento = fechaValida(fecha) ?? new Date();

  const metadatos = [
    `- **Fecha:** ${new Intl.DateTimeFormat("es", { dateStyle: "long" }).format(momento)}`,
    firma ? `- **Firma:** ${firma}` : null,
    proyecto ? `- **Proyecto:** ${proyecto}` : null,
    fase ? `- **Fase:** ${fase}` : null,
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
