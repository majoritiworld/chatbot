import { expect, test } from "@playwright/test";
import { postRequestBodySchema } from "@/app/(chat)/api/chat/schema";
import { interviewSystemPrompt, textoSeccionesPrevias } from "@/lib/ai/prompts";
import {
  clonarSecciones,
  consolidarRespuestasEntrevista,
  fusionarTurnos,
  haySeccionesPendientes,
  parseSecciones,
  parseSeccionesCompletadas,
  resolverAvanceSeccion,
  seccionesDesdeGuionPlano,
  type TurnoEntrevista,
  turnosDeSeccion,
} from "@/lib/consultoria/entrevista-contenido";
import {
  esProyectoComplianceLatam,
  GUION_CL_FASE_1,
} from "@/lib/consultoria/guiones/compliance-latam-fase-1";
import { mensajesATurnos } from "@/lib/consultoria/mensajes-a-turnos";
import { resolveAuthLanding } from "@/lib/consultoria/roles";
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

  test("treats a repeated complete-section as already advanced", () => {
    const primera = resolverAvanceSeccion(0, 2);
    const repetida = resolverAvanceSeccion(0, 2);

    expect(repetida).toEqual(primera);
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

  test("consolidates answers for an idempotent submit", () => {
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

  test("asks the agent not to re-ask covered topics and to paraphrase", () => {
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
    expect(prompt).toContain("parafrasea en UNA frase breve");
    expect(prompt).toContain("no lo vuelvas a preguntar");
    expect(prompt).toContain("no te presentes de nuevo");
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
  });
});
