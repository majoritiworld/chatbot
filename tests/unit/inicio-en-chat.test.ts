import { expect, test } from "@playwright/test";
import {
  planificarConversacionContinua,
  promptConversacionContinua,
} from "@/lib/consultoria/conversacion-continua";
import {
  parseSecciones,
  seccionesPublicas,
} from "@/lib/consultoria/entrevista-contenido";
import { seccionesDeGuionClFase2 } from "@/lib/consultoria/guiones/compliance-latam-fase-2";
import {
  type AudienciaEtm,
  INSTRUCCIONES_AGENTE_ETM,
  inicioEnChatEtm,
  seccionesDeGuionEtm,
} from "@/lib/consultoria/guiones/etm-tuesday";
import {
  clasificarInicio,
  parseInicioEnChat,
  respuestaInicio,
  saludoInicial,
} from "@/lib/consultoria/inicio-en-chat";
import type { ChatMessage } from "@/lib/types";

const AUDIENCIAS: AudienciaEtm[] = ["mentores", "mentoreados", "sponsors"];
const ESCALA = /del 1 al 10|puntuaci[oó]n|escala|nota del/i;
const PROMESA_ANONIMATO =
  /respuestas son an[oó]nimas|puedes responder de forma an[oó]nima|tu nombre no se (guarda|muestra|comparte)/i;

function mensaje(
  role: "assistant" | "user",
  texto: string,
  metadata?: Partial<ChatMessage["metadata"]>
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    metadata: metadata
      ? { createdAt: "2026-10-01T00:00:00.000Z", ...metadata }
      : undefined,
    parts: [{ text: texto, type: "text" }],
    role,
  };
}

function seccionDe(audiencia: AudienciaEtm) {
  const [seccion] = seccionesDeGuionEtm(audiencia);
  if (!seccion) {
    throw new Error(audiencia);
  }
  return seccion;
}

test("solo una afirmación clara empieza la entrevista", () => {
  for (const texto of [
    "sí",
    "Sí",
    "dale",
    "vamos",
    "estoy listo",
    "Estoy lista",
    "Sí, vamos",
    "claro que sí",
    "ok, empecemos",
    "Sí, ya estoy lista para empezar",
  ]) {
    expect(clasificarInicio(texto), texto).toBe("acepta");
  }
  for (const texto of [
    "no",
    "todavía no",
    "más tarde",
    "ahora no puedo",
    "no estoy listo",
  ]) {
    expect(clasificarInicio(texto), texto).toBe("niega");
  }
  for (const texto of [
    "sí, pero antes una cosa",
    "si tengo tiempo",
    "supongo que sí",
    "¿sí?",
    "quizás",
    "sí, aunque tengo poco tiempo",
    "hola",
    "",
  ]) {
    expect(clasificarInicio(texto), texto).toBe("ambigua");
  }
  expect(clasificarInicio("¿Quién ve mis respuestas?")).toBe(
    "pregunta_privacidad"
  );
  expect(clasificarInicio("Sí, pero ¿esto es anónimo?")).toBe(
    "pregunta_privacidad"
  );
  expect(clasificarInicio("¿Cómo funciona?")).toBe("pregunta_funcionamiento");
  expect(clasificarInicio("¿cuánto dura?")).toBe("pregunta_funcionamiento");
});

test("las respuestas previas al inicio vuelven a ofrecer empezar y no empiezan", () => {
  const inicio = inicioEnChatEtm("mentoreados");
  expect(respuestaInicio("pregunta_privacidad", inicio)).toMatch(
    /¿Comenzamos\?$/
  );
  expect(respuestaInicio("pregunta_funcionamiento", inicio)).toMatch(
    /¿Comenzamos\?$/
  );
  expect(respuestaInicio("ambigua", inicio)).toMatch(/¿Comenzamos\?$/);
  expect(respuestaInicio("niega", inicio)).not.toMatch(/¿Comenzamos\?/);
  expect(respuestaInicio("pregunta_privacidad", inicio)).not.toMatch(
    PROMESA_ANONIMATO
  );
});

