import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { streamText, tool } from "ai";
import { z } from "zod";
import {
  entrevistaSimuladaLocal,
  modeloEntrevistaSimulada,
  resumenCierreSimulado,
  textoTurnoSimulado,
} from "@/lib/ai/entrevista-simulada";
import {
  partesDePregunta,
  planificarConversacionContinua,
  promptConversacionContinua,
  textoFijoRecorridoBreve,
} from "@/lib/consultoria/conversacion-continua";
import {
  correoRecordatorio,
  destinatariosRecordatorio,
} from "@/lib/consultoria/correos/recordatorio";
import { correoInvitacion } from "@/lib/consultoria/correos/variantes";
import { seccionesDeGuionClFase2 } from "@/lib/consultoria/guiones/compliance-latam-fase-2";
import {
  ASUNTO_INVITACION_EXPERIENCIA_CORTO,
  ASUNTO_INVITACION_MENTOREADO_CORTO,
  type AudienciaEtm,
  AVISO_RESPUESTAS_ETM,
  asuntoInvitacionEtm,
  bienvenidaEtm,
  CONTACTO_EMAIL_ETM,
  CUERPO_AGRADECIMIENTO_ETM,
  CUERPO_RECORDATORIO_ETM,
  cuerpoInvitacionEtm,
  cuerpoInvitacionExperienciaCorta,
  cuerpoInvitacionMentoreadoCorto,
  FASES_ETM_TUESDAY,
  INSTRUCCIONES_AGENTE_ETM,
  inicioEnChatEtm,
  MAX_SEGUIMIENTOS_ETM,
  preguntasPrincipalesEtm,
  seccionesDeGuionEtm,
} from "@/lib/consultoria/guiones/etm-tuesday";
import {
  copiaOcultaEtm,
  debeRetenerCorreoEtm,
  esParticipantePruebaEtm,
  esPruebaSebaEtm,
  PARTICIPANTES_APROBADOS_ETM,
  PARTICIPANTES_PRUEBA_ETM,
} from "@/lib/consultoria/invitacion-etm";
import { herramientasDelTurno } from "@/lib/consultoria/pasos-entrevista";
import type { ChatMessage } from "@/lib/types";

const AUDIENCIAS_ETM = ["mentores", "mentoreados", "sponsors"] as const;

const AUDIENCIAS: AudienciaEtm[] = ["mentores", "mentoreados", "sponsors"];
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
      ? {
          createdAt: "2026-10-01T00:00:00.000Z",
          ...metadata,
        }
      : undefined,
    parts: [{ text: texto, type: "text" }],
    role,
  };
}

test("cada pauta aprobada deja la profundización aparte de las preguntas principales", () => {
  for (const audiencia of AUDIENCIAS) {
    const [seccion] = seccionesDeGuionEtm(audiencia);
    const principales = audiencia === "sponsors" ? 4 : 3;
    expect(seccion).toBeTruthy();
    expect(seccion?.conversacionContinua).toBe(true);
    expect(seccion?.profundizacionDesde).toBe(principales);
    expect(seccion?.inicioEnChat?.recorridoBreve).toBe(true);
    expect(seccion?.preguntas).toHaveLength(principales + 3);
    expect(seccion?.seguimientos).toHaveLength(principales + 3);
    expect(seccion?.maxSeguimientos).toBe(MAX_SEGUIMIENTOS_ETM);
    expect(cuerpoInvitacionEtm(audiencia)).not.toMatch(
      /minutos|cinco preguntas/i
    );
    expect(bienvenidaEtm(audiencia)).not.toMatch(/cinco preguntas|minutos/i);
  }
  expect(preguntasPrincipalesEtm("mentores", "masculino")[0]).toBe(
    "¿Qué te motivó a participar como mentor en el ETM Tuesday?"
  );
  expect(preguntasPrincipalesEtm("mentores", "femenino")[0]).toBe(
    "¿Qué te motivó a participar como mentora en el ETM Tuesday?"
  );
  expect(preguntasPrincipalesEtm("mentores")[1]).toMatch(
    /match con tu mentoreado\/a fue bueno/i
  );
  expect(preguntasPrincipalesEtm("mentores")[2]).toMatch(
    /más difícil o frustrante/i
  );
  expect(preguntasPrincipalesEtm("mentores")[3]).toMatch(
    /Volverías a participar/i
  );
  expect(preguntasPrincipalesEtm("mentoreados")[0]).toMatch(
    /programa de mentoría/i
  );
  expect(preguntasPrincipalesEtm("mentoreados")[1]).toMatch(
    /match con tu mentor/i
  );
  expect(preguntasPrincipalesEtm("mentoreados")[3]).toMatch(
    /decisión concreta/i
  );
  expect(preguntasPrincipalesEtm("sponsors")[0]).toMatch(/como sponsor/i);
  expect(preguntasPrincipalesEtm("sponsors")[1]).toMatch(/te sorprendió/i);
  expect(preguntasPrincipalesEtm("sponsors")[2]).toMatch(
    /organización y comunicación con ETM/i
  );
  expect(preguntasPrincipalesEtm("sponsors")[3]).toMatch(/en una frase/i);
  expect(preguntasPrincipalesEtm("sponsors")[4]).toMatch(
    /esperabas que pasara/i
  );
  expect(preguntasPrincipalesEtm("sponsors")[6]).toMatch(/ETM Tuesday/i);
  expect(INSTRUCCIONES_AGENTE_ETM).toMatch(/aclaración natural/i);
  expect(INSTRUCCIONES_AGENTE_ETM).toMatch(
    /Un seguimiento no es una de esas preguntas/i
  );
  expect(INSTRUCCIONES_AGENTE_ETM).toMatch(/No fuerces un nexo/i);
});

