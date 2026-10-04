import { expect, test } from "@playwright/test";
import {
  MAX_REPARACIONES_ESCUCHA,
  planificarConversacionContinua,
  promptConversacionContinua,
} from "@/lib/consultoria/conversacion-continua";
import {
  parseSecciones,
  seccionesPublicas,
} from "@/lib/consultoria/entrevista-contenido";
import { seccionesDeGuionClFase2 } from "@/lib/consultoria/guiones/compliance-latam-fase-2";
import {
  ESCUCHA_ETM,
  seccionesDeGuionEtm,
} from "@/lib/consultoria/guiones/etm-tuesday";
import {
  type LecturaRespuesta,
  lecturaHeuristica,
  tipoEvidente,
  validarLectura,
} from "@/lib/consultoria/lectura-respuesta";
import {
  mensajesATurnos,
  turnosAMensajes,
} from "@/lib/consultoria/mensajes-a-turnos";
import type { ChatMessage } from "@/lib/types";

type Clase = "obligatoria" | "seguimiento" | "aclaracion";

function agente(texto: string, clase: Clase, indice: number): ChatMessage {
  return {
    id: crypto.randomUUID(),
    metadata: {
      clase,
      createdAt: "2026-10-01T00:00:00.000Z",
      indiceObligatoria: indice,
    },
    parts: [{ text: texto, type: "text" }],
    role: "assistant",
  };
}

function persona(texto: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    metadata: { createdAt: "2026-10-01T00:00:00.000Z" },
    parts: [{ text: texto, type: "text" }],
    role: "user",
  };
}

function lectura(parcial: Partial<LecturaRespuesta>): LecturaRespuesta {
  return {
    cubiertos: [],
    negativa: false,
    profundizar: false,
    tipo: "sustantiva",
    ...parcial,
  };
}

function seccionMentores() {
  const [seccion] = seccionesDeGuionEtm("mentores");
  if (!seccion) {
    throw new Error("sin pauta");
  }
  // These cases exercise the original listening mode; v2 has its own suite.
  return { ...seccion, profundizacionDesde: undefined };
}

const seccion = seccionMentores();
const P = seccion.preguntas;
const inicioInes = [
  agente(P[0] ?? "", "obligatoria", 0),
  persona("la buena onda"),
];

test("la pauta ETM activa la escucha y ComplianceLatam no", () => {
  expect(seccion.escucha).toEqual(ESCUCHA_ETM);
  for (const cl of seccionesDeGuionClFase2()) {
    expect(cl.escucha).toBeUndefined();
  }
  const [parseada] = parseSecciones([
    { ...seccion, escucha: { modeloAgente: "otro/modelo" } },
  ]);
  expect(parseada?.escucha).toEqual({});
  expect(seccionesPublicas([seccion])[0]).not.toHaveProperty("escucha");
});

test("«la buena onda» lleva a un seguimiento sobre esa motivación", () => {
  const plan = planificarConversacionContinua({
    lectura: lectura({ foco: "la buena onda", profundizar: true }),
    messages: inicioInes,
    seccion,
  });
  expect(plan.clase).toBe("seguimiento");
  expect(plan.indiceObligatoria).toBe(0);
  expect(plan.escucha?.foco).toBe("la buena onda");
  const prompt = promptConversacionContinua({
    escucha: plan.escucha,
    preguntaActual: plan.seguimientoSiguiente,
    trato: "tu",
    turno: "seguimiento",
  });
  expect(prompt).toContain("«la buena onda»");
  expect(prompt).toMatch(/no sobre la experiencia en general/);
});