test("el saludo usa el nombre, explica el uso antes de preguntar y termina en ¿Comenzamos?", () => {
  const seccion = seccionDe("mentoreados");
  const inicio = seccion.inicioEnChat;
  if (!inicio) {
    throw new Error("sin inicio");
  }
  const saludo = saludoInicial({
    inicio,
    nombre: "Gael Ibáñez",
    numeroPreguntas: seccion.preguntas.length,
  });
  const parrafos = saludo.split("\n\n");
  expect(parrafos[0]).toBe(
    "Hola, Gael. Soy el asistente de entrevistas de EtM Tuesday."
  );
  expect(saludo).toMatch(/Conversaremos sobre cinco preguntas breves\./);
  expect(saludo).not.toMatch(/minutos/);
  expect(saludo).toMatch(/mismo enlace/);
  expect(saludo).toMatch(/terminar cuando quieras/);
  expect(saludo).toMatch(/repregunta/);
  expect(saludo).toMatch(/asociadas a tu nombre/);
  expect(parrafos.at(-1)).toBe("¿Comenzamos?");
  expect(saludo.indexOf("asociadas a tu nombre")).toBeLessThan(
    saludo.indexOf("¿Comenzamos?")
  );
  for (const parrafo of parrafos) {
    expect(parrafo.length).toBeLessThan(220);
  }
  expect(
    saludoInicial({
      inicio: { ...inicio, duracionMinutos: 8 },
      numeroPreguntas: 5,
    })
  ).toMatch(/^Hola\. .*aproximadamente 8 minutos/s);
});

test("la configuración de inicio sobrevive el guardado y llega al participante", () => {
  for (const audiencia of AUDIENCIAS) {
    const seccion = seccionDe(audiencia);
    const [guardada] = parseSecciones(JSON.parse(JSON.stringify([seccion])));
    expect(guardada?.inicioEnChat).toEqual(seccion.inicioEnChat);
    expect(guardada?.actividad).toBe(seccion.actividad);
    expect(guardada?.requierenExperiencia).toEqual(
      seccion.requierenExperiencia
    );
    const [publica] = seccionesPublicas(guardada ? [guardada] : []);
    expect(publica?.inicioEnChat?.privacidad.length).toBeGreaterThan(0);
    expect(publica?.inicioEnChat?.duracionMinutos).toBeNull();
  }
  expect(parseInicioEnChat({ asistente: "x" })).toBeUndefined();
});

test("privacidad no promete anonimato ni plazos y dice quién ve y procesa", () => {
  for (const audiencia of AUDIENCIAS) {
    const inicio = inicioEnChatEtm(audiencia);
    const todo = [...inicio.privacidad, ...inicio.ia]
      .map((bloque) => `${bloque.titulo} ${bloque.texto}`)
      .join(" ");
    expect(todo).not.toMatch(PROMESA_ANONIMATO);
    expect(todo).not.toMatch(
      /geolocaliz|ubicaci[oó]n|informaci[oó]n sensible|\d+ d[ií]as/i
    );
    expect(inicio.privacidad.some((bloque) => bloque.pendiente)).toBe(false);
    expect(todo).toMatch(/no es anónima/);
    expect(todo).toMatch(/consultadas por Majoriti/);
    expect(todo).not.toMatch(/equipo de EtM|las revisan/i);
    expect(todo).toMatch(/IA de terceros/);
    expect(todo).toMatch(/puede interpretar mal/i);
  }
});

test("ComplianceLatam conserva sus pantallas de bienvenida", () => {
  for (const seccion of seccionesDeGuionClFase2()) {
    expect(seccion.inicioEnChat).toBeUndefined();
    expect(seccion.requierenExperiencia).toBeUndefined();
  }
});

test("las preguntas siguen abiertas, sin escalas", () => {
  expect(INSTRUCCIONES_AGENTE_ETM).toMatch(/abiertas/);
  for (const turno of ["objetivo", "seguimiento", "aclaracion"] as const) {
    const prompt = promptConversacionContinua({
      preguntaActual:
        "¿Qué tendría que mantenerse o cambiar para que recomendaras esta experiencia a otro emprendedor?",
      trato: "tu",
      turno,
    });
    expect(prompt).toMatch(/Nunca pidas una nota, una puntuación, una escala/);
  }
  for (const audiencia of AUDIENCIAS) {
    for (const pregunta of seccionDe(audiencia).preguntas) {
      expect(pregunta).not.toMatch(ESCALA);
    }
  }
});

