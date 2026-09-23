import { expect, test } from "@playwright/test";
import { postRequestBodySchema } from "@/app/(chat)/api/chat/schema";
import { interviewSystemPrompt, textoSeccionesPrevias } from "@/lib/ai/prompts";
import {
  agenteOfrecioCierreListo,
  cierrePendienteEnChat,
  herramientasCierreActivas,
  mensajesTextoParaModelo,
  ofertaCierreVigenteEnChat,
  ultimoUsuarioEligePausa,
  ultimoUsuarioPideFinalizar,
} from "@/lib/consultoria/cierre-seccion";
import {
  clonarSecciones,
  consolidarRespuestasEntrevista,
  fusionarTurnos,
  haySeccionesPendientes,
  ofertaCierreVigenteEnTurnos,
  parseSecciones,
  parseSeccionesCompletadas,
  resolverAvanceSeccion,
  seccionesDesdeGuionPlano,
  type TurnoEntrevista,
  turnosDeSeccion,
} from "@/lib/consultoria/entrevista-contenido";
import {
  MENSAJE_CONTINUAR_SECCION,
  MENSAJE_FINALIZAR_SECCION,
  MENSAJE_FORZAR_CIERRE_SECCION,
} from "@/lib/consultoria/finalizar-seccion";
import {
  GUION_CL_CORTO,
  NOMBRE_PLANTILLA_CL_CORTO,
} from "@/lib/consultoria/guiones/compliance-latam-corto";
import {
  esProyectoComplianceLatam,
  GUION_CL_FASE_1,
} from "@/lib/consultoria/guiones/compliance-latam-fase-1";
import {
  mensajesATurnos,
  turnosAMensajes,
} from "@/lib/consultoria/mensajes-a-turnos";
import {
  elegirEntrevistaLanding,
  mismoEmail,
  resolveAuthLanding,
  stakeholderPathNeedsLandingInterview,
} from "@/lib/consultoria/roles";
import type { ChatMessage } from "@/lib/types";

const SECCION_CONTEXTO = {
  descripcion: "Contexto",
  id: "section-1",
  preguntas: ["¿Qué cambió?"],
  titulo: "Diagnóstico",
};
const SECCION_CIERRE = {
  descripcion: "",
  id: "section-2",
  preguntas: ["¿Qué sigue?"],
  titulo: "Cierre",
};

