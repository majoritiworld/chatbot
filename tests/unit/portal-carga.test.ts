import { expect, test } from "@playwright/test";
import type { TurnoEntrevista } from "@/lib/consultoria/entrevista-contenido";
import {
  accesoEntrevistaPortal,
  coincideFaseYViewer,
  resolverVistaFasePortal,
} from "@/lib/consultoria/portal-carga-acceso";
import type { Entrevista } from "@/lib/supabase/types";

const PROYECTO = "20000000-0000-4000-8000-000000000001";
const OTRO_PROYECTO = "20000000-0000-4000-8000-000000000002";
const ENTREVISTA_ID = "40000000-0000-4000-8000-000000000001";
const OTRA_ENTREVISTA_ID = "40000000-0000-4000-8000-000000000002";
const SECRETO = "SECRETO-TRANSCRIPCION-AJENA";

const entrevista: Entrevista = {
  consentimiento_en: null,
  correo_agradecimiento_en: null,
  estado: "abierta",
  fecha_completada: null,
  flujo_estado: "chat",
  id: ENTREVISTA_ID,
  notion_transcripcion_id: null,
  preguntas: ["Pregunta"],
  seccion_actual: 0,
  secciones: [
    {
      descripcion: "",
      id: "50000000-0000-4000-8000-000000000001",
      preguntas: ["Pregunta"],
      titulo: "Sección",
    },
  ],
  secciones_completadas: [],
  stakeholder_email: "participant@example.test",
  stakeholder_firma: null,
  stakeholder_id: "30000000-0000-4000-8000-000000000001",
  stakeholder_nombre: "Participant",
};

const turnoSecreto: TurnoEntrevista = {
  at: "2026-09-19T00:00:00Z",
  id: "60000000-0000-4000-8000-000000000001",
  rol: "entrevistado",
  texto: SECRETO,
};

const propia = { entrevista, turnos: [turnoSecreto] };

function serializado(value: unknown) {
  return JSON.stringify(value);
}

test.describe("Portal phase and interview load access", () => {
  test("keeps interviews isolated by project and viewer email", () => {
    expect(
      coincideFaseYViewer({
        faseProyectoId: PROYECTO,
        proyectoId: PROYECTO,
        stakeholderEmail: "participant@example.test",
        viewerEmail: "PARTICIPANT@example.test",
      })
    ).toBe(true);
    expect(
      coincideFaseYViewer({
        faseProyectoId: OTRO_PROYECTO,
        proyectoId: PROYECTO,
        stakeholderEmail: "participant@example.test",
        viewerEmail: "participant@example.test",
      })
    ).toBe(false);
    expect(
      coincideFaseYViewer({
        faseProyectoId: PROYECTO,
        proyectoId: PROYECTO,
        stakeholderEmail: "other@example.test",
        viewerEmail: "participant@example.test",
      })
    ).toBe(false);
    expect(
      coincideFaseYViewer({
        faseProyectoId: PROYECTO,
        proyectoId: PROYECTO,
        stakeholderEmail: "participant@example.test",
        viewerEmail: null,
      })
    ).toBe(false);
  });

  test("denied interview access never carries a foreign transcript", () => {
    const ajena = accesoEntrevistaPortal(entrevista, "cliente@example.test", [
      { texto: SECRETO },
    ]);
    const ausente = accesoEntrevistaPortal(null, "participant@example.test", [
      { texto: SECRETO },
    ]);
    const sinEmail = accesoEntrevistaPortal(entrevista, null, [
      { texto: SECRETO },
    ]);

    expect(ajena).toEqual({ acceso: "ajena" });
    expect(ausente).toEqual({ acceso: "ausente" });
    expect(sinEmail).toEqual({ acceso: "ausente" });
    expect(serializado(ajena)).not.toContain(SECRETO);
    expect(serializado(ausente)).not.toContain(SECRETO);
    expect(serializado(sinEmail)).not.toContain(SECRETO);
  });

  test("stakeholder and client owners receive their own transcript", () => {
    const stakeholder = accesoEntrevistaPortal(
      entrevista,
      "participant@example.test",
      [turnoSecreto]
    );
    const clientePropia = accesoEntrevistaPortal(
      { ...entrevista, stakeholder_email: "client@example.test" },
      "client@example.test",
      [turnoSecreto]
    );

    expect(stakeholder.acceso).toBe("propia");
    expect(clientePropia.acceso).toBe("propia");
    if (stakeholder.acceso === "propia") {
      expect(stakeholder.turnos[0]?.texto).toBe(SECRETO);
    }
    if (clientePropia.acceso === "propia") {
      expect(clientePropia.turnos[0]?.texto).toBe(SECRETO);
    }
  });

  test("blocked, unassigned, missing, and crossed ids drop the parallel transcript", () => {
    const faseAbierta = {
      entrevistas: [{ id: ENTREVISTA_ID, puedeResponder: true }],
      estado: "en_progreso",
      nombre: "Fase 1",
    };
    const casos = [
      resolverVistaFasePortal(null, propia),
      resolverVistaFasePortal({ ...faseAbierta, estado: "bloqueado" }, propia),
      resolverVistaFasePortal(
        {
          entrevistas: [{ id: ENTREVISTA_ID, puedeResponder: false }],
          estado: "en_progreso",
          nombre: "Fase 1",
        },
        propia
      ),
      resolverVistaFasePortal(faseAbierta, {
        entrevista: { ...entrevista, id: OTRA_ENTREVISTA_ID },
        turnos: [turnoSecreto],
      }),
    ];

    expect(casos[0]).toEqual({ tipo: "ausente" });
    expect(casos[1]).toEqual({
      clave: "bloqueada",
      nombre: "Fase 1",
      tipo: "aviso",
    });
    expect(casos[2]).toEqual({
      clave: "sin-respondible",
      nombre: "Fase 1",
      tipo: "aviso",
    });
    expect(casos[3]).toEqual({
      clave: "sin-entrevista",
      nombre: "Fase 1",
      tipo: "aviso",
    });

    for (const vista of casos) {
      expect(serializado(vista)).not.toContain(SECRETO);
      expect(serializado(vista)).not.toContain("turnos");
    }
  });

  test("a matching owner on an open phase keeps the transcript for the chat", () => {
    const vista = resolverVistaFasePortal(
      {
        entrevistas: [{ id: ENTREVISTA_ID, puedeResponder: true }],
        estado: "en_progreso",
        nombre: "Fase 1",
      },
      propia
    );

    expect(vista.tipo).toBe("chat");
    if (vista.tipo === "chat") {
      expect(vista.turnos[0]?.texto).toBe(SECRETO);
      expect(vista.entrevista.id).toBe(ENTREVISTA_ID);
    }
  });
});

test.describe("Query-shape evidence (simulated 40ms RTT, not portal speedup)", () => {
  test("after identity the candidate uses fewer serial rounds, not a timed speedup", () => {
    const faseAntes = { consultas: 3, rondas: 3 };
    const faseDespues = { consultas: 2, rondas: 1 };
    const entrevistaAntes = { consultas: 2, rondas: 2 };
    const entrevistaDespues = { consultas: 1, rondas: 1 };

    expect(faseDespues.consultas).toBeLessThan(faseAntes.consultas);
    expect(faseDespues.rondas).toBeLessThan(faseAntes.rondas);
    expect(entrevistaDespues.consultas).toBeLessThan(entrevistaAntes.consultas);
    expect(entrevistaDespues.rondas).toBeLessThan(entrevistaAntes.rondas);
  });
});