test("la invitación corta de mentoreado habla del emprendimiento sin nombrarlo y no agrega párrafos", () => {
  const cuerpo = cuerpoInvitacionMentoreadoCorto();
  const correo = correoInvitacion({
    destinatario: {
      email: "amelia.somavia@emprendetumente.org",
      nombre: "Amelia",
    },
    enlace: {
      entrevistaId: "c205286e-bd41-49c8-bcbf-f5c996004a52",
      modo: "enlace_personal",
      url: "https://portal.majoriti.world/e/token",
    },
    identidad: {
      cliente: "ETM Tuesday",
      color: null,
      contactoEmail: CONTACTO_EMAIL_ETM,
      contactoNombre: null,
      logoUrl: null,
      titulo: ASUNTO_INVITACION_MENTOREADO_CORTO,
    },
    minutos: null,
    textos: {
      asunto: ASUNTO_INVITACION_MENTOREADO_CORTO,
      cuerpo,
      firma: "Equipo ETM Tuesday",
      remitente: null,
    },
    trato: "tu",
  });
  expect(correo.subject).toBe(ASUNTO_INVITACION_MENTOREADO_CORTO);
  expect(correo.text).toContain("Hola, Amelia:");
  expect(correo.text).toContain(
    "En EtMtuesday queremos conocer cómo viviste tu mentoría con tu emprendimiento"
  );
  expect(correo.text).toContain("o mejor aún, con tu voz.");
  expect(correo.text).toContain(
    "¡Ayúdanos a construir una mejor experiencia para futuros emprendedores con unos minutos de tu tiempo!"
  );
  expect(correo.text).not.toContain("guardar tu avance");
  expect(correo.text).not.toContain("cinco preguntas");
  expect(correo.text).not.toContain("quedan asociadas a tu nombre");
});

test("la invitación corta de mentor y sponsor nombra el segmento y no agrega párrafos", () => {
  for (const caso of [
    {
      apertura:
        "En EtM Tuesday queremos conocer cómo viviste tu mentoría en el EtM Tuesday!",
      audiencia: "mentores",
      nombre: "Juan Pablo",
    },
    {
      apertura:
        "En EtM Tuesday queremos conocer cómo viviste tu participación en el EtM Tuesday!",
      audiencia: "sponsors",
      nombre: "Claudia",
    },
  ] as const) {
    const cuerpo = cuerpoInvitacionExperienciaCorta(caso.audiencia);
    const correo = correoInvitacion({
      destinatario: {
        email: "persona@example.test",
        nombre: caso.nombre,
      },
      enlace: {
        entrevistaId: "c205286e-bd41-49c8-bcbf-f5c996004a52",
        modo: "enlace_personal",
        url: "https://portal.majoriti.world/e/token",
      },
      identidad: {
        cliente: "ETM Tuesday",
        color: null,
        contactoEmail: CONTACTO_EMAIL_ETM,
        contactoNombre: null,
        logoUrl: null,
        titulo: ASUNTO_INVITACION_EXPERIENCIA_CORTO,
      },
      minutos: null,
      textos: {
        asunto: ASUNTO_INVITACION_EXPERIENCIA_CORTO,
        cuerpo,
        firma: "Equipo ETM Tuesday",
        remitente: null,
      },
      trato: "tu",
    });
    expect(correo.subject).toBe("Evalua tu experiencia en EtM Tuesday");
    expect(correo.text).toContain(`Hola, ${caso.nombre}:`);
    expect(correo.text).toContain(caso.apertura);
    expect(correo.text).toContain("o mejor aún, con tu voz.");
    expect(correo.text).toContain(
      "Ayúdanos a construir una mejor experiencia para futuros emprendedores con unos minutos de tu tiempo."
    );
    expect(correo.text).not.toContain("guardar tu avance");
    expect(correo.text).not.toContain("cinco preguntas");
  }
});

