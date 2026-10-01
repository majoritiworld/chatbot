import {
  esElogioDeLaPregunta,
  esIncomprension,
  esNoSabe,
  esRenunciaAProfundizar,
  normalizarRespuesta,
} from "@/lib/consultoria/seguimientos-sustantivos";

/**
 * - sustantiva: answers, even briefly or with a "no".
 * - por_completar: announces something it has not told yet ("sí, hubo uno").
 * - dificultad: finds the question hard or unclear.
 * - no_recuerda: does not remember or does not know.
 * - no_quiere: prefers not to answer or not to go further.
 */
export type TipoRespuesta =
  | "sustantiva"
  | "por_completar"
  | "dificultad"
  | "no_recuerda"
  | "no_quiere";

export type LecturaRespuesta = {
  tipo: TipoRespuesta;
  /** A concrete follow-up on something said would add to the objective. */
  profundizar: boolean;
  /** Words of the last reply the next turn should connect to. */
  foco?: string;
  /** The reply tells something that went badly. */
  negativa: boolean;
  /** Other objectives the person already answered, with their own words. */
  cubiertos: number[];
};

const NO_RECUERDA =
  /^(la verdad |sinceramente |uf |mmm |eh )?(no me acuerdo|no lo recuerdo|no recuerdo|no me recuerdo|no sabria decir|no sabria|ni idea|no tengo idea|no lo se|no se)( bien| mucho| muy bien| la verdad| exactamente| que decir| que decirte)?$/;

const NO_QUIERE =
  /\b(prefiero no|no quiero (responder|hablar|contar|entrar|profundizar)|siguiente pregunta|dejemoslo|mejor sigamos|no me interesa responder)\b|^(paso|yo paso|paso a la siguiente)$/;

const POR_COMPLETAR =
  /^(si|bueno si|pues si|claro|eh si)? ?(hubo|tuve|tengo|paso|me paso|recuerdo|se me ocurre|tengo un ejemplo de|hay) (uno|una|algo|alguno|alguna|un ejemplo|un caso|un momento|varios|varias|un par)( si)?$/;

const DIFICULTAD =
  /\b(dificil|complicad[ao]|no se que (decir|responder|contestar)|no se bien que decir|no entiendo|no entendi|a que te refieres|a que se refiere|como asi|en que sentido)\b/;

const NEGACIONES = new Set([
  "nada",
  "ninguna",
  "ninguno",
  "no",
  "nunca",
  "tampoco",
]);
const RELLENO_NEGATIVA = new Set([
  ...NEGACIONES,
  "hubo",
  "la",
  "paso",
  "realmente",
  "tuve",
  "verdad",
]);

/** A bare "no" ("no, ninguno", "nunca la verdad"): an answer, not an opening. */
export function esNegativaClara(texto: string) {
  const tokens = normalizarRespuesta(texto).split(" ").filter(Boolean);
  return (
    tokens.length > 0 &&
    NEGACIONES.has(tokens[0] ?? "") &&
    tokens.every((token) => RELLENO_NEGATIVA.has(token))
  );
}

const SOLO_VALORACION =
  /^(si |no |pues |la verdad |yo creo que |creo que )?(fue |estuvo |era |es |me parecio |me parece )?(muy |bastante |super |re )?(bien|mal|regular|normal|ok|okay|interesante|bueno|buena|bonito|bonita|util|entretenido|entretenida|mas o menos|de todo|depende|todo bien|nada mal)( la verdad| nomas| no mas)?$/;

/** Only a rating ("bien", "estuvo regular"): there is nothing to read yet. */
export function esSoloValoracion(texto: string) {
  return SOLO_VALORACION.test(normalizarRespuesta(texto));
}

function palabras(normal: string) {
  return normal.split(" ").filter(Boolean).length;
}

/**
 * Patterns clear enough to override the reader: never press someone who
 * does not remember or prefers to pass.
 */
export function tipoEvidente(texto: string): TipoRespuesta | undefined {
  const normal = normalizarRespuesta(texto);
  if (!normal) {
    return;
  }
  if (NO_QUIERE.test(normal) || esRenunciaAProfundizar(texto)) {
    return "no_quiere";
  }
  if (NO_RECUERDA.test(normal) || esNoSabe(texto)) {
    return "no_recuerda";
  }
  if (POR_COMPLETAR.test(normal)) {
    return "por_completar";
  }
}

/** Used when the reader fails or times out. */
export function lecturaHeuristica({
  texto,
  vaga,
}: {
  texto: string;
  vaga: boolean;
}): LecturaRespuesta {
  const normal = normalizarRespuesta(texto);
  const evidente = tipoEvidente(texto);
  const dificil =
    palabras(normal) <= 8 &&
    (DIFICULTAD.test(normal) ||
      esIncomprension(texto) ||
      esElogioDeLaPregunta(texto));
  let tipo: TipoRespuesta = evidente ?? "sustantiva";
  if (!evidente && dificil) {
    tipo = "dificultad";
  }
  return {
    cubiertos: [],
    negativa: false,
    profundizar:
      tipo === "sustantiva" &&
      (vaga || esSoloValoracion(texto)) &&
      !esNegativaClara(texto),
    tipo,
  };
}

/** True when `fragmento` appears in `texto` once both are normalized. */
export function citaLiteral(fragmento: string | undefined, texto: string) {
  const cita = normalizarRespuesta(fragmento ?? "");
  return cita.length > 0 && normalizarRespuesta(texto).includes(cita);
}

/**
 * Keeps only what the person's words support: a focus quoted from the last
 * reply and covered objectives backed by a literal quote of several words.
 */
export function validarLectura({
  activo,
  dicho,
  lectura,
  objetivos,
  texto,
}: {
  activo: number;
  dicho: string;
  lectura: {
    tipo: TipoRespuesta;
    profundizar: boolean;
    foco: string;
    negativa: boolean;
    cubiertos: Array<{ indice: number; evidencia: string }>;
  };
  objetivos: number;
  texto: string;
}): LecturaRespuesta {
  const evidente = tipoEvidente(texto);
  const tipo = evidente ?? lectura.tipo;
  const cubiertos = lectura.cubiertos
    .filter(
      (item) =>
        Number.isInteger(item.indice) &&
        item.indice > activo &&
        item.indice < objetivos &&
        palabras(normalizarRespuesta(item.evidencia)) >= 3 &&
        citaLiteral(item.evidencia, dicho)
    )
    .map((item) => item.indice);
  return {
    cubiertos: [...new Set(cubiertos)].sort((a, b) => a - b),
    ...(citaLiteral(lectura.foco, texto) ? { foco: lectura.foco.trim() } : {}),
    negativa: lectura.negativa,
    profundizar:
      tipo === "sustantiva" &&
      (lectura.profundizar || esSoloValoracion(texto)) &&
      !esNegativaClara(texto),
    tipo,
  };
}
