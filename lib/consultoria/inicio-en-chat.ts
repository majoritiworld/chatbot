import { normalizarRespuesta } from "@/lib/consultoria/seguimientos-sustantivos";

export const ICONOS_BLOQUE = [
  "asistente",
  "corregir",
  "demo",
  "guardado",
  "nombre",
  "pauta",
  "pendiente",
  "personas",
] as const;

export type IconoBloque = (typeof ICONOS_BLOQUE)[number];

export type BloqueInformativo = {
  icono?: IconoBloque;
  /** Shown as pending for the pilot, never as an active capability. */
  pendiente?: boolean;
  texto: string;
  titulo: string;
};

/**
 * The interview opens straight in the chat with a fixed greeting. The person
 * starts it by answering "¿Comenzamos?". Unset keeps the welcome screens.
 */
export type InicioEnChat = {
  asistente: string;
  /** Validated with real participants. Null until then. */
  duracionMinutos: number | null;
  ia: BloqueInformativo[];
  privacidad: BloqueInformativo[];
  proposito: string;
  respuestaFuncionamiento: string;
  respuestaPrivacidad: string;
  usoRespuestas: string;
};

function texto(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBloques(value: unknown): BloqueInformativo[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const bloque = item as Record<string, unknown>;
    const titulo = texto(bloque.titulo);
    const cuerpo = texto(bloque.texto);
    if (!(titulo && cuerpo)) {
      return [];
    }
    const icono = ICONOS_BLOQUE.find((nombre) => nombre === bloque.icono);
    return [
      {
        ...(icono ? { icono } : {}),
        ...(bloque.pendiente === true ? { pendiente: true } : {}),
        texto: cuerpo,
        titulo,
      },
    ];
  });
}

export function parseInicioEnChat(value: unknown): InicioEnChat | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return;
  }
  const crudo = value as Record<string, unknown>;
  const inicio = {
    asistente: texto(crudo.asistente),
    duracionMinutos:
      typeof crudo.duracionMinutos === "number" &&
      Number.isInteger(crudo.duracionMinutos) &&
      crudo.duracionMinutos > 0
        ? crudo.duracionMinutos
        : null,
    ia: parseBloques(crudo.ia),
    privacidad: parseBloques(crudo.privacidad),
    proposito: texto(crudo.proposito),
    respuestaFuncionamiento: texto(crudo.respuestaFuncionamiento),
    respuestaPrivacidad: texto(crudo.respuestaPrivacidad),
    usoRespuestas: texto(crudo.usoRespuestas),
  };
  if (
    !(
      inicio.asistente &&
      inicio.proposito &&
      inicio.usoRespuestas &&
      inicio.respuestaPrivacidad &&
      inicio.respuestaFuncionamiento
    )
  ) {
    return;
  }
  return inicio;
}

const NUMEROS = [
  "cero",
  "una",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
];

export function lineaDuracion(
  inicio: Pick<InicioEnChat, "duracionMinutos">,
  numeroPreguntas: number
) {
  if (inicio.duracionMinutos) {
    return `La conversación dura aproximadamente ${inicio.duracionMinutos} minutos.`;
  }
  const cantidad = NUMEROS[numeroPreguntas] ?? String(numeroPreguntas);
  return `Conversaremos sobre ${cantidad} preguntas breves.`;
}

export const PREGUNTA_COMENZAR = "¿Comenzamos?";

export function saludoInicial({
  inicio,
  nombre,
  numeroPreguntas,
}: {
  inicio: InicioEnChat;
  nombre?: string | null;
  numeroPreguntas: number;
}) {
  const primerNombre = nombre?.trim().split(/\s+/)[0];
  const saludo = primerNombre ? `Hola, ${primerNombre}.` : "Hola.";
  return [
    `${saludo} Soy ${inicio.asistente}.`,
    `${inicio.proposito} ${lineaDuracion(inicio, numeroPreguntas)}`,
    "Puedes guardar y continuar más adelante desde este mismo enlace, o terminar cuando quieras. Te haré algunas preguntas y, cuando ayude a entender tu experiencia, una breve repregunta.",
    "Cuando hayamos cubierto lo necesario, te avisaré para cerrar y enviar la entrevista.",
    inicio.usoRespuestas,
    PREGUNTA_COMENZAR,
  ].join("\n\n");
}