test("«sí, hubo uno» tras el seguimiento invita a contarlo y no avanza", () => {
  const messages = [
    ...inicioInes,
    agente("¿Qué viste en el ambiente que te animó?", "seguimiento", 0),
    persona("me gusta ayudar"),
    agente(P[1] ?? "", "obligatoria", 1),
    persona("bien"),
    agente("¿Puedes contar un momento que lo muestre?", "seguimiento", 1),
    persona("si hubo uno"),
  ];
  for (const leida of [lectura({ tipo: "por_completar" }), undefined]) {
    const plan = planificarConversacionContinua({
      lectura: leida,
      messages,
      seccion,
    });
    expect(plan.clase).toBe("aclaracion");
    expect(plan.indiceObligatoria).toBe(1);
    expect(plan.escucha?.reparacion).toBe("completar");
    expect(
      promptConversacionContinua({
        escucha: plan.escucha,
        preguntaActual: plan.seguimientoSiguiente,
        trato: "tu",
        turno: "aclaracion",
      })
    ).toMatch(/Cuéntame, ¿qué pasó/);
  }

  const contado = planificarConversacionContinua({
    lectura: lectura({ profundizar: true }),
    messages: [
      ...messages,
      agente("Cuéntame, ¿qué pasó en ese momento?", "aclaracion", 1),
      persona("Le ayudé a fijar precios y salió con una tabla lista"),
    ],
    seccion,
  });
  expect(contado.clase).toBe("obligatoria");
  expect(contado.indiceObligatoria).toBe(2);
});

test("una respuesta conseguida al reparar cubre el objetivo sin forzar seguimiento", () => {
  const plan = planificarConversacionContinua({
    lectura: lectura({}),
    messages: [
      agente(P[1] ?? "", "obligatoria", 1),
      persona("sí, hubo uno"),
      agente("Cuéntame, ¿qué pasó?", "aclaracion", 1),
      persona("Necesitaba ordenar costos y yo sé de eso; armamos su tabla"),
    ],
    seccion,
  });
  expect(plan.clase).toBe("obligatoria");
  expect(plan.indiceObligatoria).toBe(2);
});

test("«difícil pregunta» se facilita con otra entrada, hasta dos veces, y luego se avanza sin presión", () => {
  const base = [
    agente(P[3] ?? "", "obligatoria", 3),
    persona("dificil pregunta"),
  ];
  const primera = planificarConversacionContinua({
    messages: base,
    seccion,
  });
  expect(primera.clase).toBe("aclaracion");
  expect(primera.escucha?.reparacion).toBe("facilitar");
  const prompt = promptConversacionContinua({
    escucha: primera.escucha,
    preguntaActual: primera.seguimientoSiguiente,
    trato: "tu",
    turno: "aclaracion",
  });
  expect(prompt).toMatch(/No la repitas cambiando dos palabras/);
  expect(prompt).toMatch(/no presupongas que hubo problemas/);

  const segunda = planificarConversacionContinua({
    lectura: lectura({ tipo: "dificultad" }),
    messages: [
      ...base,
      agente("Podemos mirarlo más simple…", "aclaracion", 3),
      persona("sigo sin saber"),
    ],
    seccion,
  });
  expect(segunda.clase).toBe("aclaracion");
  expect(segunda.escucha?.reparacionesPrevias).toBe(1);

  const reparaciones = Array.from(
    { length: MAX_REPARACIONES_ESCUCHA },
    (_, numero) => [
      agente(`Otra entrada ${numero}`, "aclaracion", 3),
      persona("no sé qué decir"),
    ]
  ).flat();
  const agotado = planificarConversacionContinua({
    lectura: lectura({ tipo: "dificultad" }),
    messages: [...base, ...reparaciones],
    seccion,
  });
  expect(agotado.clase).toBe("obligatoria");
  expect(agotado.indiceObligatoria).toBe(4);
  expect(agotado.escucha?.transicion).toBe("sin_presion");
});

test("reparar no gasta el seguimiento sustantivo", () => {
  const plan = planificarConversacionContinua({
    lectura: lectura({ foco: "el ambiente", profundizar: true }),
    messages: [
      agente(P[0] ?? "", "obligatoria", 0),
      persona("difícil pregunta"),
      agente("Pensemos en algo concreto…", "aclaracion", 0),
      persona("el ambiente"),
    ],
    seccion,
  });
  expect(plan.clase).toBe("seguimiento");
  expect(plan.seguimientosHechos).toBe(0);
});

test("«no me acuerdo» y «prefiero no» avanzan sin insistir y sin dar el punto por respondido", () => {
  for (const texto of [
    "no me acuerdo",
    "No me acuerdo bien",
    "prefiero no hablar de eso",
  ]) {
    const plan = planificarConversacionContinua({
      lectura: lectura({ profundizar: true }),
      messages: [agente(P[2] ?? "", "obligatoria", 2), persona(texto)],
      seccion,
    });
    expect(plan.clase).toBe("obligatoria");
    expect(plan.indiceObligatoria).toBe(3);
    expect(plan.escucha?.transicion).toBe("sin_presion");
    expect(
      promptConversacionContinua({
        escucha: plan.escucha,
        preguntaActual: P[3],
        trato: "tu",
        turno: "objetivo",
      })
    ).toMatch(/No pasa nada, podemos dejar ese punto/);
  }
  expect(tipoEvidente("no me pasó")).toBeUndefined();
  expect(tipoEvidente("paso")).toBe("no_quiere");
});

