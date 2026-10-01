import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";
import {
  type LecturaRespuesta,
  lecturaHeuristica,
  tipoEvidente,
} from "@/lib/consultoria/lectura-respuesta";
import type { MotivoCierreSeccion } from "@/lib/consultoria/seguimientos-sustantivos";
import {
  esElogioDeLaPregunta,
  esIncomprension,
  esNoSabe,
  esRenunciaAProfundizar,
  normalizarRespuesta,
} from "@/lib/consultoria/seguimientos-sustantivos";
import type { ChatMessage } from "@/lib/types";

const PALABRAS_VACIAS = new Set([
  "ahora",
  "algun",
  "alguna",
  "alguno",
  "antes",
  "como",
  "con",
  "cuando",
  "desde",
  "despues",
  "donde",
  "durante",
  "esta",
  "este",
  "esto",
  "hasta",
  "para",
  "porque",
  "pueda",
  "puede",
  "seria",
  "sobre",
  "solo",
  "tener",
  "tiene",
]);

const ADJETIVOS_VAGOS = new Set([
  "bien",
  "buena",
  "bueno",
  "cosas",
  "depende",
  "interesante",
  "mal",
  "mala",
  "mas",
  "menos",
  "normal",
  "okay",
  "regular",
  "varias",
]);

const SOLO_EVALUACION =
  /^(fue |estuvo |era |es )?(bien|mal|regular|normal|ok|okay|interesante|mas o menos|bueno|buena|de todo|varias cosas|depende|algo)$/;

const AUSENCIA =
  /\b(no participe|no fui|no asist[ií]|no hubo|no tuvimos|no tuve|no consegui|no encajo|no aporte|no sirvio|no paso nada|ningun|ninguna|sin resultados|no obtuve)\b/;

const HECHO_BREVE =
  /\b(no|nunca|sin|queria|buscaba|esperaba|logre|logramos|falle|fallo|falto)\b/;

/** A short reply can still be enough. Follow up only when it stays vague. */
export function esRespuestaVaga(texto: string) {
  const normal = normalizarRespuesta(texto);
  if (!normal || SOLO_EVALUACION.test(normal)) {
    return true;
  }
  if (AUSENCIA.test(normal)) {
    return false;
  }
  const contenido = normal
    .split(" ")
    .filter(
      (token) =>
        token.length >= 5 &&
        !PALABRAS_VACIAS.has(token) &&
        !ADJETIVOS_VAGOS.has(token)
    );
  if (contenido.length >= 2) {
    return false;
  }
  return !(contenido.length === 1 && HECHO_BREVE.test(normal));
}

/** "No participé" without saying in what. Worth one clarification. */
const NO_PARTICIPO_AMBIGUO =
  /^(yo )?(no|nunca) (participe|participamos|fui|fuimos|asisti|asistimos|estuve|estuvimos|vine|vinimos|llegue|pude ir|pude asistir|pude participar)( (en eso|en esto|al evento|en el evento))?$/;

const SIN_ACTIVIDAD =
  /\b(no|nunca) (tuve|tuvimos|hubo|recibi|di|hice|tuvo|hicimos|pude tener|llegue a tener|alcance a tener)( la| una| mi| el| ningun| ninguna)? (mentoria|mentor|mentora|mentoreado|mentoreada|sesion|reunion)\b|\b(no|nunca) (participe|participamos|estuve|estuvimos|asisti|asistimos|llegue|llegamos) (en|a|al)( la| una| mi| el)? ?(mentoria|sesion|evento)\b|\b(sin|no hubo|nunca hubo) (mentoria|sesion|mentor|mentora)\b|\bno me (toco|asignaron) (mentor|mentora|mentoreado|mentoreada)\b/;

const CONFIRMA =
  /^(si|sii|exacto|exactamente|correcto|asi es|eso|eso es|tal cual|efectivamente|claro|ninguna|ninguno)\b/;