export type ClaseInicio =
  | "acepta"
  | "ambigua"
  | "niega"
  | "pregunta_funcionamiento"
  | "pregunta_privacidad";

const PRIVACIDAD =
  /privacidad|privad[oa]s?\b|quien(es)? (ve|vera|veran|lee|leera|leeran|puede|pueden|tiene|tienen|revisa|revisara)|anonim|confidencial|mis datos|mis respuestas|mi nombre|se guarda|guardan|que hacen con|para que (se usa|usan|sirve)/;

const FUNCIONAMIENTO =
  /como funciona|cuanto (dura|tiempo|demora|se demora|toma)|que es esto|de que se trata|de que va|inteligencia artificial|\bia\b|robot|\bbot\b|cuantas preguntas|como sigue|que tengo que hacer|puedo (guardar|pausar|terminar|salir|parar)/;

const NEGATIVA =
  /^(no|nop|nope|todavia no|aun no|ahora no|mas tarde|despues|luego|otro dia|en otro momento|mejor despues|mejor no|prefiero (no|esperar|despues))\b|no quiero|no puedo|no estoy (listo|lista)|no tengo tiempo/;

const FUERTES = new Set([
  "acuerdo",
  "adelante",
  "claro",
  "comencemos",
  "comenzamos",
  "comenzar",
  "dale",
  "empecemos",
  "empezamos",
  "empezar",
  "gusto",
  "hagamoslo",
  "lista",
  "listas",
  "listo",
  "listos",
  "ok",
  "okay",
  "okey",
  "perfecto",
  "sale",
  "si",
  "sii",
  "supuesto",
  "va",
  "vamos",
  "venga",
]);

const ACOMPANANTES = new Set([
  "bien",
  "bueno",
  "con",
  "cuando",
  "de",
  "eh",
  "entonces",
  "eso",
  "estoy",
  "genial",
  "gracias",
  "hagamos",
  "hola",
  "lo",
  "me",
  "mi",
  "nomas",
  "parece",
  "para",
  "parte",
  "por",
  "pues",
  "que",
  "quieras",
  "todo",
  "ya",
  "yo",
]);

const FRENOS = new Set([
  "antes",
  "aun",
  "despues",
  "espera",
  "esperar",
  "luego",
  "momento",
  "no",
  "pero",
  "quizas",
  "supongo",
  "tal",
  "todavia",
]);

/**
 * Decides whether a reply to "¿Comenzamos?" starts the interview. Only a
 * clear yes does. A question gets an answer, a no or a hedge does not start.
 */
export function clasificarInicio(respuesta: string): ClaseInicio {
  const normal = normalizarRespuesta(respuesta);
  if (!normal) {
    return "ambigua";
  }
  if (PRIVACIDAD.test(normal)) {
    return "pregunta_privacidad";
  }
  if (FUNCIONAMIENTO.test(normal)) {
    return "pregunta_funcionamiento";
  }
  if (NEGATIVA.test(normal)) {
    return "niega";
  }
  if (respuesta.includes("?")) {
    return "ambigua";
  }
  const tokens = normal.split(" ").filter((token) => token.length > 0);
  if (tokens.some((token) => FRENOS.has(token))) {
    return "ambigua";
  }
  const todosConocidos = tokens.every(
    (token) => FUERTES.has(token) || ACOMPANANTES.has(token)
  );
  if (todosConocidos && tokens.some((token) => FUERTES.has(token))) {
    return "acepta";
  }
  return "ambigua";
}

export function respuestaInicio(
  clase: Exclude<ClaseInicio, "acepta">,
  inicio: InicioEnChat
) {
  switch (clase) {
    case "pregunta_privacidad":
      return `${inicio.respuestaPrivacidad}\n\n${PREGUNTA_COMENZAR}`;
    case "pregunta_funcionamiento":
      return `${inicio.respuestaFuncionamiento}\n\n${PREGUNTA_COMENZAR}`;
    case "niega":
      return "De acuerdo, no empezamos todavía. Puedes volver a este mismo enlace cuando quieras. Cuando estés listo o lista, escríbeme «sí».";
    default:
      return `Para empezar, respóndeme «sí». Si antes tienes una duda, escríbela. ${PREGUNTA_COMENZAR}`;
  }
}
