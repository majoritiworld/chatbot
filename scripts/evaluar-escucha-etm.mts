/**
 * Offline check of the ETM listening mode against the gateway.
 *
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/evaluar-escucha-etm.mts lectura <modelo>...
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/evaluar-escucha-etm.mts agente <lector> <modelo>...
 *
 * `lectura` scores the reply reader on labelled replies. `agente` replays the
 * same conversations through planner and prompt, with one fixed reader, and
 * prints each agent model's next turn and latency. Fictitious data only.
 */
import { writeFileSync } from "node:fs";
import { gateway, generateText } from "ai";
import {
  ejemploDelObjetivo,
  objetivoActivo,
  planificarConversacionContinua,
  promptConversacionContinua,
  turnoDeClase,
} from "../lib/consultoria/conversacion-continua";
import { seccionesDeGuionEtm } from "../lib/consultoria/guiones/etm-tuesday";
import { leerRespuesta } from "../lib/consultoria/leer-respuesta";
import {
  esModeloEntrevista,
  type ModeloEntrevista,
  opcionesModeloEntrevista,
} from "../lib/consultoria/modelos-entrevista";
import type { ChatMessage } from "../lib/types";

type Turno = [rol: "a" | "u", texto: string, clase?: string, indice?: number];

type Caso = {
  audiencia: "mentores" | "mentoreados" | "sponsors";
  esperado: string;
  id: string;
  turnos: Turno[];
};

const M0 =
  "¿Qué te motivó a participar como mentor o mentora en este EtM Tuesday?";
const M1 =
  "¿Cómo encajó tu experiencia con lo que necesitaba la persona que acompañaste?";
const M2 =
  "¿En qué momento sentiste que la conversación fue más útil para la persona que acompañaste, si hubo alguno?";
const M3 = "¿Qué dificultó la mentoría o te habría ayudado a aportar más?";