function palabras(texto: string) {
  return normalizarRespuesta(texto).split(" ").filter(Boolean).length;
}

function esOmision(texto: string) {
  const normal = normalizarRespuesta(texto);
  return /no quiero responder|prefiero no responder|no voy a responder|no deseo responder/.test(
    normal
  );
}

/** How the next turn listens to the last reply. Listening mode only. */
export type GuiaEscucha = {
  /** What the person took part in, so an easier entry does not assume another activity. */
  actividad?: string;
  /** Words of the reply to connect to. */
  foco?: string;
  /** Repair turn: invite to finish a story, or make the question easier. */
  reparacion?: "completar" | "facilitar";
  /** Repairs already spent on this objective before this one. */
  reparacionesPrevias?: number;
  /** Before the next question: let the point go, or acknowledge what went wrong. */
  transicion?: "sin_presion" | "reconocer";
  ultimaRespuesta: string;
};

/** Substantive follow-ups per objective in listening mode. */
export const MAX_SEGUIMIENTOS_ESCUCHA = 1;
/** Repairs per objective in listening mode; they do not spend the follow-up. */
export const MAX_REPARACIONES_ESCUCHA = 2;

type PlanContinuo = {
  clase: "obligatoria" | "seguimiento" | "cierre" | "aclaracion";
  escucha?: GuiaEscucha;
  forzarOferta: boolean;
  formulacionLibre?: boolean;
  /** Replaces the generic guidance for this turn. */
  guiaTurno?: string;
  indiceObligatoria?: number;
  motivoCierre?: MotivoCierreSeccion;
  seguimientoSiguiente?: string;
  seguimientosHechos: number;
};

export function esConversacionContinua(
  seccion: Pick<SeccionEntrevista, "conversacionContinua"> | undefined
) {
  return seccion?.conversacionContinua === true;
}