test("un sí para comenzar no responde la primera pregunta", () => {
  const [seccion] = seccionesDeGuionEtm("sponsors");
  if (!seccion) {
    throw new Error("sin pauta");
  }
  const comienzo = planificarConversacionContinua({
    messages: [mensaje("user", "si")],
    seccion,
  });
  expect(comienzo.clase).toBe("obligatoria");
  expect(comienzo.indiceObligatoria).toBe(0);
  expect(comienzo.seguimientoSiguiente).toBe(
    "¿Cómo describirías tu experiencia como sponsor en este evento?"
  );
  expect(
    textoFijoRecorridoBreve({
      clase: comienzo.clase,
      pregunta: comienzo.seguimientoSiguiente,
      recorridoBreve: true,
    })
  ).toBe(comienzo.seguimientoSiguiente);

  const despuesDelEjemplo = planificarConversacionContinua({
    messages: [
      mensaje("user", "si"),
      mensaje(
        "assistant",
        "¿Podrías darme un ejemplo concreto de qué cambiarías?",
        { clase: "seguimiento", indiceObligatoria: 0 }
      ),
      mensaje("user", "El tiempo de las mesas."),
    ],
    seccion,
  });
  expect(despuesDelEjemplo.clase).toBe("obligatoria");
  expect(despuesDelEjemplo.indiceObligatoria).toBe(0);
});

test("después de una respuesta el agente conversa y la primera pregunta sigue fija", () => {
  const [seccion] = seccionesDeGuionEtm("sponsors");
  if (!seccion) {
    throw new Error("sin pauta");
  }
  const pregunta = seccion.preguntas[1] ?? "";
  expect(
    textoFijoRecorridoBreve({
      clase: "obligatoria",
      pregunta: seccion.preguntas[0],
      recorridoBreve: true,
    })
  ).toBe(seccion.preguntas[0]);
  expect(
    textoFijoRecorridoBreve({
      clase: "obligatoria",
      conversar: true,
      pregunta,
      recorridoBreve: true,
    })
  ).toBeUndefined();
  const guia = promptConversacionContinua({
    preguntaActual: pregunta,
    recorridoBreve: true,
    trato: "tu",
    turno: "objetivo",
  });
  expect(guia).toMatch(/significó para ella/i);
  expect(guia).toMatch(/historial completo/i);
  expect(guia).toMatch(/no recites un hecho/i);
  expect(guia).toContain(pregunta);
  expect(guia).not.toMatch(/tal como está/);
});

test("un cambio ya dicho reemplaza la pregunta genérica de la organización", () => {
  const guia = promptConversacionContinua({
    escucha: {
      ultimaRespuesta:
        "Cambiaría que el programa del día se envíe con más anticipación.",
    },
    preguntaActual:
      "¿Sentiste que la organización y comunicación con ETM fue fluida?",
    recorridoBreve: true,
    trato: "tu",
    turno: "objetivo",
  });
  expect(guia).toMatch(/programa del día se envíe/i);
  expect(guia).toMatch(/si todo fue fluido/);
});

test("un problema de coordinación anterior reemplaza la pregunta genérica", () => {
  const guia = promptConversacionContinua({
    dicho:
      "Mejoraría la coordinación previa. La ubicación del stand nos la confirmaron el día anterior.",
    escucha: {
      ultimaRespuesta:
        "Me sorprendió lo abiertos que estaban los emprendedores.",
    },
    preguntaActual:
      "¿Sentiste que la organización y comunicación con ETM fue fluida?",
    recorridoBreve: true,
    trato: "tu",
    turno: "objetivo",
  });
  expect(guia).toMatch(/coordinación/i);
  expect(guia).toMatch(/Última respuesta/i);
  expect(guia).toMatch(/si todo fue fluido/);
});