const CASOS: Caso[] = [
  {
    audiencia: "mentores",
    esperado: "sustantiva+profundizar",
    id: "buena-onda",
    turnos: [
      ["a", M0, "obligatoria", 0],
      ["u", "la buena onda"],
    ],
  },
  {
    audiencia: "mentores",
    esperado: "por_completar",
    id: "si-hubo-uno",
    turnos: [
      ["a", M0, "obligatoria", 0],
      ["u", "me gusta ayudar a gente que está empezando"],
      ["a", M1, "obligatoria", 1],
      ["u", "bien"],
      [
        "a",
        "¿Puedes contar un momento que muestre ese encaje o desajuste?",
        "seguimiento",
        1,
      ],
      ["u", "si hubo uno"],
    ],
  },
  {
    audiencia: "mentores",
    esperado: "no_recuerda",
    id: "no-me-acuerdo",
    turnos: [
      ["a", M0, "obligatoria", 0],
      ["u", "me gusta ayudar a gente que está empezando"],
      ["a", M1, "obligatoria", 1],
      ["u", "encajó bien, ella vendía ropa y yo tengo una tienda"],
      ["a", M2, "obligatoria", 2],
      ["u", "no me acuerdo"],
    ],
  },
  {
    audiencia: "mentores",
    esperado: "dificultad",
    id: "dificil-pregunta",
    turnos: [
      ["a", M0, "obligatoria", 0],
      ["u", "me gusta ayudar a gente que está empezando"],
      ["a", M3, "obligatoria", 3],
      ["u", "dificil pregunta"],
    ],
  },
  {
    audiencia: "mentores",
    esperado: "dificultad",
    id: "dificil-segunda",
    turnos: [
      ["a", M0, "obligatoria", 0],
      ["u", "me gusta ayudar a gente que está empezando"],
      ["a", M3, "obligatoria", 3],
      ["u", "dificil pregunta"],
      [
        "a",
        "Vamos por partes: si piensas en esa conversación, ¿qué parte te costó más?",
        "aclaracion",
        3,
      ],
      ["u", "sigo sin saber qué decir"],
    ],
  },
  {
    audiencia: "mentoreados",
    esperado: "dificultad",
    id: "dificil-mentoreada",
    turnos: [
      [
        "a",
        "¿Qué necesitabas resolver o explorar cuando llegaste a la mentoría?",
        "obligatoria",
        0,
      ],
      ["u", "cómo vender por instagram"],
      [
        "a",
        "¿Cómo encajó tu mentor o mentora con lo que necesitabas?",
        "obligatoria",
        1,
      ],
      ["u", "uf no sé cómo explicarlo"],
    ],
  },
  {
    audiencia: "sponsors",
    esperado: "dificultad",
    id: "dificil-sponsor",
    turnos: [
      [
        "a",
        "¿Qué buscaban conseguir al participar como sponsors y cómo se compara la experiencia con esa expectativa?",
        "obligatoria",
        0,
      ],
      ["u", "visibilidad con emprendedores"],
      [
        "a",
        "¿Qué fue lo más valioso que se llevaron de su participación?",
        "obligatoria",
        1,
      ],
      ["u", "difícil decirlo"],
    ],
  },
  {
    audiencia: "mentores",
    esperado: "sustantiva-sin-profundizar",
    id: "rica",
    turnos: [
      ["a", M0, "obligatoria", 0],
      [
        "u",
        "Quería devolver lo que otros hicieron por mí cuando empecé. Además la persona que acompañé necesitaba ordenar sus precios y yo llevo diez años en eso, así que encajó perfecto; lo más útil fue cuando armamos juntos su tabla de costos.",
      ],
    ],
  },
  {
    audiencia: "mentores",
    esperado: "sustantiva-sin-profundizar",
    id: "breve-suficiente",
    turnos: [
      ["a", M0, "obligatoria", 0],
      ["u", "me gusta ayudar a gente que está empezando"],
      ["a", M3, "obligatoria", 3],
      [
        "u",
        "tener 15 minutos más; se nos acabó el tiempo justo en lo de precios",
      ],
    ],
  },
  {
    audiencia: "mentores",
    esperado: "no_quiere",
    id: "negativa",
    turnos: [
      ["a", M0, "obligatoria", 0],
      ["u", "me gusta ayudar a gente que está empezando"],
      ["a", M3, "obligatoria", 3],
      ["u", "prefiero no hablar de eso"],
    ],
  },
  {
    audiencia: "mentores",
    esperado: "sustantiva+negativa",
    id: "emocion",
    turnos: [
      ["a", M0, "obligatoria", 0],
      ["u", "me gusta ayudar a gente que está empezando"],
      ["a", M3, "obligatoria", 3],
      [
        "u",
        "la persona llegó 25 minutos tarde y no había preparado nada, fue frustrante",
      ],
    ],
  },
];

function mensajes(turnos: Turno[]): ChatMessage[] {
  return turnos.map(([rol, texto, clase, indice], numero) => ({
    id: `m${numero}`,
    metadata: {
      createdAt: new Date(0).toISOString(),
      ...(clase && clase !== "cierre"
        ? { clase: clase as "obligatoria" | "seguimiento" | "aclaracion" }
        : {}),
      ...(typeof indice === "number" ? { indiceObligatoria: indice } : {}),
    },
    parts: [{ text: texto, type: "text" }],
    role: rol === "a" ? "assistant" : "user",
  }));
}

function modelos(ids: string[]): ModeloEntrevista[] {
  return ids.map((id) => {
    if (!esModeloEntrevista(id)) {
      throw new Error(`Modelo no permitido: ${id}`);
    }
    return id;
  });
}