test.describe("Interview section flow", () => {
  test("parses only complete sections", () => {
    const secciones = parseSecciones([
      {
        descripcion: "  Contexto  ",
        id: "section-1",
        preguntas: ["¿Qué cambió?", "", 42],
        titulo: "  Diagnóstico  ",
      },
      { id: "invalid", preguntas: [], titulo: "" },
    ]);

    expect(secciones).toEqual([SECCION_CONTEXTO]);
  });

  test("backfills a flat guide as a single interview section", () => {
    const secciones = seccionesDesdeGuionPlano({
      preguntas: ["¿Qué cambió?", ""],
      titulo: "Entrevista",
    });

    expect(secciones).toHaveLength(1);
    expect(secciones.at(0)?.titulo).toBe("Entrevista");
    expect(secciones.at(0)?.preguntas).toEqual(["¿Qué cambió?"]);
    expect(secciones.at(0)?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test("clones section snapshots with new ids", () => {
    const clonadas = clonarSecciones([SECCION_CONTEXTO]);

    expect(clonadas).toEqual([
      {
        ...SECCION_CONTEXTO,
        id: clonadas.at(0)?.id,
      },
    ]);
    expect(clonadas.at(0)?.id).not.toBe(SECCION_CONTEXTO.id);
  });

  test("moves to presentation until the final section", () => {
    expect(resolverAvanceSeccion(0, 3)).toEqual({
      flujoEstado: "presentacion",
      seccionActual: 1,
    });
    expect(resolverAvanceSeccion(2, 3)).toEqual({
      flujoEstado: "revision",
      seccionActual: 3,
    });
  });

  test("detects pending sections from saved completions", () => {
    expect(haySeccionesPendientes([SECCION_CONTEXTO, SECCION_CIERRE], [])).toBe(
      true
    );
    expect(
      haySeccionesPendientes(
        [SECCION_CONTEXTO, SECCION_CIERRE],
        [
          {
            completadaEn: "2026-09-15T00:00:00.000Z",
            hallazgos: ["Un hallazgo"],
            modo: "manual",
            respuestas: [
              { pregunta: "¿Qué cambió?", respuesta_texto: "El proceso" },
            ],
            seccionId: "section-1",
            sintesis: "Cambió el proceso",
          },
        ]
      )
    ).toBe(true);
    expect(
      haySeccionesPendientes(
        [SECCION_CONTEXTO, SECCION_CIERRE],
        [
          {
            completadaEn: "2026-09-15T00:00:00.000Z",
            hallazgos: [],
            modo: "agente",
            respuestas: [],
            seccionId: "section-1",
            sintesis: "Listo",
          },
          {
            completadaEn: "2026-09-15T00:01:00.000Z",
            hallazgos: [],
            modo: "manual",
            respuestas: [],
            seccionId: "section-2",
            sintesis: "Cerrado",
          },
        ]
      )
    ).toBe(false);
  });

  test("consolidates answers and marks unanswered questions", () => {
    const resumen = consolidarRespuestasEntrevista(
      [SECCION_CONTEXTO, SECCION_CIERRE],
      [
        {
          completadaEn: "2026-09-15T00:00:00.000Z",
          hallazgos: ["El proceso cambió"],
          modo: "agente",
          respuestas: [
            { pregunta: "¿Qué cambió?", respuesta_texto: "El proceso" },
          ],
          seccionId: "section-1",
          sintesis: "Cambió el proceso",
        },
      ]
    );

    expect(resumen.respuestas).toEqual([
      { pregunta: "¿Qué cambió?", respuesta_texto: "El proceso" },
      {
        pregunta: "¿Qué sigue?",
        respuesta_texto: "Ver transcripción completa.",
      },
    ]);
    expect(resumen.sintesis).toContain("Diagnóstico:");
  });

  test("parses completed sections and ignores invalid ones", () => {
    const completadas = parseSeccionesCompletadas([
      {
        completadaEn: "2026-09-15T00:00:00.000Z",
        hallazgos: ["Ok"],
        modo: "manual",
        respuestas: [{ pregunta: "A", respuesta_texto: "B" }],
        seccionId: "section-1",
        sintesis: "Listo",
      },
      { seccionId: "section-2" },
    ]);

    expect(completadas).toHaveLength(1);
    expect(completadas.at(0)?.modo).toBe("manual");
  });

  test("isolates transcript turns by section and supports legacy turns", () => {
    const turnos: TurnoEntrevista[] = [
      {
        at: "2026-09-15T00:00:00.000Z",
        id: "turn-1",
        rol: "entrevistador",
        seccionId: null,
        texto: "Turno anterior",
      },
      {
        at: "2026-09-15T00:01:00.000Z",
        id: "turn-2",
        rol: "entrevistado",
        seccionId: "section-1",
        texto: "Respuesta actual",
      },
      {
        at: "2026-09-15T00:02:00.000Z",
        id: "turn-3",
        rol: "entrevistado",
        seccionId: "section-2",
        texto: "Otra sección",
      },
    ];

    expect(turnosDeSeccion(turnos, "section-1", true)).toHaveLength(2);
    expect(turnosDeSeccion(turnos, "section-2")).toEqual([turnos.at(2)]);
  });

  test("keeps repeated text when message IDs are different", () => {
    const base: TurnoEntrevista = {
      at: "2026-09-15T00:00:00.000Z",
      id: "turn-1",
      rol: "entrevistado",
      seccionId: "section-1",
      texto: "Sí",
    };
    const merged = fusionarTurnos(
      [base],
      [{ ...base, id: "turn-2", texto: "Sí" }, base]
    );

    expect(merged.map((turno) => turno.id)).toEqual(["turn-1", "turn-2"]);
  });

  test("tags chat turns with the active section", () => {
    const mensajes: ChatMessage[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        metadata: { createdAt: "2026-09-15T00:00:00.000Z" },
        parts: [{ text: "Hola", type: "text" }],
        role: "user",
      },
    ];

    expect(mensajesATurnos(mensajes, "section-1")).toEqual([
      {
        at: "2026-09-15T00:00:00.000Z",
        id: "11111111-1111-4111-8111-111111111111",
        rol: "entrevistado",
        seccionId: "section-1",
        texto: "Hola",
      },
    ]);
  });

  test("requires seccionId when the chat request belongs to an interview", () => {
    const body = {
      entrevistaId: "11111111-1111-4111-8111-111111111111",
      id: "22222222-2222-4222-8222-222222222222",
      selectedChatModel: "chat-model",
      selectedVisibilityType: "private" as const,
    };

    expect(postRequestBodySchema.safeParse(body).success).toBe(false);
    expect(
      postRequestBodySchema.safeParse({
        ...body,
        seccionId: "33333333-3333-4333-8333-333333333333",
      }).success
    ).toBe(true);
  });
});

test.describe("Interview prompt context", () => {
  test("formats prior sections so the agent can reference them", () => {
    const texto = textoSeccionesPrevias([
      {
        respuestas: [
          { pregunta: "Nota en RRSS", respuesta_texto: "6, poco alcance" },
        ],
        sintesis: "Comunican poco el impacto en redes.",
        titulo: "General",
      },
    ]);

    expect(texto).toContain("### General");
    expect(texto).toContain("Comunican poco el impacto en redes.");
    expect(texto).toContain("Nota en RRSS: 6, poco alcance");
  });

  test("asks the agent not to re-ask covered topics and to paraphrase only sporadically", () => {
    const prompt = interviewSystemPrompt({
      preguntas: ["Qué le ofrecen hoy a una firma socia."],
      seccionesPrevias: [
        {
          respuestas: [
            { pregunta: "Valor a firmas socias", respuesta_texto: "Un 4" },
          ],
          sintesis: "El valor a firmas socias está débil.",
          titulo: "General",
        },
      ],
      tituloSeccion: "Propuesta de valor",
    });

    expect(prompt).toContain("El valor a firmas socias está débil.");
    expect(prompt).toContain("Máximo DOS follow-ups por tema");
    expect(prompt).toContain("unas de cada tres o cuatro respuestas");
    expect(prompt).toContain("no lo vuelvas a preguntar");
    expect(prompt).toContain("no te presentes de nuevo");
    expect(prompt).toContain(MENSAJE_FINALIZAR_SECCION);
    expect(prompt).toContain("ofrecerContinuarOGuardar");
    expect(prompt).toContain("ofrecerCierreSeccion");
    expect(prompt).toContain("Cerrar y continuar");
    expect(prompt).not.toContain("Finalizar entrevista");
    expect(prompt).toContain("puede contestarla ahora o volver más tarde");
    expect(prompt).toContain("no hagas otra pregunta");
    expect(prompt).toContain("listo=true");
    expect(prompt).toContain("herramienta estructurada");
    expect(prompt).toContain(
      "No llames ofrecerCierreSeccion en los demás turnos"
    );
    expect(prompt).toContain("No escribas síntesis");
    expect(prompt).toContain("UNA sola vez");
    expect(prompt).toContain(MENSAJE_FORZAR_CIERRE_SECCION);
    expect(prompt).toContain("español neutro");
    expect(prompt).toContain("No uses voseo rioplatense");
  });

  test("greets in a gender-neutral way when the interviewee has a name", () => {
    const prompt = interviewSystemPrompt({
      nombreEntrevistado: "Alex",
      preguntas: ["Qué cambió esta semana."],
      tituloSeccion: "General",
    });

    expect(prompt).toContain("saluda a la persona por su nombre");
    expect(prompt).toContain("haz de inmediato la primera pregunta");
    expect(prompt).not.toContain("salúdala");
  });

  test("names only the close button that is visible in that section", () => {
    const ultimo = interviewSystemPrompt({
      esUltimoTema: true,
      preguntas: ["Qué cambió esta semana."],
      tituloSeccion: "General",
    });

    expect(ultimo).toContain("Finalizar entrevista");
    expect(ultimo).not.toContain("Cerrar y continuar");
    expect(ultimo).toContain("No inventes otros nombres de botón");
  });
});

test.describe("Interview section close offer", () => {
  test("sends only spoken text to the model, dropping tool-only turns", () => {
    const limpios = mensajesTextoParaModelo([
      {
        id: "a1",
        parts: [
          {
            input: { listo: true },
            output: { ok: true },
            state: "output-available",
            toolCallId: "t1",
            type: "tool-ofrecerCierreSeccion",
          },
        ],
        role: "assistant",
      },
      {
        id: "a2",
        parts: [{ text: "¿Qué cambió esta semana?", type: "text" }],
        role: "assistant",
      },
    ]);

    expect(limpios).toHaveLength(1);
    expect(limpios.at(0)?.id).toBe("a2");
  });
  test("reads a pending close only from the last assistant message", () => {
    const cierre = {
      hallazgos: ["Hay poco seguimiento"],
      respuestas: [{ pregunta: "¿Qué cambió?", respuesta_texto: "Casi nada" }],
      sintesis: "Poco movimiento en el último mes.",
    };
    const messages: ChatMessage[] = [
      {
        id: "a1",
        parts: [
          {
            input: cierre,
            output: { ok: true },
            state: "output-available",
            toolCallId: "t1",
            type: "tool-completarSeccion",
          },
        ],
        role: "assistant",
      },
      {
        id: "u1",
        parts: [{ text: "Sigo pensando", type: "text" }],
        role: "user",
      },
    ];

    expect(cierrePendienteEnChat(messages)).toBeNull();
    expect(cierrePendienteEnChat(messages.slice(0, 1))).toEqual(cierre);
  });

  test("treats the section as ready only after the agent offers close", () => {
    const listo: ChatMessage[] = [
      {
        id: "a1",
        parts: [
          {
            input: { listo: true },
            output: { ok: true },
            state: "output-available",
            toolCallId: "t1",
            type: "tool-ofrecerCierreSeccion",
          },
        ],
        role: "assistant",
      },
    ];
    const incompleto: ChatMessage[] = [
      {
        id: "a2",
        parts: [{ text: "¿Qué cambió esta semana?", type: "text" }],
        role: "assistant",
      },
    ];
    const usuarioSigue: ChatMessage[] = [
      ...listo,
      {
        id: "u1",
        parts: [{ text: "Quiero agregar algo más", type: "text" }],
        role: "user",
      },
    ];

    expect(agenteOfrecioCierreListo(listo)).toBe(true);
    expect(agenteOfrecioCierreListo(incompleto)).toBe(false);
    expect(agenteOfrecioCierreListo(usuarioSigue)).toBe(false);
    expect(ofertaCierreVigenteEnChat(listo)).toBe(true);
    expect(ofertaCierreVigenteEnChat(incompleto)).toBe(false);
    expect(ofertaCierreVigenteEnChat(usuarioSigue)).toBe(true);
  });

  test("persists the close offer on the section turn and rebuilds it after reload", () => {
    const seccionId = "11111111-1111-4111-8111-111111111111";
    const otraSeccion = "22222222-2222-4222-8222-222222222222";
    const listo: ChatMessage[] = [
      {
        id: "a1",
        parts: [
          { text: "Ya tengo lo necesario.", type: "text" },
          {
            input: { listo: true },
            output: { ok: true },
            state: "output-available",
            toolCallId: "t1",
            type: "tool-ofrecerCierreSeccion",
          },
        ],
        role: "assistant",
      },
    ];
    const turnos = mensajesATurnos(listo, seccionId, {
      persistirOfertaEjecutada: true,
    });
    expect(turnos.at(0)?.ofertaCierre).toBe(true);
    expect(turnos.at(0)?.seccionId).toBe(seccionId);

    const reconstruidos = turnosAMensajes(turnos);
    expect(ofertaCierreVigenteEnChat(reconstruidos)).toBe(true);
    expect(agenteOfrecioCierreListo(reconstruidos)).toBe(true);
    expect(ofertaCierreVigenteEnTurnos(turnos, seccionId)).toBe(true);
    expect(ofertaCierreVigenteEnTurnos(turnos, otraSeccion)).toBe(false);
    expect(
      ofertaCierreVigenteEnTurnos(
        [
          {
            at: "2026-09-20T00:00:00.000Z",
            id: "done",
            ofertaCierre: true,
            rol: "entrevistador",
            seccionId,
            texto: "Oferta de otra sección ya cerrada.",
          },
        ],
        otraSeccion
      )
    ).toBe(false);
  });

  test("detects the explicit close request from the last user turn", () => {
    const messages: ChatMessage[] = [
      {
        id: "u1",
        parts: [{ text: MENSAJE_FINALIZAR_SECCION, type: "text" }],
        role: "user",
      },
    ];

    expect(ultimoUsuarioPideFinalizar(messages)).toBe(true);
    expect(
      ultimoUsuarioPideFinalizar([
        {
          id: "u2",
          parts: [{ text: "Todavía quiero contar algo", type: "text" }],
          role: "user",
        },
      ])
    ).toBe(false);
  });

  test("detects continue or save after an early close attempt", () => {
    expect(
      ultimoUsuarioEligePausa([
        {
          id: "u1",
          parts: [{ text: MENSAJE_CONTINUAR_SECCION, type: "text" }],
          role: "user",
        },
      ])
    ).toBe(true);
    expect(
      ultimoUsuarioEligePausa([
        {
          id: "u2",
          parts: [{ text: MENSAJE_FINALIZAR_SECCION, type: "text" }],
          role: "user",
        },
      ])
    ).toBe(false);
  });

  test("forces section completion when the interviewee insists", () => {
    const forzar: ChatMessage[] = [
      {
        id: "u1",
        parts: [{ text: MENSAJE_FORZAR_CIERRE_SECCION, type: "text" }],
        role: "user",
      },
    ];
    const pedir: ChatMessage[] = [
      {
        id: "u2",
        parts: [{ text: MENSAJE_FINALIZAR_SECCION, type: "text" }],
        role: "user",
      },
    ];

    expect(herramientasCierreActivas(forzar)).toEqual(["completarSeccion"]);
    expect(herramientasCierreActivas(pedir)).toEqual([
      "completarSeccion",
      "ofrecerContinuarOGuardar",
    ]);
  });
});

test.describe("ComplianceLatam phase 1 guide", () => {
  test("covers six shared sections and drops Colomba's week walkthrough", () => {
    expect(GUION_CL_FASE_1).toHaveLength(6);
    expect(GUION_CL_FASE_1.map((seccion) => seccion.titulo)).toEqual([
      "General",
      "Propuesta de valor",
      "Modelo de membresías y compromiso",
      "Operación y cuellos de botella",
      "Comité de noviembre",
      "Cierre",
    ]);

    const operacion = GUION_CL_FASE_1.at(3);
    expect(operacion?.preguntas).toHaveLength(3);
    expect(operacion?.preguntas.join(" ")).not.toMatch(/semana pasada/i);
    expect(GUION_CL_FASE_1.at(0)?.preguntas).toHaveLength(6);
    expect(
      esProyectoComplianceLatam({
        cliente: "ComplianceLatam",
        nombre: "ComplianceLatam",
      })
    ).toBe(true);
  });

  test("short support-lawyer guide has three sections and nine questions", () => {
    expect(NOMBRE_PLANTILLA_CL_CORTO).toBe(
      "Diagnóstico corto — abogado de apoyo"
    );
    expect(GUION_CL_CORTO).toHaveLength(3);
    expect(GUION_CL_CORTO.map((seccion) => seccion.titulo)).toEqual([
      "Valor comercial",
      "Cuellos de botella y rol de apoyo",
      "Comité de noviembre",
    ]);
    expect(GUION_CL_CORTO.flatMap((seccion) => seccion.preguntas)).toHaveLength(
      9
    );
    expect(GUION_CL_CORTO.flatMap((seccion) => seccion.preguntas).join(" ")).not.toMatch(
      /redes sociales|vos |tenés|querés/i
    );
  });
});

test.describe("Auth landing", () => {
  test("never sends a portal user to the leftover chat UI", () => {
    expect(resolveAuthLanding("cliente", "/chat/abc", "/portal")).toBe(
      "/portal"
    );
    expect(resolveAuthLanding("cliente", "/", "/portal")).toBe("/portal");
    expect(
      resolveAuthLanding("stakeholder", "/chat/abc", "/portal/entrevista/1")
    ).toBe("/portal/entrevista/1");
    expect(
      resolveAuthLanding(
        "stakeholder",
        "/portal/entrevista/228285c0-5153-469f-b0f1-b13c82b355c0",
        "/portal/entrevista/a83b3fd0-773e-4778-b9f5-dd6819fb3a66"
      )
    ).toBe("/portal/entrevista/228285c0-5153-469f-b0f1-b13c82b355c0");
    expect(
      resolveAuthLanding(
        "stakeholder",
        "https://evil.example/portal/entrevista/228285c0-5153-469f-b0f1-b13c82b355c0",
        "/portal/entrevista/a83b3fd0-773e-4778-b9f5-dd6819fb3a66"
      )
    ).toBe("/portal/entrevista/a83b3fd0-773e-4778-b9f5-dd6819fb3a66");
  });

  test("landing interview lookup is only for home redirects", () => {
    expect(stakeholderPathNeedsLandingInterview("/portal")).toBe(true);
    expect(stakeholderPathNeedsLandingInterview("/portal/fase/x")).toBe(true);
    expect(stakeholderPathNeedsLandingInterview("/chat/abc")).toBe(true);
    expect(stakeholderPathNeedsLandingInterview("/admin")).toBe(true);
    expect(
      stakeholderPathNeedsLandingInterview(
        "/portal/entrevista/8668e9fc-6fc5-42c0-b858-6cc3cc1162cc"
      )
    ).toBe(false);
    expect(stakeholderPathNeedsLandingInterview("/api/chat")).toBe(false);
    expect(stakeholderPathNeedsLandingInterview("/api/entrevista/flujo")).toBe(
      false
    );
  });

  test("home interview prefers in-progress chat over an earlier UUID still in review", () => {
    expect(
      elegirEntrevistaLanding([
        {
          estado: "abierta",
          flujo_estado: "revision",
          id: "228285c0-5153-469f-b0f1-b13c82b355c0",
          ultima_actividad: "2026-09-20T08:54:35.613386+00",
        },
        {
          estado: "completada",
          flujo_estado: "revision",
          id: "484c3223-aadd-4b22-b78a-2e6089736e34",
          ultima_actividad: "2026-09-20T12:27:18.700761+00",
        },
        {
          estado: "abierta",
          flujo_estado: "chat",
          id: "a83b3fd0-773e-4778-b9f5-dd6819fb3a66",
          ultima_actividad: "2026-09-19T12:18:15.166989+00",
        },
      ])
    ).toBe("a83b3fd0-773e-4778-b9f5-dd6819fb3a66");
  });

  test("direct interview URLs keep a pending review even when home prefers chat", () => {
    const homeChat = "/portal/entrevista/a83b3fd0-773e-4778-b9f5-dd6819fb3a66";
    const revisionPendiente =
      "/portal/entrevista/228285c0-5153-469f-b0f1-b13c82b355c0";
    expect(stakeholderPathNeedsLandingInterview(revisionPendiente)).toBe(false);
    expect(resolveAuthLanding("stakeholder", revisionPendiente, homeChat)).toBe(
      revisionPendiente
    );
  });

  test("home interview among review leftovers uses the latest activity, not UUID order", () => {
    expect(
      elegirEntrevistaLanding([
        {
          estado: "abierta",
          flujo_estado: "revision",
          id: "228285c0-5153-469f-b0f1-b13c82b355c0",
          ultima_actividad: "2026-09-20T08:54:35.613386+00",
        },
        {
          estado: "abierta",
          flujo_estado: "revision",
          id: "67eac348-2a2f-4a9e-be19-62dcbc98937c",
          ultima_actividad: "2026-09-20T12:03:52.366159+00",
        },
      ])
    ).toBe("67eac348-2a2f-4a9e-be19-62dcbc98937c");
  });

  test("home interview order is deterministic when activity ties, and ignores fetch order", () => {
    const empatadas = [
      {
        estado: "abierta" as const,
        flujo_estado: "chat",
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        ultima_actividad: "2026-09-20T12:00:00.000Z",
      },
      {
        estado: "abierta" as const,
        flujo_estado: "chat",
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ultima_actividad: "2026-09-20T12:00:00.000Z",
      },
    ];
    expect(elegirEntrevistaLanding(empatadas)).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );
    expect(elegirEntrevistaLanding([...empatadas].reverse())).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );
  });

  test("ownership compares emails without depending on a second id lookup", () => {
    expect(mismoEmail("QA@Majoriti.world", "qa@majoriti.world")).toBe(true);
    expect(mismoEmail("a@x.com", "b@x.com")).toBe(false);
    expect(mismoEmail(null, "a@x.com")).toBe(false);
  });
});