test("la cobertura semántica validada también cubre objetivos compuestos", () => {
  const [seccion] = seccionesDeGuionEtm("sponsors");
  if (!seccion) {
    throw new Error("sin pauta");
  }
  const plan = planificarConversacionContinua({
    lectura: {
      cubiertos: [2],
      negativa: false,
      profundizar: false,
      tipo: "sustantiva",
    },
    messages: [
      mensaje("assistant", seccion.preguntas[1] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 1,
      }),
      mensaje(
        "user",
        "Me sorprendió lo abiertos que estaban los emprendedores."
      ),
    ],
    seccion,
  });
  expect(plan.indiceObligatoria).toBe(3);
});

test("no pide resumir un valor que ya está dicho", () => {
  const [seccion] = seccionesDeGuionEtm("sponsors");
  if (!seccion) {
    throw new Error("sin pauta");
  }
  const plan = planificarConversacionContinua({
    lectura: {
      cubiertos: [3],
      negativa: false,
      profundizar: false,
      tipo: "sustantiva",
    },
    messages: [
      mensaje("assistant", seccion.preguntas[0] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 0,
      }),
      mensaje(
        "user",
        "Salimos con dos reuniones agendadas con personas a las que podemos ayudar. Nos costó preparar el stand con tan poco aviso."
      ),
      mensaje("assistant", seccion.preguntas[1] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 1,
      }),
      mensaje(
        "user",
        "Me sorprendió lo abiertos que estaban los emprendedores."
      ),
      mensaje("assistant", seccion.preguntas[2] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 2,
      }),
      mensaje("user", "A medias. La persona de contacto respondió rápido."),
    ],
    seccion,
  });
  expect(plan.clase).toBe("cierre");
  expect(plan.indiceObligatoria).toBeUndefined();
});

test("una respuesta concreta y breve no abre otra subpregunta", () => {
  const [seccion] = seccionesDeGuionEtm("mentores", "femenino");
  if (!seccion) {
    throw new Error("sin pauta");
  }
  const [experiencia] = partesDePregunta(seccion.preguntas[1] ?? "");
  const [mejor] = partesDePregunta(seccion.preguntas[2] ?? "");
  const corta = planificarConversacionContinua({
    messages: [
      mensaje("assistant", experiencia ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 1,
      }),
      mensaje("user", "Duró veinte minutos."),
    ],
    seccion,
  });
  expect(corta.clase).toBe("obligatoria");
  expect(corta.indiceObligatoria).toBe(2);
  expect(corta.seguimientoSiguiente).toBe(mejor);

  const concreta = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[1] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 1,
      }),
      mensaje("user", "No calzamos: hablamos de temas distintos."),
    ],
    seccion,
  });
  expect(concreta.clase).toBe("obligatoria");
  expect(concreta.indiceObligatoria).toBe(2);
  expect(concreta.seguimientoSiguiente).toBe(mejor);
});

test("un seguimiento no reemplaza la pregunta de la guía ni el cierre", () => {
  const [seccion] = seccionesDeGuionEtm("mentoreados");
  const pregunta = seccion?.preguntas[1] ?? "";
  expect(
    textoFijoRecorridoBreve({
      clase: "obligatoria",
      pregunta,
      recorridoBreve: true,
    })
  ).toBe(pregunta);
  expect(
    textoFijoRecorridoBreve({
      clase: "seguimiento",
      pregunta,
      recorridoBreve: true,
    })
  ).toBeUndefined();
  expect(
    textoFijoRecorridoBreve({
      clase: "cierre",
      nombre: "Bruno Salas",
      ofrecerProfundizacion: true,
      recorridoBreve: true,
    })
  ).toBe(
    "Gracias, Bruno. Te agradecemos el tiempo. Si quieres, ya puedes finalizar. Pero si tienes un ratito más, en verdad nos encantaría continuar con un par de preguntas de profundización."
  );
  expect(
    textoFijoRecorridoBreve({
      clase: "cierre",
      emprendimientoGenerico: true,
      nombre: "Renata",
      organizacion: "Taller Sur",
      recorridoBreve: true,
    })
  ).toBe(
    "Gracias, Renata. Te deseo lo mejor con tu emprendimiento. Puedes finalizar con el botón Finalizar."
  );
  const pauta = promptConversacionContinua({
    emprendimientoGenerico: true,
    nombre: "Renata",
    organizacion: "Taller Sur",
    preguntaActual: "¿Sentiste que hubo match con tu mentor/a?",
    recorridoBreve: true,
    trato: "tu",
    turno: "objetivo",
  });
  expect(pauta).toContain("di «tu emprendimiento»");
  expect(pauta).not.toContain("Taller Sur");
  expect(
    textoFijoRecorridoBreve({
      clase: "obligatoria",
      pregunta,
      recorridoBreve: false,
    })
  ).toBeUndefined();
});