test("una valoración sola siempre admite su seguimiento, aunque el lector diga que basta", () => {
  for (const texto of ["bien", "Estuvo muy bien", "regular la verdad"]) {
    const leida = validarLectura({
      activo: 1,
      dicho: texto,
      lectura: {
        cubiertos: [],
        foco: "",
        negativa: false,
        profundizar: false,
        tipo: "sustantiva",
      },
      objetivos: 5,
      texto,
    });
    expect(leida.profundizar).toBe(true);
  }
});

test("un no claro no autoriza a insistir", () => {
  const leida = validarLectura({
    activo: 2,
    dicho: "no, no hubo",
    lectura: {
      cubiertos: [],
      foco: "",
      negativa: false,
      profundizar: true,
      tipo: "sustantiva",
    },
    objetivos: 5,
    texto: "no, no hubo",
  });
  expect(leida.profundizar).toBe(false);
  expect(
    lecturaHeuristica({ texto: "No, ninguno", vaga: true }).profundizar
  ).toBe(false);
});

test("lo cubierto exige una cita literal suficiente y solo cuenta objetivos posteriores", () => {
  const dicho =
    "Quería devolver lo que otros hicieron por mí; lo más útil fue armar su tabla de costos";
  const leida = validarLectura({
    activo: 0,
    dicho,
    lectura: {
      cubiertos: [
        { evidencia: "lo más útil fue armar su tabla de costos", indice: 2 },
        { evidencia: "me encantó el formato", indice: 3 },
        { evidencia: "tabla", indice: 4 },
        { evidencia: "Quería devolver lo que otros hicieron", indice: 0 },
      ],
      foco: "devolver lo que otros hicieron",
      negativa: false,
      profundizar: false,
      tipo: "sustantiva",
    },
    objetivos: 5,
    texto: dicho,
  });
  expect(leida.cubiertos).toEqual([2]);
  expect(leida.foco).toBe("devolver lo que otros hicieron");

  const plan = planificarConversacionContinua({
    lectura: lectura({ cubiertos: [1, 2] }),
    messages: [agente(P[0] ?? "", "obligatoria", 0), persona(dicho)],
    seccion,
  });
  expect(plan.indiceObligatoria).toBe(3);
});

test("los contadores sobreviven a guardar y reanudar", () => {
  const messages = [
    agente(P[1] ?? "", "obligatoria", 1),
    persona("dificil"),
    agente("Pensemos en un momento…", "aclaracion", 1),
    persona("no entendí"),
    agente("Otra forma…", "aclaracion", 1),
    persona("tampoco"),
  ];
  const reanudados = turnosAMensajes(mensajesATurnos(messages, seccion.id));
  const leida = lectura({ tipo: "dificultad" });
  const antes = planificarConversacionContinua({
    lectura: leida,
    messages,
    seccion,
  });
  const despues = planificarConversacionContinua({
    lectura: leida,
    messages: reanudados,
    seccion,
  });
  expect(despues).toEqual(antes);
  expect(despues.clase).toBe("obligatoria");
  expect(despues.indiceObligatoria).toBe(2);
});

test("una emoción expresada se reconoce sin atribuir otras", () => {
  const plan = planificarConversacionContinua({
    lectura: lectura({ negativa: true }),
    messages: [
      agente(P[3] ?? "", "obligatoria", 3),
      persona("llegó tarde y sin preparar nada, fue frustrante"),
    ],
    seccion,
  });
  expect(plan.escucha?.transicion).toBe("reconocer");
  const prompt = promptConversacionContinua({
    escucha: plan.escucha,
    preguntaActual: P[4],
    trato: "tu",
    turno: "objetivo",
  });
  expect(prompt).toMatch(/sin añadir emociones que no nombró/);
  expect(prompt).toMatch(/nunca pidas una nota/i);
});
