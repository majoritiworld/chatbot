import type { LanguageModel } from "ai";
import {
  citasLiteralesDelParticipante,
  type TurnoParaCita,
} from "@/lib/consultoria/sintesis-consulta";

const HOSTS_LOCALES = new Set(["127.0.0.1", "localhost"]);
const PREGUNTA = /¿[^?]+\?/;
const HERRAMIENTA_CIERRE = "ofrecerCierreSeccion";

const uso = {
  inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
  outputTokens: { reasoning: 0, text: 20, total: 20 },
};

type Ambiente = Record<string, string | undefined>;

/** Local demo only. A production URL never activates the stand-in. */
export function entrevistaSimuladaLocal(env: Ambiente = process.env) {
  if (env.ENTREVISTA_SIMULADA !== "1") {
    return false;
  }
  const cruda = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    return HOSTS_LOCALES.has(new URL(cruda).hostname);
  } catch {
    return false;
  }
}

export function textoTurnoSimulado(
  prompt: string,
  herramientaForzada: string | null
) {
  if (
    herramientaForzada === HERRAMIENTA_CIERRE ||
    /NO hagas ninguna pregunta/i.test(prompt)
  ) {
    return {
      herramienta: HERRAMIENTA_CIERRE,
      texto: /Enviar entrevista/.test(prompt)
        ? "Gracias. Cuando quieras, puedes enviar la entrevista."
        : "Gracias. Con eso puedo cerrar este tema.",
    };
  }
  const deEsteTurno = prompt.match(/Pregunta para este turno:\s*(¿[^?]+\?)/);
  if (deEsteTurno?.[1]) {
    return { herramienta: null, texto: deEsteTurno[1] };
  }
  if (/Ejemplos de seguimiento/i.test(prompt)) {
    const ejemplo = prompt.split("Ejemplos de seguimiento").at(1) ?? "";
    return {
      herramienta: null,
      texto:
        ejemplo.match(PREGUNTA)?.[0] ??
        "¿Puedes contarme un ejemplo concreto de lo que acabas de decir?",
    };
  }
  const guia = prompt.split("Preguntas guía").at(1) ?? prompt;
  return {
    herramienta: null,
    texto:
      guia.match(PREGUNTA)?.[0] ?? "¿Cómo fue tu experiencia en ETM Tuesday?",
  };
}

function nombreHerramienta(toolChoice: unknown) {
  if (typeof toolChoice !== "object" || toolChoice === null) {
    return null;
  }
  const choice = toolChoice as { toolName?: unknown; type?: unknown };
  if (choice.type === "tool" && typeof choice.toolName === "string") {
    return choice.toolName;
  }
  return null;
}

function promptComoTexto(prompt: unknown) {
  return JSON.stringify(prompt);
}

function partesTexto(texto: string) {
  return [
    { id: "t1", type: "text-start" as const },
    { delta: texto, id: "t1", type: "text-delta" as const },
    { id: "t1", type: "text-end" as const },
  ];
}

function partesHerramienta(nombre: string) {
  const input = JSON.stringify({ listo: true });
  return [
    {
      id: "c1",
      toolName: nombre,
      type: "tool-input-start" as const,
    },
    { delta: input, id: "c1", type: "tool-input-delta" as const },
    { id: "c1", type: "tool-input-end" as const },
    {
      input,
      toolCallId: "sim-cierre",
      toolName: nombre,
      type: "tool-call" as const,
    },
  ];
}

function streamDe(partes: Record<string, unknown>[]) {
  return new ReadableStream({
    start(controller) {
      for (const parte of partes) {
        controller.enqueue(parte);
      }
      controller.close();
    },
  });
}

export const modeloEntrevistaSimulada = {
  doGenerate: ({
    prompt,
    toolChoice,
  }: {
    prompt: unknown;
    toolChoice?: unknown;
  }) => {
    const turno = textoTurnoSimulado(
      promptComoTexto(prompt),
      nombreHerramienta(toolChoice)
    );
    const content = turno.herramienta
      ? [
          { text: turno.texto, type: "text" as const },
          {
            input: JSON.stringify({ listo: true }),
            toolCallId: "sim-cierre",
            toolName: turno.herramienta,
            type: "tool-call" as const,
          },
        ]
      : [{ text: turno.texto, type: "text" as const }];
    return {
      content,
      finishReason: turno.herramienta ? "tool-calls" : "stop",
      usage: uso,
      warnings: [],
    };
  },
  doStream: ({
    prompt,
    toolChoice,
  }: {
    prompt: unknown;
    toolChoice?: unknown;
  }) => {
    const turno = textoTurnoSimulado(
      promptComoTexto(prompt),
      nombreHerramienta(toolChoice)
    );
    const partes = [
      ...partesTexto(turno.texto),
      ...(turno.herramienta ? partesHerramienta(turno.herramienta) : []),
      {
        finishReason: turno.herramienta ? "tool-calls" : "stop",
        type: "finish" as const,
        usage: uso,
      },
    ];
    return { stream: streamDe(partes) };
  },
  modelId: "entrevista-simulada-local",
  provider: "mock",
  specificationVersion: "v3" as const,
  supportedUrls: {},
} as unknown as LanguageModel;

/** Section close without calling a model. Quotes stay the person's words. */
export function resumenCierreSimulado({
  preguntas,
  tituloSeccion,
  turnos,
}: {
  preguntas: string[];
  tituloSeccion: string;
  turnos: TurnoParaCita[];
}) {
  const dichos = turnos.flatMap((turno) => {
    if (turno.rol !== "entrevistado") {
      return [];
    }
    const texto = turno.texto.trim();
    return texto.length > 0 ? [texto] : [];
  });
  const junto = dichos.join(" ");
  return {
    hallazgos: dichos.slice(0, 3),
    respuestas: preguntas.map((pregunta) => ({
      pregunta,
      respuesta_texto: junto.length > 0 ? junto : "Sin respuesta registrada.",
    })),
    sintesis:
      junto.length > 0
        ? `${tituloSeccion}: ${junto}`
        : `${tituloSeccion}: no hubo respuesta registrada.`,
  };
}

export function sintesisConsultaSimulada(turnos: TurnoParaCita[]) {
  const dichos = turnos.flatMap((turno) => {
    if (turno.rol !== "entrevistado") {
      return [];
    }
    const texto = turno.texto.trim();
    return texto.length > 0 ? [texto] : [];
  });
  const citas = citasLiteralesDelParticipante(dichos, turnos);
  const sintesis =
    dichos.length > 0
      ? dichos.join(" ")
      : "No hubo respuestas registradas en la conversación.";
  return { citas, sintesis };
}