test("un seguimiento por objetivo y se respeta no sé, la aclaración y lo ya contado", () => {
  const [seccion] = seccionesDeGuionEtm("sponsors");
  if (!seccion) {
    throw new Error("sin pauta");
  }
  const abierta = planificarConversacionContinua({
    messages: [],
    seccion,
  });
  expect(abierta.indiceObligatoria).toBe(0);
  expect(abierta.clase).toBe("obligatoria");

  const breve = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[0] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 0,
      }),
      mensaje("user", "Fue regular."),
    ],
    seccion,
  });
  expect(breve.clase).toBe("seguimiento");
  expect(breve.indiceObligatoria).toBe(0);

  const noSe = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[0] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 0,
      }),
      mensaje("user", "No sé"),
    ],
    seccion,
  });
  expect(noSe.clase).toBe("obligatoria");
  expect(noSe.indiceObligatoria).toBe(1);

  const elogio = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[0] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 0,
      }),
      mensaje("user", "Buena pregunta"),
    ],
    seccion,
  });
  expect(elogio.clase).toBe("aclaracion");

  const trasAclaracion = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[0] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 0,
      }),
      mensaje("user", "Buena pregunta"),
      mensaje("assistant", "Te pregunto qué buscaban al participar.", {
        clase: "aclaracion",
        indiceObligatoria: 0,
      }),
      mensaje("user", "Contactos."),
    ],
    seccion,
  });
  expect(trasAclaracion.clase).toBe("seguimiento");
  expect(trasAclaracion.indiceObligatoria).toBe(0);

  const cubreLoSiguiente = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[0] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 0,
      }),
      mensaje(
        "user",
        "Me sorprendió de forma positiva y también negativamente. La organización y la comunicación fueron fluidas y funcionó el aviso. Si tuvieras que resumir el evento en una frase, dirías que ordenó la agenda."
      ),
    ],
    seccion,
  });
  expect(cubreLoSiguiente.clase).toBe("cierre");
  expect(cubreLoSiguiente.forzarOferta).toBe(true);
  expect(cubreLoSiguiente.ofrecerProfundizacion).toBe(true);

  const negativa = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[0] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 0,
      }),
      mensaje("user", "No participé."),
    ],
    seccion,
  });
  expect(negativa.clase).toBe("aclaracion");
  expect(negativa.indiceObligatoria).toBe(0);

  const completa = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[0] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 0,
      }),
      mensaje(
        "user",
        "Buscábamos visibilidad con otras personas del programa y la experiencia quedó por debajo de lo que esperábamos para el emprendimiento."
      ),
    ],
    seccion,
  });
  expect(completa.clase).toBe("obligatoria");
  expect(completa.indiceObligatoria).toBe(1);

  const omision = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[1] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 1,
      }),
      mensaje("user", "Prefiero no responder"),
    ],
    seccion,
  });
  expect(omision.clase).not.toBe("seguimiento");
  expect(omision.indiceObligatoria).toBe(2);

  const repetida = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[0] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 0,
      }),
      mensaje("user", "el input del mentor"),
      mensaje("assistant", seccion.preguntas[1] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 1,
      }),
      mensaje("user", "el input del mentor"),
    ],
    seccion,
  });
  expect(repetida.clase).toBe("seguimiento");
  expect(repetida.indiceObligatoria).toBe(1);

  const segundaVez = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[0] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 0,
      }),
      mensaje("user", "Bien"),
      mensaje("assistant", "¿Qué estaba pasando en ese momento?", {
        clase: "seguimiento",
        indiceObligatoria: 0,
      }),
      mensaje("user", "Bien"),
    ],
    seccion,
  });
  expect(segundaVez.clase).toBe("obligatoria");
  expect(segundaVez.indiceObligatoria).toBe(1);

  const ultima = seccion.preguntas.length - 1;
  const impacto = planificarConversacionContinua({
    messages: [
      mensaje("user", "Continuar con la profundización"),
      mensaje("assistant", seccion.preguntas[ultima] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: ultima,
      }),
      mensaje(
        "user",
        "Definitivamente. Pregúntenle a él, pero por mi parte diría que sí."
      ),
    ],
    seccion,
  });
  expect(impacto.clase).toBe("cierre");
  expect(impacto.ofrecerProfundizacion).toBeUndefined();

  const agradecimiento = planificarConversacionContinua({
    messages: [
      mensaje("user", "Continuar con la profundización"),
      mensaje("assistant", seccion.preguntas[ultima] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: ultima,
      }),
      mensaje("user", "Sí"),
      mensaje("assistant", "¿Qué pasó en ese momento?", {
        clase: "seguimiento",
        indiceObligatoria: ultima,
      }),
      mensaje("user", "su agradecimiento genuino"),
    ],
    seccion,
  });
  expect(agradecimiento.clase).toBe("cierre");

  const si = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[2] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 2,
      }),
      mensaje("user", "Sí"),
    ],
    seccion,
  });
  expect(si.clase).toBe("seguimiento");
  expect(si.indiceObligatoria).toBe(2);

  const frase = planificarConversacionContinua({
    messages: [
      mensaje("user", "Continuar con la profundización"),
      mensaje("assistant", seccion.preguntas[3] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 3,
      }),
      mensaje("user", "Definitivamente. Son dos horas que llenan el corazón."),
      mensaje("assistant", "¿Qué pasó para que digas eso?", {
        clase: "seguimiento",
        indiceObligatoria: 3,
      }),
      mensaje("user", "A veces no habrá match, pero hay que jugársela."),
    ],
    seccion,
  });
  expect(frase.clase).toBe("obligatoria");
  expect(frase.indiceObligatoria).toBe(4);

  const porHoy = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[4] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 4,
      }),
      mensaje("user", "creo que estoy por hoy"),
    ],
    seccion,
  });
  expect(porHoy.clase).toBe("cierre");
  expect(porHoy.ofrecerProfundizacion).toBeUndefined();
});