test("un «No participé» ambiguo se aclara una vez y no salta a cómo encajó el mentor", () => {
  const seccion = seccionDe("mentoreados");
  const primera = mensaje("assistant", seccion.preguntas[0] ?? "", {
    clase: "obligatoria",
    indiceObligatoria: 0,
  });
  const ambiguo = planificarConversacionContinua({
    messages: [primera, mensaje("user", "No participé")],
    seccion,
  });
  expect(ambiguo.clase).toBe("aclaracion");
  expect(ambiguo.indiceObligatoria).toBe(0);
  expect(ambiguo.guiaTurno).toMatch(/la conversación de mentoría/);

  const aclaracion = mensaje(
    "assistant",
    "¿Te refieres a que no tuviste la conversación de mentoría?",
    { clase: "aclaracion", indiceObligatoria: 0 }
  );
  const confirmado = planificarConversacionContinua({
    messages: [
      primera,
      mensaje("user", "No participé"),
      aclaracion,
      mensaje("user", "Sí"),
    ],
    seccion,
  });
  expect(confirmado.clase).toBe("cierre");
  expect(confirmado.guiaTurno).toMatch(/no aplican/);

  const otraVez = planificarConversacionContinua({
    messages: [
      primera,
      mensaje("user", "No participé"),
      aclaracion,
      mensaje("user", "No participé"),
    ],
    seccion,
  });
  expect(otraVez.clase).not.toBe("aclaracion");
  expect(otraVez.clase).not.toBe("seguimiento");
  expect(otraVez.indiceObligatoria).not.toBe(1);
});

test("sin mentoría confirmada se explora el motivo una vez y se saltan los objetivos que la requieren", () => {
  const seccion = seccionDe("mentoreados");
  const primera = mensaje("assistant", seccion.preguntas[0] ?? "", {
    clase: "obligatoria",
    indiceObligatoria: 0,
  });
  const directo = planificarConversacionContinua({
    messages: [primera, mensaje("user", "No tuve la mentoría.")],
    seccion,
  });
  expect(directo.clase).toBe("seguimiento");
  expect(directo.guiaTurno).toMatch(/qué lo impidió/);

  const trasMotivo = planificarConversacionContinua({
    messages: [
      primera,
      mensaje("user", "No tuve la mentoría."),
      mensaje("assistant", "¿Qué lo impidió?", {
        clase: "seguimiento",
        indiceObligatoria: 0,
      }),
      mensaje("user", "Se cruzó con una reunión del trabajo y no llegué."),
    ],
    seccion,
  });
  expect(trasMotivo.clase).toBe("cierre");

  const conPendiente = planificarConversacionContinua({
    messages: [
      primera,
      mensaje("user", "No tuve la mentoría."),
      mensaje("assistant", "¿Qué lo impidió?", {
        clase: "seguimiento",
        indiceObligatoria: 0,
      }),
      mensaje("user", "La persona canceló."),
    ],
    seccion: seccionDe("mentores"),
  });
  expect(conPendiente.indiceObligatoria).toBe(4);
  expect(conPendiente.guiaTurno).toMatch(/sí aplica/);
  expect(
    promptConversacionContinua({
      guiaTurno: conPendiente.guiaTurno,
      preguntaActual: seccionDe("mentores").preguntas[4],
      trato: "tu",
      turno: "objetivo",
    })
  ).toMatch(/volver a participar/);

  const mentor = seccionDe("mentores");
  const mentorPrimera = mensaje("assistant", mentor.preguntas[0] ?? "", {
    clase: "obligatoria",
    indiceObligatoria: 0,
  });
  const mentorSinSesion = planificarConversacionContinua({
    messages: [
      mentorPrimera,
      mensaje(
        "user",
        "Me motivó devolver algo al ecosistema, pero al final no tuve la mentoría porque la persona no llegó."
      ),
    ],
    seccion: mentor,
  });
  expect(mentorSinSesion.indiceObligatoria).toBe(4);
});
