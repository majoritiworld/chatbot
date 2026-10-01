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
import { planificarConversacionContinua } from "@/lib/consultoria/conversacion-continua";
import {
  correoRecordatorio,
  destinatariosRecordatorio,
} from "@/lib/consultoria/correos/recordatorio";
import { seccionesDeGuionClFase2 } from "@/lib/consultoria/guiones/compliance-latam-fase-2";
import {
  type AudienciaEtm,
  AVISO_RESPUESTAS_ETM,
  asuntoInvitacionEtm,
  bienvenidaEtm,
  CONTACTO_EMAIL_ETM,
  CUERPO_AGRADECIMIENTO_ETM,
  CUERPO_RECORDATORIO_ETM,
  cuerpoInvitacionEtm,
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

test("cada pauta aprobada es una conversación de cinco preguntas", () => {
  for (const audiencia of AUDIENCIAS) {
    const [seccion] = seccionesDeGuionEtm(audiencia);
    expect(seccion).toBeTruthy();
    expect(seccion?.conversacionContinua).toBe(true);
    expect(seccion?.preguntas).toHaveLength(5);
    expect(seccion?.seguimientos).toHaveLength(5);
    expect(seccion?.maxSeguimientos).toBe(MAX_SEGUIMIENTOS_ETM);
    expect(cuerpoInvitacionEtm(audiencia)).not.toMatch(/minutos/i);
  }
  expect(preguntasPrincipalesEtm("mentores")[0]).toMatch(/motivó/i);
  expect(preguntasPrincipalesEtm("mentoreados")[0]).toMatch(/necesitabas/i);
  expect(preguntasPrincipalesEtm("sponsors")[0]).toMatch(/buscaban/i);
  expect(INSTRUCCIONES_AGENTE_ETM).toMatch(/como máximo un seguimiento/i);
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
  expect(trasAclaracion.clase).not.toBe("seguimiento");
  expect(trasAclaracion.indiceObligatoria).toBe(1);

  const cubreLoSiguiente = planificarConversacionContinua({
    messages: [
      mensaje("assistant", seccion.preguntas[0] ?? "", {
        clase: "obligatoria",
        indiceObligatoria: 0,
      }),
      mensaje(
        "user",
        "Buscábamos presencia y la experiencia quedó por debajo. Lo más valioso que se llevaron de su participación fue una reunión, sin otros resultados. El evento aportó para posicionarse en el ecosistema de emprendimiento e inversión. Trabajar con el equipo para preparar la participación fue claro. Si pudiera cambiar una sola cosa de la próxima participación para que fuera más valiosa, sería el montaje."
      ),
    ],
    seccion,
  });
  expect(cubreLoSiguiente.clase).toBe("cierre");
  expect(cubreLoSiguiente.forzarOferta).toBe(true);

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
        "Buscábamos visibilidad y la experiencia quedó por debajo."
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