test("las tres pautas tratan breve, no sé y elogio igual, y ComplianceLatam sigue por secciones", () => {
  for (const audiencia of AUDIENCIAS) {
    const [seccion] = seccionesDeGuionEtm(audiencia);
    if (!seccion) {
      throw new Error(audiencia);
    }
    const previa = mensaje("assistant", seccion.preguntas[0] ?? "", {
      clase: "obligatoria",
      indiceObligatoria: 0,
    });
    expect(
      planificarConversacionContinua({
        messages: [previa, mensaje("user", "Fue regular.")],
        seccion,
      }).clase
    ).toBe("seguimiento");
    expect(
      planificarConversacionContinua({
        messages: [previa, mensaje("user", "No sé")],
        seccion,
      }).indiceObligatoria
    ).toBe(1);
    expect(
      planificarConversacionContinua({
        messages: [previa, mensaje("user", "Buena pregunta")],
        seccion,
      }).clase
    ).toBe("aclaracion");
  }
  const firmas = seccionesDeGuionClFase2();
  expect(firmas.length).toBeGreaterThan(1);
  for (const seccion of firmas) {
    expect(seccion.conversacionContinua).toBeUndefined();
  }
});

test("el seguimiento de la conversación continua no puede ofrecer el cierre", () => {
  expect(
    herramientasDelTurno({
      forzarOferta: false,
      messages: [],
      ocultarCierre: true,
    })
  ).toEqual([]);
  expect(
    herramientasDelTurno({
      forzarOferta: true,
      messages: [],
      ocultarCierre: true,
    })
  ).toEqual(["ofrecerCierreSeccion"]);
});

test("el aviso no promete anonimato y dice que va con el nombre", () => {
  expect(AVISO_RESPUESTAS_ETM).not.toMatch(PROMESA_ANONIMATO);
  expect(AVISO_RESPUESTAS_ETM).toMatch(/asociadas a tu nombre/);
  expect(AVISO_RESPUESTAS_ETM).toMatch(/no es anónima/);
  expect(INSTRUCCIONES_AGENTE_ETM).toMatch(/No prometas anonimato/);
});