async function evaluarLectura(ids: ModeloEntrevista[]) {
  const filas: unknown[] = [];
  for (const modelo of ids) {
    for (const caso of CASOS) {
      const messages = mensajes(caso.turnos);
      const [seccion] = seccionesDeGuionEtm(caso.audiencia);
      const inicio = Date.now();
      // biome-ignore lint/performance/noAwaitInLoops: sequential calls keep latencies comparable
      const lectura = await leerRespuesta({
        activo: objetivoActivo(messages),
        messages,
        modelo,
        objetivos: seccion?.preguntas ?? [],
      });
      const ms = Date.now() - inicio;
      filas.push({
        caso: caso.id,
        esperado: caso.esperado,
        lectura,
        modelo,
        ms,
      });
      process.stdout.write(
        `${modelo.padEnd(34)} ${caso.id.padEnd(18)} ${String(ms).padStart(5)}ms esperado=${caso.esperado} → ${JSON.stringify(lectura)}\n`
      );
    }
  }
  return filas;
}

async function evaluarAgente(
  lector: ModeloEntrevista,
  ids: ModeloEntrevista[]
) {
  const filas: unknown[] = [];
  const soloCaso = process.env.CASO_EVALUACION;
  for (const caso of CASOS.filter(
    (c) => !soloCaso || c.id.startsWith(soloCaso)
  )) {
    const messages = mensajes(caso.turnos);
    const [seccion] = seccionesDeGuionEtm(caso.audiencia);
    if (!seccion) {
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: the reader is shared by every agent model
    const lectura = await leerRespuesta({
      activo: objetivoActivo(messages),
      messages,
      modelo: lector,
      objetivos: seccion.preguntas,
    });
    const plan = planificarConversacionContinua({ lectura, messages, seccion });
    const instrucciones = promptConversacionContinua({
      ejemploSeguimiento: ejemploDelObjetivo(seccion, plan.indiceObligatoria),
      escucha: plan.escucha,
      guiaTurno: plan.guiaTurno,
      instrucciones: seccion.instrucciones,
      motivoCierre: plan.motivoCierre,
      nombre: "Lucía",
      organizacion: "Tienda Ficticia",
      preguntaActual:
        plan.seguimientoSiguiente ??
        seccion.preguntas[plan.indiceObligatoria ?? 0],
      trato: "tu",
      turno: turnoDeClase(plan.clase),
    });
    for (const modelo of ids) {
      const inicio = Date.now();
      try {
        // biome-ignore lint/performance/noAwaitInLoops: sequential calls keep latencies comparable
        const r = await generateText({
          instructions: instrucciones,
          messages: caso.turnos.map(([rol, texto]) => ({
            content: texto,
            role: rol === "a" ? ("assistant" as const) : ("user" as const),
          })),
          model: gateway.languageModel(modelo),
          providerOptions: opcionesModeloEntrevista(modelo),
        });
        const ms = Date.now() - inicio;
        filas.push({
          caso: caso.id,
          clase: plan.clase,
          indice: plan.indiceObligatoria,
          lectura,
          modelo,
          ms,
          texto: r.text,
          usage: r.usage,
        });
        process.stdout.write(
          `${caso.id.padEnd(18)} ${plan.clase}/${plan.indiceObligatoria ?? "-"} ${modelo.padEnd(34)} ${String(ms).padStart(5)}ms in=${r.usage.inputTokens} out=${r.usage.outputTokens} | ${r.text.replaceAll("\n", " ")}\n`
        );
      } catch (error) {
        process.stdout.write(
          `${caso.id} ${modelo} ERROR ${error instanceof Error ? error.message : String(error)}\n`
        );
      }
    }
  }
  return filas;
}

const [modo, ...resto] = process.argv.slice(2);
const salida = process.env.SALIDA_EVALUACION;
if (modo === "lectura") {
  const filas = await evaluarLectura(modelos(resto));
  if (salida) {
    writeFileSync(salida, JSON.stringify(filas, null, 2));
  }
} else if (modo === "agente") {
  const [lector, ...agentes] = modelos(resto);
  if (!lector) {
    throw new Error("Falta el modelo lector");
  }
  const filas = await evaluarAgente(lector, agentes);
  if (salida) {
    writeFileSync(salida, JSON.stringify(filas, null, 2));
  }
} else {
  throw new Error("Modo: lectura | agente");
}