function textoMensaje(message: ChatMessage) {
  return (message.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}

function tokensPropios(pregunta: string) {
  return normalizarRespuesta(pregunta)
    .split(" ")
    .filter((token) => token.length >= 5 && !PALABRAS_VACIAS.has(token));
}

/** A later objective already answered in the person's own words. */
export function objetivoYaCubierto({
  dicho,
  pregunta,
  previas,
}: {
  dicho: string;
  pregunta: string;
  previas: string[];
}) {
  const propios = new Set(tokensPropios(pregunta));
  for (const previa of previas) {
    for (const token of tokensPropios(previa)) {
      propios.delete(token);
    }
  }
  if (propios.size < 2) {
    return false;
  }
  const texto = normalizarRespuesta(dicho);
  let coincidencias = 0;
  for (const token of propios) {
    if (texto.includes(token)) {
      coincidencias += 1;
    }
  }
  return coincidencias >= 2;
}

function indiceDe(message: ChatMessage) {
  const indice = message.metadata?.indiceObligatoria;
  return typeof indice === "number" ? indice : null;
}

function ultimoObjetivo(messages: ChatMessage[]) {
  for (const message of [...messages].reverse()) {
    if (message.role !== "assistant") {
      continue;
    }
    const indice = indiceDe(message);
    if (indice !== null) {
      return indice;
    }
  }
  return null;
}

function aclaracionesDelObjetivo(messages: ChatMessage[], indice: number) {
  let total = 0;
  for (const message of messages) {
    if (
      message.role === "assistant" &&
      message.metadata?.clase === "aclaracion" &&
      indiceDe(message) === indice
    ) {
      total += 1;
    }
  }
  return total;
}

function seguimientosDelObjetivo(messages: ChatMessage[], indice: number) {
  return messages.filter(
    (message) =>
      message.role === "assistant" &&
      message.metadata?.clase === "seguimiento" &&
      indiceDe(message) === indice
  ).length;
}

/** Objective the conversation is on: the last one the agent asked about. */
export function objetivoActivo(messages: ChatMessage[]) {
  return ultimoObjetivo(messages) ?? 0;
}

function seguimientoYaRespondido(messages: ChatMessage[], indice: number) {
  let espera = false;
  for (const message of messages) {
    if (message.role === "assistant") {
      espera =
        message.metadata?.clase === "seguimiento" &&
        indiceDe(message) === indice;
      continue;
    }
    if (!espera || message.role !== "user") {
      continue;
    }
    const texto = textoMensaje(message);
    if (
      texto.length > 0 &&
      !esIncomprension(texto) &&
      !esElogioDeLaPregunta(texto)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * True once the person said they did not take part in the activity, either
 * outright or by confirming the clarification about a bare "no participé".
 */
function sinExperienciaConfirmada(messages: ChatMessage[]) {
  let previoUsuario = "";
  let ultimoAsistente: ChatMessage | undefined;
  for (const message of messages) {
    if (message.role === "assistant") {
      ultimoAsistente = message;
      continue;
    }
    if (message.role !== "user") {
      continue;
    }
    const normal = normalizarRespuesta(textoMensaje(message));
    if (SIN_ACTIVIDAD.test(normal)) {
      return true;
    }
    const respondeAclaracion =
      ultimoAsistente?.metadata?.clase === "aclaracion" &&
      NO_PARTICIPO_AMBIGUO.test(previoUsuario);
    if (respondeAclaracion && CONFIRMA.test(normal)) {
      return true;
    }
    previoUsuario = normal;
  }
  return false;
}

function guiaAclararParticipacion(actividad: string) {
  return `La persona dijo que no participó, pero no queda claro en qué. Pregunta en una sola frase si se refiere a que no tuvo ${actividad}. No supongas el motivo ni hagas otra pregunta.`;
}

function guiaExplorarAusencia(actividad: string) {
  return `La persona no tuvo ${actividad}. Pregunta brevemente qué lo impidió, sin suponer culpa ni insistir. No preguntes por una experiencia que no tuvo.`;
}

function guiaSinExperiencia(actividad: string) {
  return `La persona no tuvo ${actividad}. Los temas que lo requerían no aplican: no los des por respondidos ni inventes cómo habrían sido.`;
}

function dichoPorLaPersona(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => textoMensaje(message))
    .filter((texto) => texto.length > 0)
    .join("\n");
}

/**
 * Five information objectives in one chat. A follow-up is optional and
 * happens only when the reply is vague. At most one per objective.
 * A clarification does not spend that follow-up and is not followed by a
 * second probe of the same point.
 */
export function planificarConversacionContinua({
  lectura,
  messages,
  seccion,
}: {
  /** Reader's view of the last reply. Listening mode only. */
  lectura?: LecturaRespuesta;
  messages: ChatMessage[];
  seccion: SeccionEntrevista;
}): PlanContinuo {
  const objetivos = seccion.preguntas;
  const ultimoUsuario = messages.findLast((message) => message.role === "user");
  const texto = ultimoUsuario ? textoMensaje(ultimoUsuario) : "";
  const hayRespuesta = messages.some(
    (message) => message.role === "user" && textoMensaje(message).length > 0
  );

  if (!hayRespuesta) {
    return {
      clase: "obligatoria",
      forzarOferta: false,
      indiceObligatoria: 0,
      seguimientoSiguiente: objetivos[0],
      seguimientosHechos: 0,
    };
  }

  const activo = ultimoObjetivo(messages) ?? 0;
  const aclaraciones = aclaracionesDelObjetivo(messages, activo);
  const yaProfundizo = seguimientoYaRespondido(messages, activo);
  const actividad = seccion.actividad ?? "esa actividad";
  const conExperiencia = new Set(seccion.requierenExperiencia ?? []);
  const sinExperiencia =
    conExperiencia.size > 0 && sinExperienciaConfirmada(messages);
  const omitir = sinExperiencia ? conExperiencia : new Set<number>();
  const base = {
    dicho: dichoPorLaPersona(messages),
    guiaCierre: sinExperiencia ? guiaSinExperiencia(actividad) : undefined,
    objetivos,
    omitir,
  };
  const normal = normalizarRespuesta(texto);

  if (
    conExperiencia.size > 0 &&
    !sinExperiencia &&
    NO_PARTICIPO_AMBIGUO.test(normal)
  ) {
    if (aclaraciones === 0 && !yaProfundizo) {
      return {
        clase: "aclaracion",
        forzarOferta: false,
        guiaTurno: guiaAclararParticipacion(actividad),
        indiceObligatoria: activo,
        seguimientosHechos: 0,
      };
    }
    return avanzar({
      ...base,
      desde: activo,
      guiaCierre: guiaSinExperiencia(actividad),
      motivo: "limite",
      omitir: conExperiencia,
    });
  }

  if (
    sinExperiencia &&
    SIN_ACTIVIDAD.test(normal) &&
    aclaraciones === 0 &&
    !yaProfundizo &&
    palabras(texto) <= 8
  ) {
    return {
      clase: "seguimiento",
      formulacionLibre: true,
      forzarOferta: false,
      guiaTurno: guiaExplorarAusencia(actividad),
      indiceObligatoria: activo,
      seguimientosHechos: 0,
    };
  }

  const confirmaAusencia =
    sinExperiencia &&
    CONFIRMA.test(normal) &&
    messages.findLast((message) => message.role === "assistant")?.metadata
      ?.clase === "aclaracion";
  if (confirmaAusencia || (sinExperiencia && SIN_ACTIVIDAD.test(normal))) {
    return avanzar({ ...base, desde: activo, motivo: "suficiente" });
  }

  if (seccion.escucha) {
    return planificarConEscucha({
      actividad: seccion.actividad,
      activo,
      base,
      lectura,
      messages,
      texto,
    });
  }

  if (esIncomprension(texto) || esElogioDeLaPregunta(texto)) {
    if (aclaraciones >= 1) {
      return avanzar({ ...base, desde: activo, motivo: "sin_comprension" });
    }
    return {
      clase: "aclaracion",
      forzarOferta: false,
      indiceObligatoria: activo,
      seguimientoSiguiente: objetivos[activo],
      seguimientosHechos: yaProfundizo ? 1 : 0,
    };
  }

  if (esNoSabe(texto) || esRenunciaAProfundizar(texto) || esOmision(texto)) {
    return avanzar({
      ...base,
      desde: activo,
      motivo: esNoSabe(texto) ? "no_sabe" : "no_profundizar",
    });
  }

  if (yaProfundizo || aclaraciones >= 1 || !esRespuestaVaga(texto)) {
    return avanzar({
      ...base,
      desde: activo,
      motivo: yaProfundizo ? "limite" : "suficiente",
    });
  }

  return {
    clase: "seguimiento",
    formulacionLibre: true,
    forzarOferta: false,
    indiceObligatoria: activo,
    seguimientosHechos: 0,
  };
}

/**
 * Each reply is read before choosing the turn. Finishing a story or making a
 * hard question easier are repairs: up to two per objective, and they do not
 * spend its single substantive follow-up. Not remembering or passing moves on
 * without pressing. An answer given during a repair can cover the objective.
 */
function planificarConEscucha({
  activo,
  actividad,
  base,
  lectura,
  messages,
  texto,
}: {
  activo: number;
  actividad?: string;
  base: {
    dicho: string;
    guiaCierre?: string;
    objetivos: string[];
    omitir: Set<number>;
  };
  /** Absent when the reader failed: heuristics and keyword coverage. */
  lectura: LecturaRespuesta | undefined;
  messages: ChatMessage[];
  texto: string;
}): PlanContinuo {
  const reparaciones = aclaracionesDelObjetivo(messages, activo);
  const seguimientos = seguimientosDelObjetivo(messages, activo);
  const leida = conTipoEvidente(
    lectura ??
      lecturaHeuristica({
        texto,
        vaga: reparaciones === 0 && esRespuestaVaga(texto),
      }),
    texto
  );
  const foco = leida.foco ? { foco: leida.foco } : {};
  const siguiente = {
    ...base,
    ...(lectura ? { cubiertos: new Set(lectura.cubiertos) } : {}),
    desde: activo,
  };

  switch (leida.tipo) {
    case "por_completar":
    case "dificultad": {
      if (reparaciones >= MAX_REPARACIONES_ESCUCHA) {
        return avanzar({
          ...siguiente,
          escucha: { transicion: "sin_presion", ultimaRespuesta: texto },
          motivo: "sin_comprension",
        });
      }
      return {
        clase: "aclaracion",
        escucha: {
          ...foco,
          ...(actividad ? { actividad } : {}),
          reparacion:
            leida.tipo === "por_completar" ? "completar" : "facilitar",
          reparacionesPrevias: reparaciones,
          ultimaRespuesta: texto,
        },
        forzarOferta: false,
        indiceObligatoria: activo,
        seguimientoSiguiente: base.objetivos[activo],
        seguimientosHechos: seguimientos,
      };
    }
    case "no_recuerda":
    case "no_quiere":
      return avanzar({
        ...siguiente,
        escucha: { transicion: "sin_presion", ultimaRespuesta: texto },
        motivo: leida.tipo === "no_recuerda" ? "no_sabe" : "no_profundizar",
      });
    default:
      break;
  }

  if (leida.profundizar && seguimientos < MAX_SEGUIMIENTOS_ESCUCHA) {
    return {
      clase: "seguimiento",
      escucha: { ...foco, ultimaRespuesta: texto },
      formulacionLibre: true,
      forzarOferta: false,
      indiceObligatoria: activo,
      seguimientoSiguiente: base.objetivos[activo],
      seguimientosHechos: seguimientos,
    };
  }
  return avanzar({
    ...siguiente,
    escucha: {
      ...foco,
      ...(leida.negativa ? { transicion: "reconocer" as const } : {}),
      ultimaRespuesta: texto,
    },
    motivo: seguimientos > 0 ? "limite" : "suficiente",
  });
}

function conTipoEvidente(
  lectura: LecturaRespuesta,
  texto: string
): LecturaRespuesta {
  const evidente = tipoEvidente(texto);
  if (!evidente || evidente === lectura.tipo) {
    return lectura;
  }
  return { ...lectura, profundizar: false, tipo: evidente };
}

function avanzar({
  cubiertos,
  desde,
  dicho,
  escucha,
  guiaCierre,
  motivo,
  objetivos,
  omitir,
}: {
  /** Reader's covered objectives. Replaces the keyword match when present. */
  cubiertos?: Set<number>;
  desde: number;
  dicho: string;
  escucha?: GuiaEscucha;
  guiaCierre?: string;
  motivo: MotivoCierreSeccion | undefined;
  objetivos: string[];
  omitir: Set<number>;
}): PlanContinuo {
  const previas = objetivos.slice(0, desde + 1);
  const yaCubierto = (indice: number) =>
    cubiertos
      ? cubiertos.has(indice)
      : objetivoYaCubierto({
          dicho,
          pregunta: objetivos[indice] ?? "",
          previas,
        });
  let siguiente = desde + 1;
  while (
    siguiente < objetivos.length &&
    (omitir.has(siguiente) || yaCubierto(siguiente))
  ) {
    previas.push(objetivos[siguiente] ?? "");
    siguiente += 1;
  }

  if (siguiente >= objetivos.length) {
    return {
      clase: "cierre",
      ...(escucha ? { escucha } : {}),
      forzarOferta: true,
      ...(guiaCierre ? { guiaTurno: guiaCierre } : {}),
      motivoCierre: motivo,
      seguimientosHechos: motivo === "limite" ? 1 : 0,
    };
  }

  return {
    clase: "obligatoria",
    ...(escucha ? { escucha } : {}),
    forzarOferta: false,
    ...(guiaCierre && omitir.size > 0
      ? {
          guiaTurno: `${guiaCierre} La pregunta de este turno sí aplica: hazla sin cambiar su tema.`,
        }
      : {}),
    indiceObligatoria: siguiente,
    seguimientoSiguiente: objetivos[siguiente],
    seguimientosHechos: 0,
  };
}

function citar(texto: string) {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > 280 ? `${limpio.slice(0, 280)}…` : limpio;
}

const NO_INVENTES =
  "No sugieras una respuesta, no presupongas que hubo problemas ni un resultado positivo, y no atribuyas emociones que la persona no expresó.";

function transicionEscucha(escucha: GuiaEscucha) {
  if (escucha.transicion === "sin_presion") {
    return `La persona no recuerda, no sabe o prefiere no seguir con el punto anterior («${citar(escucha.ultimaRespuesta)}»). Empieza reconociéndolo en pocas palabras y sin presión, por ejemplo «No pasa nada, podemos dejar ese punto.», y no vuelvas sobre él.`;
  }
  if (escucha.transicion === "reconocer") {
    return `La persona expresó malestar por algo que ocurrió («${citar(escucha.ultimaRespuesta)}»). Empieza con una frase muy breve, de ocho palabras como máximo, que lo reconozca sin repetir ni resumir lo que dijo, sin frases de empatía genéricas y sin añadir emociones que no nombró. Por ejemplo, para otra situación: «Eso complicó la sesión.»`;
  }
  return "Si ayuda, empieza con una transición de pocas palabras que conecte con algo concreto que dijo. No repitas, resumas ni parafrasees su respuesta, y no la elogies ni la valores (nada de «suena clave», «qué interesante» o «muy valioso»).";
}

/** Turn guidance when the plan comes from reading the reply. */
function guiaConEscucha({
  ejemploSeguimiento,
  escucha,
  preguntaActual,
  todaviaNo,
  turno,
}: {
  ejemploSeguimiento?: string;
  escucha: GuiaEscucha;
  preguntaActual?: string;
  todaviaNo: string;
  turno: "objetivo" | "seguimiento" | "aclaracion" | "cierre";
}) {
  const ultima = `Última respuesta de la persona: «${citar(escucha.ultimaRespuesta)}».`;
  const foco = escucha.foco
    ? ` Conecta con esto que dijo: «${escucha.foco}».`
    : "";
  if (turno === "objetivo" && preguntaActual) {
    return `Pregunta para este turno: ${preguntaActual}
${transicionEscucha(escucha)}
Luego haz esa pregunta completa. Puedes ajustar unas pocas palabras para que suene natural, pero conserva sus palabras clave y lo que pregunta: la conexión con lo dicho va antes y no reemplaza la pregunta. ${todaviaNo}`;
  }
  if (turno === "aclaracion" && escucha.reparacion === "completar") {
    return `${ultima}
La persona anunció algo pero todavía no lo contó. Invítala a contarlo con una pregunta corta y abierta sobre eso mismo, por ejemplo «Cuéntame, ¿qué pasó en ese momento?».${foco} No cambies de tema ni añadas otra pregunta. ${NO_INVENTES} ${todaviaNo}`;
  }
  if (turno === "aclaracion") {
    const otraVez =
      (escucha.reparacionesPrevias ?? 0) > 0
        ? " Ya intentaste ayudar una vez: prueba otra entrada distinta al mismo tema, sin pasar a otra pregunta, y dile que también puede dejar este punto si prefiere."
        : "";
    return `${ultima}
La pregunta «${preguntaActual ?? ""}» le resultó difícil o no quedó clara. Sigue en ese mismo tema. No la repitas cambiando dos palabras. Hazla más fácil de empezar achicando el foco, no proponiendo respuestas: que piense en un momento o una parte concreta y cuente, con sus palabras, eso mismo que pregunta la pregunta original. Conserva el tema y su palabra clave; un «¿qué pasó ahí?» sin el tema no basta. Estilo de referencia, para una pregunta sobre dificultades: «Podemos ir por partes: si piensas en un momento puntual de ${escucha.actividad ?? "tu experiencia"}, ¿qué fue lo que más te costó ahí?».${escucha.actividad ? ` Lo que esta persona vivió es ${escucha.actividad}; no hables de otra actividad.` : ""} No copies ese ejemplo: crea la entrada para esta pregunta. No ofrezcas opciones ni ejemplos de respuesta, no nombres causas, carencias ni problemas que la persona no mencionó, no supongas actividades, personas o detalles que no están en la pregunta ni en lo que dijo, y no la conviertas en una pregunta de sí o no.${otraVez} Una sola pregunta corta y abierta. ${NO_INVENTES} ${todaviaNo}`;
  }
  if (turno === "seguimiento") {
    return `${ultima}
Objetivo de este punto: ${preguntaActual ?? ""}
Haz una sola pregunta concreta sobre lo que acaba de decir, no sobre la experiencia en general.${foco} Pide qué fue, cómo se notó, un ejemplo o por qué, usando sus palabras. Referencia de la pauta, solo si encaja: ${ejemploSeguimiento ?? "(ninguna)"}. ${NO_INVENTES} ${todaviaNo}`;
  }
  return "";
}

export function promptConversacionContinua({
  ejemploSeguimiento,
  escucha,
  guiaTurno,
  instrucciones,
  motivoCierre,
  nombre,
  organizacion,
  preguntaActual,
  trato,
  turno,
}: {
  ejemploSeguimiento?: string;
  escucha?: GuiaEscucha;
  guiaTurno?: string;
  instrucciones?: string;
  motivoCierre?: MotivoCierreSeccion;
  nombre?: string | null;
  organizacion?: string | null;
  preguntaActual?: string;
  trato: "tu" | "usted";
  turno: "objetivo" | "seguimiento" | "aclaracion" | "cierre";
}) {
  const persona = nombre?.trim()
    ? `La persona se llama ${nombre.trim()}.${organizacion?.trim() ? ` Su organización es ${organizacion.trim()}.` : ""}`
    : "No tienes el nombre de la persona.";
  const tratoLinea =
    trato === "usted"
      ? "Trata de usted, con cercanía profesional."
      : "Trata de tú, con cercanía profesional.";
  const todaviaNo =
    "Este turno no cierra la entrevista. Prohibido: agradecer, decir perfecto, genial o entiendo, contar objetivos, decir que ya está completo o que puede enviar la entrevista.";
  let guia = `Haz solo la primera pregunta, completa, sin explicar antes de qué se trata. ${todaviaNo}`;
  if (turno === "objetivo" && preguntaActual) {
    guia = `Pregunta para este turno: ${preguntaActual}
Escribe esa pregunta tal como está. Solo puedes cambiar unas pocas palabras para que suene natural; conserva sus palabras clave y lo que pregunta. No la reemplaces por otra pregunta ni preguntes por otro momento o tema. Si la persona ya contó parte de eso, nómbralo en una frase breve y luego haz la pregunta. ${todaviaNo}`;
  } else if (turno === "aclaracion" && preguntaActual) {
    guia = `La persona no entendió o solo elogió la pregunta. Reformúlala en una frase concreta, sin una segunda profundización. Pregunta para este turno: ${preguntaActual}
${todaviaNo}`;
  } else if (turno === "seguimiento") {
    guia = `Ejemplos de seguimiento (referencia, no un menú ni una frase obligatoria): ${ejemploSeguimiento ?? "pide un dato concreto de lo que acaba de contar"}
Formula una sola pregunta a partir de lo que acaba de decir, dentro de ese objetivo. No copies el ejemplo si no corresponde. No presupongas un resultado positivo, un contacto ni un beneficio. ${todaviaNo}`;
  } else if (turno === "cierre") {
    const limite =
      motivoCierre === "limite"
        ? "Se agotó el seguimiento de este punto. No digas que la información ya es suficiente."
        : "No anuncies que la información es suficiente si solo se acabó el cupo.";
    guia = `${limite} NO hagas ninguna pregunta. Agradece en una frase y dile que puede enviar la entrevista con el botón Enviar entrevista.`;
  }
  const conEscucha = escucha
    ? guiaConEscucha({
        ejemploSeguimiento,
        escucha,
        preguntaActual,
        todaviaNo,
        turno,
      })
    : "";
  if (conEscucha) {
    guia = conEscucha;
  } else if (escucha?.transicion && turno === "cierre") {
    guia = `${transicionEscucha(escucha)} ${guia}`;
  }
  if (guiaTurno && (turno === "cierre" || turno === "objetivo")) {
    guia = `${guiaTurno} ${guia}`;
  } else if (guiaTurno) {
    guia = `${guiaTurno} ${todaviaNo}`;
  }

  let cierreDeTurno =
    turno === "cierre"
      ? ""
      : "Última regla, por encima de todo lo anterior: una sola pregunta. No agradezcas. No digas que puede enviar la entrevista ni que ya terminó.";
  if (turno === "aclaracion" && escucha?.reparacion === "facilitar") {
    cierreDeTurno = `${cierreDeTurno} Este turno sigue en el tema de «${preguntaActual ?? ""}»: la entrada nueva debe llevar a responder eso mismo, no a otra pregunta de la entrevista. Es una pregunta abierta: sin listas de opciones («¿fue X, Y o algo así?») y sin causas o ejemplos de respuesta que la persona no dijo.`;
  }
  if (turno === "objetivo" && preguntaActual && (escucha || !guiaTurno)) {
    cierreDeTurno = escucha
      ? `${cierreDeTurno} La pregunta de este turno es «${preguntaActual}». Si la conectas con lo dicho, nombra un detalle concreto de su respuesta dentro de la misma pregunta, sin una frase suelta antes ni fórmulas genéricas como «eso que contaste» y sin valorar lo que dijo: nada de «clave», «interesante» ni «valioso».`
      : `${cierreDeTurno} La pregunta de este turno es «${preguntaActual}». Hazla con esas palabras clave y sobre ese mismo asunto.`;
  }
  return [
    "Eres quien conduce una sola conversación de Majoriti para ETM Tuesday.",
    persona,
    tratoLinea,
    "Es un único chat. No hay pantallas de tema, números de sección ni cierres intermedios.",
    "Una pregunta por turno. Distingue lo que ya ocurrió, lo que la persona espera y lo que haría después.",
    "Escribe en español neutro de Chile: nunca uses «vosotros», «os», formas de España ni voseo («recordás», «tenés»).",
    "Si no sabe, no recuerda o no quiere responder, respétalo y sigue. No inventes datos para llenar un vacío.",
    "No repitas «entiendo», «perfecto» ni parafrasees cada respuesta.",
    "Las preguntas son abiertas. Puedes adaptar la redacción al contexto, pero conserva su sentido y su formato. Nunca pidas una nota, una puntuación, una escala (por ejemplo del 1 al 10) ni una recomendación numérica.",
    guia,
    instrucciones?.trim()
      ? `Instrucciones internas, nunca las cites:\n${instrucciones.trim()}`
      : "",
    cierreDeTurno,
  ]
    .filter((linea) => linea.length > 0)
    .join("\n\n");
}

export function turnoDeClase(
  clase: string
): "objetivo" | "seguimiento" | "aclaracion" | "cierre" {
  if (clase === "cierre") {
    return "cierre";
  }
  if (clase === "aclaracion") {
    return "aclaracion";
  }
  if (clase === "seguimiento") {
    return "seguimiento";
  }
  return "objetivo";
}

export function ejemploDelObjetivo(
  seccion: SeccionEntrevista,
  indice: number | undefined
) {
  if (typeof indice !== "number") {
    return seccion.seguimientos?.[0];
  }
  return seccion.seguimientos?.[indice];
}