test("el recordatorio excluye a quien ya completó y no tiene un envío", () => {
  const filas = [
    { email: "a@example.test", estado: "pendiente" as const },
    { email: "b@example.test", estado: "en_curso" as const },
    { email: "c@example.test", estado: "completada" as const },
  ];
  expect(destinatariosRecordatorio(filas).map((fila) => fila.email)).toEqual([
    "a@example.test",
    "b@example.test",
  ]);
  const fuente = readFileSync("lib/consultoria/email-entrevista.ts", "utf8");
  expect(fuente).not.toContain("correoRecordatorio");
  expect(CUERPO_RECORDATORIO_ETM).not.toMatch(/prueba|demo/i);
});

test("ETM retiene el lote; pasan Seba y las tres pruebas aprobadas", () => {
  for (const fase of FASES_ETM_TUESDAY) {
    expect(debeRetenerCorreoEtm(fase)).toBe(true);
    for (const email of PARTICIPANTES_APROBADOS_ETM) {
      expect(debeRetenerCorreoEtm(fase, { email })).toBe(false);
      expect(
        debeRetenerCorreoEtm(fase, { email: ` ${email.toUpperCase()} ` })
      ).toBe(false);
      expect(esPruebaSebaEtm(fase, email)).toBe(false);
      expect(copiaOcultaEtm(fase, email)).toBe("seba@majoriti.world");
    }
    expect(copiaOcultaEtm(fase, "seba@majoriti.world")).toBeNull();
    expect(copiaOcultaEtm(fase, "otra.persona@emprendetumente.org")).toBeNull();
    expect(debeRetenerCorreoEtm(fase, { email: " Seba@Majoriti.world " })).toBe(
      false
    );
    expect(esPruebaSebaEtm(fase, "seba@majoriti.world")).toBe(true);
    expect(
      debeRetenerCorreoEtm(fase, { email: "otra.persona@emprendetumente.org" })
    ).toBe(true);
    expect(debeRetenerCorreoEtm(fase, { email: "ficticia@example.test" })).toBe(
      true
    );
    expect(
      debeRetenerCorreoEtm(fase, {
        email: "ficticia@example.test",
        resendBaseUrl: "http://127.0.0.1:54329",
      })
    ).toBe(false);
    expect(
      debeRetenerCorreoEtm(fase, {
        email: "ficticia@example.test",
        resendBaseUrl: "https://api.resend.com",
      })
    ).toBe(true);
  }
  expect(PARTICIPANTES_APROBADOS_ETM.size).toBe(3);
  expect(
    copiaOcultaEtm(
      "Entrevistas a colaboradores",
      "gabriel.fuentes@emprendetumente.org"
    )
  ).toBeNull();
  expect(esPruebaSebaEtm("Colaboradores", "seba@majoriti.world")).toBe(false);
  expect(debeRetenerCorreoEtm("Entrevistas a Firmas Socias")).toBe(false);
  expect(debeRetenerCorreoEtm("Mentores")).toBe(false);
  for (const email of PARTICIPANTES_PRUEBA_ETM) {
    expect(esParticipantePruebaEtm(email)).toBe(true);
  }
});

test("los textos que ve la persona no hablan de demo ni de prueba", () => {
  const textos = [
    AVISO_RESPUESTAS_ETM,
    CUERPO_AGRADECIMIENTO_ETM,
    ...AUDIENCIAS_ETM.flatMap((audiencia) => {
      const inicio = inicioEnChatEtm(audiencia);
      return [
        asuntoInvitacionEtm(audiencia),
        cuerpoInvitacionEtm(audiencia),
        bienvenidaEtm(audiencia),
        inicio.proposito,
        inicio.respuestaFuncionamiento,
        inicio.respuestaPrivacidad,
        inicio.usoRespuestas,
        ...[...inicio.ia, ...inicio.privacidad].map(
          (bloque) => `${bloque.titulo} ${bloque.texto}`
        ),
      ];
    }),
  ].join(" ");
  expect(textos).not.toMatch(/\bdemo\b|prueba|ficticia|piloto|reunión/i);
  expect(CONTACTO_EMAIL_ETM).toBe("seba@majoriti.world");
});

test("el simulador solo se activa en local y con la bandera", () => {
  expect(
    entrevistaSimuladaLocal({
      ENTREVISTA_SIMULADA: "1",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    })
  ).toBe(true);
  expect(
    entrevistaSimuladaLocal({
      ENTREVISTA_SIMULADA: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://oaqjpyhbxagrelhwzyuq.supabase.co",
    })
  ).toBe(false);
  expect(
    entrevistaSimuladaLocal({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    })
  ).toBe(false);
});

test("el turno simulado hace la pregunta o el cierre, no ambos", () => {
  const pregunta = textoTurnoSimulado(
    "Preguntas guía de esta sección:\n1. ¿Qué buscabas al participar?",
    null
  );
  expect(pregunta.herramienta).toBeNull();
  expect(pregunta.texto).toBe("¿Qué buscabas al participar?");

  const seguimiento = textoTurnoSimulado(
    "Ejemplos de seguimiento\n- Si queda en general: ¿Qué resultado concreto esperabas?",
    null
  );
  expect(seguimiento.texto).toBe("¿Qué resultado concreto esperabas?");

  const cierre = textoTurnoSimulado("NO hagas ninguna pregunta", null);
  expect(cierre.herramienta).toBe("ofrecerCierreSeccion");
  expect(cierre.texto).not.toMatch(/\?$/);
});

test("el cierre simulado usa las palabras de la persona", () => {
  const resumen = resumenCierreSimulado({
    preguntas: ["¿Qué te sirvió?"],
    tituloSeccion: "La utilidad",
    turnos: [
      { rol: "entrevistador", texto: "¿Qué te sirvió?" },
      {
        rol: "entrevistado",
        texto: "Me quedé con un siguiente paso concreto.",
      },
    ],
  });
  expect(resumen.sintesis).toContain("siguiente paso concreto");
  expect(resumen.respuestas[0]?.respuesta_texto).toContain(
    "siguiente paso concreto"
  );
  expect(resumen.sintesis).not.toContain("¿Qué te sirvió?");
});

test("el correo de recordatorio lleva la marca de ETM y el enlace personal", () => {
  const persona = {
    apellido: "Rivas",
    email: "tomas.rivas.demo@example.test",
    nombre: "Tomás",
    token: "etm-demo-mentor-tomas-002",
  };
  const correo = correoRecordatorio({
    filasAsignacion: {
      entrevistaId: "40000000-0000-4000-8000-000000000011",
      fase: {
        acceso_enlace_personal: true,
        minutos: 12,
        nombre: "Mentores ETM Tuesday",
        proyecto_id: "40000000-0000-4000-8000-000000000010",
      },
      plantillaProyectoId: "40000000-0000-4000-8000-000000000010",
      proyecto: {
        cliente: "Emprendetumente",
        contacto_email: "seba@majoriti.world",
        contacto_nombre: "Equipo ETM Tuesday",
        correo_remitente: "ETM Tuesday",
        id: "40000000-0000-4000-8000-000000000010",
        nombre_publico: "ETM Tuesday",
        slug: "etm-tuesday",
        titulo_iniciativa: "Después de ETM Tuesday",
      },
      stakeholder: {
        apellido: persona.apellido,
        email: persona.email,
        nombre: persona.nombre,
        proyecto_id: "40000000-0000-4000-8000-000000000010",
      },
    },
    permitirLocal: true,
    site: "http://127.0.0.1:3110",
    token: persona.token,
  });
  expect("error" in correo).toBe(false);
  if ("error" in correo) {
    return;
  }
  expect(correo.subject).toContain("ETM Tuesday");
  expect(correo.remitenteVisible).toBe("ETM Tuesday vía Majoriti");
  expect(correo.html).toContain(`/e/${persona.token}`);
  expect(correo.html).not.toContain("majoriti-logo");
  expect(correo.html).not.toMatch(PROMESA_ANONIMATO);
});

test("el modelo simulado llama al cierre cuando el turno lo exige", async () => {
  let llamado = false;
  const result = streamText({
    model: modeloEntrevistaSimulada,
    prompt: "NO hagas ninguna pregunta. Ofrece el cierre.",
    toolChoice: { toolName: "ofrecerCierreSeccion", type: "tool" },
    tools: {
      ofrecerCierreSeccion: tool({
        execute: () => {
          llamado = true;
          return { ok: true };
        },
        inputSchema: z.object({ listo: z.boolean() }),
      }),
    },
  });
  await result.text;
  expect(llamado).toBe(true);
});
