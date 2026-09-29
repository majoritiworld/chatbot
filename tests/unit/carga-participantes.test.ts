import { expect, test } from "@playwright/test";
import {
  aplicarPlan,
  type IdentidadConocida,
  type ParticipanteCarga,
  planificarCarga,
  resumirPlan,
} from "@/lib/consultoria/carga-participantes";

const FASE_1 = "fase-1";
const FASE_2 = "fase-2";
const PLANTILLA_1 = "plantilla-fase-1";
const PLANTILLA_2 = "plantilla-fase-2";

const DESTINO = {
  faseId: FASE_2,
  plantillaId: PLANTILLA_2,
  plantillaNombre: "Entrevista ficticia — Fase 2",
};

const ALMACEN = { cargo: true, pais: true };

function persona(
  parcial: Partial<ParticipanteCarga> &
    Pick<ParticipanteCarga, "correo" | "nombre">
): ParticipanteCarga {
  return {
    cargo: parcial.cargo ?? "Socio",
    correo: parcial.correo,
    firma: parcial.firma ?? "Estudio Alba",
    nombre: parcial.nombre,
    pais: parcial.pais ?? "Norte",
  };
}

function planDe(
  participantes: ParticipanteCarga[],
  existentes: IdentidadConocida[] = []
) {
  return planificarCarga({
    almacen: ALMACEN,
    destino: DESTINO,
    existentes,
    participantes,
  });
}

test.describe("Phase 2 participant load plan", () => {
  test("keeps one firm in several countries and ignores job title for access", () => {
    const norte = persona({
      cargo: "Socia",
      correo: "ana@estudio-alba.test",
      nombre: "Ana Solis",
      pais: "Norte",
    });
    const norteDos = persona({
      cargo: "MKt y Comunicaciones",
      correo: "cara@estudio-alba.test",
      nombre: "Cara Solis",
      pais: "Norte",
    });
    const sur = persona({
      correo: "bruno@estudio-alba.test",
      firma: "Estudio Alba",
      nombre: "Bruno Solis",
      pais: "Sur",
    });
    const original = structuredClone([norte, norteDos, sur]);
    const plan = planDe([norte, norteDos, sur]);

    expect([norte, norteDos, sur]).toEqual(original);
    expect(plan.personas).toBe(3);
    expect(plan.firmas).toEqual(["Estudio Alba"]);
    expect(plan.presencias).toEqual([
      { firma: "Estudio Alba", pais: "Norte", personas: 2 },
      { firma: "Estudio Alba", pais: "Sur", personas: 1 },
    ]);
    expect(plan.correosEnviados).toBe(0);
    expect(plan.escrito).toBe(false);
    expect(plan.avisos).toEqual([]);
    for (const fila of plan.filas) {
      expect(fila.acceso).toBe("crear_stakeholder");
      expect(fila.entrevista).toBe("crear");
      expect(fila.acciones.map((accion) => accion.tipo)).toEqual([
        "crear_persona",
        "crear_acceso_stakeholder",
        "crear_entrevista",
      ]);
    }
  });

  test("reuses an existing person, keeps phase 1, and does not widen a client role", () => {
    const participante = persona({
      correo: "Dana.Cliente@example.test",
      firma: "Estudio Alba",
      nombre: "Dana Cliente",
    });
    const existente: IdentidadConocida = {
      apellido: "Cliente",
      correo: "dana.cliente@example.test",
      entrevistas: [
        { faseId: FASE_1, id: "entrevista-fase-1", plantillaId: PLANTILLA_1 },
      ],
      firma: "Estudio Alba",
      nombre: "Dana",
      rol: "cliente",
      stakeholderId: "persona-1",
    };
    const plan = planDe([participante], [existente]);
    const [fila] = plan.filas;

    expect(fila?.identidad).toBe("reutilizar");
    expect(fila?.senalarRol).toBe(true);
    expect(fila?.rolConservado).toBe("cliente");
    expect(fila?.acceso).toBe("conservar");
    expect(fila?.entrevista).toBe("crear");
    expect(fila?.entrevistasIntactas).toEqual(["entrevista-fase-1"]);
    expect(fila?.acciones).toEqual([
      { stakeholderId: "persona-1", tipo: "reutilizar_persona" },
      { rol: "cliente", tipo: "conservar_acceso" },
      { tipo: "crear_entrevista" },
    ]);
    expect(JSON.stringify(fila?.acciones)).not.toContain("entrevista-fase-1");
  });

  test("flags Majoriti and leaves the existing phase 2 interview untouched", () => {
    const participante = persona({
      correo: "evan@example.test",
      nombre: "Evan Mayor",
    });
    const existente: IdentidadConocida = {
      apellido: "Mayor",
      correo: "evan@example.test",
      entrevistas: [
        { faseId: FASE_1, id: "entrevista-fase-1", plantillaId: PLANTILLA_1 },
        { faseId: FASE_2, id: "entrevista-fase-2", plantillaId: PLANTILLA_2 },
      ],
      firma: "Estudio Alba",
      nombre: "Evan",
      rol: "majoriti",
      stakeholderId: "persona-2",
    };
    const primera = planDe([participante], [existente]);
    const [fila] = primera.filas;

    expect(fila?.senalarRol).toBe(true);
    expect(fila?.rolConservado).toBe("majoriti");
    expect(fila?.entrevista).toBe("omitir");
    expect(fila?.entrevistasIntactas).toEqual([
      "entrevista-fase-1",
      "entrevista-fase-2",
    ]);
    expect(fila?.acciones.map((accion) => accion.tipo)).toEqual([
      "reutilizar_persona",
      "conservar_acceso",
      "omitir_entrevista",
    ]);

    const segunda = planDe([participante], [existente]);
    expect(resumirPlan(segunda).entrevistasNuevas).toBe(0);
    expect(segunda.correosEnviados).toBe(0);
  });

  test("a repeated row does not plan a second interview", () => {
    const ana = persona({ correo: "ana@example.test", nombre: "Ana Solis" });
    const repetida = persona({
      correo: "ANA@example.test",
      nombre: "Ana Solis",
    });
    const plan = planDe([ana, repetida]);

    expect(plan.personas).toBe(1);
    expect(plan.filas[1]?.identidad).toBe("duplicada");
    expect(plan.filas[1]?.entrevista).toBe("omitir");
    expect(resumirPlan(plan).entrevistasNuevas).toBe(1);
  });

  test("keeps suspicious names and emails and only flags them", () => {
    const plan = planDe([
      persona({
        correo: "flehtman@example.test",
        firma: "Casa & norte",
        nombre: "Fran Lethman",
      }),
      persona({
        correo: "glopez_de_silanes@example.test",
        firma: "N´orte",
        nombre: "Gus José Lopéz",
        pais: "Panama",
      }),
      persona({
        correo: "ijaquez@example.test",
        nombre: "Iris Jazquez",
        pais: "Republica Dominicana",
      }),
    ]);
    const textos = plan.filas.flatMap((fila) => fila.revisiones).join("\n");

    expect(plan.filas[0]?.participante.nombre).toBe("Fran Lethman");
    expect(plan.filas[0]?.participante.correo).toBe("flehtman@example.test");
    expect(plan.filas[1]?.participante.firma).toBe("N´orte");
    expect(plan.filas[1]?.participante.nombre).toContain("Lopéz");
    expect(textos).toContain("Lethman");
    expect(textos).toContain("silanes");
    expect(textos).toContain("Lopéz");
    expect(textos).toContain("Jazquez");
    expect(textos).toContain("norte");
    expect(textos).toContain("Panamá");
    expect(textos).toContain("República Dominicana");
    expect(plan.filas[1]?.participante.pais).toBe("Panama");
    expect(plan.filas[2]?.participante.pais).toBe("Republica Dominicana");
  });

  test("does not rewrite a stored name or firm when the list differs", () => {
    const participante = persona({
      correo: "nora@example.test",
      firma: "Estudio Alba",
      nombre: "Nora Nueva",
    });
    const existente: IdentidadConocida = {
      apellido: "Vieja",
      correo: "nora@example.test",
      entrevistas: [],
      firma: null,
      nombre: "Nora",
      rol: "stakeholder",
      stakeholderId: "persona-3",
    };
    const [fila] = planDe([participante], [existente]).filas;

    expect(fila?.identidad).toBe("reutilizar");
    expect(fila?.acceso).toBe("conservar");
    expect(fila?.revisiones.join(" ")).toContain("Nora Vieja");
    expect(fila?.revisiones.join(" ")).toContain("vacía");
    expect(
      fila?.acciones.some((accion) => accion.tipo === "crear_persona")
    ).toBe(false);
  });

  test("blocks the write when country and title have nowhere to go", () => {
    const plan = planificarCarga({
      almacen: { cargo: false, pais: false },
      destino: {
        faseId: FASE_2,
        plantillaId: null,
        plantillaNombre: "Entrevista ficticia — Fase 2",
      },
      existentes: [],
      participantes: [
        persona({ correo: "ana@example.test", nombre: "Ana Solis" }),
      ],
    });

    expect(plan.escrito).toBe(false);
    expect(plan.avisos).toEqual([
      "El plan conserva el país, pero stakeholder no tiene columna país.",
      "El plan conserva el cargo, pero stakeholder no tiene columna cargo.",
      "La plantilla «Entrevista ficticia — Fase 2» no está creada. La asignación queda preparada.",
    ]);
    expect(plan.filas[0]?.participante.pais).toBe("Norte");
    expect(plan.filas[0]?.participante.cargo).toBe("Socio");
    expect(aplicarPlan(plan, []).aplicado).toBe(false);
  });

  test("a fictional load can be repeated without copying people, roles, or phase 1", () => {
    const nueva = persona({
      cargo: "MKt y Comunicaciones",
      correo: "cara@estudio-alba.test",
      nombre: "Cara Solis",
      pais: "Norte",
    });
    const cliente = persona({
      correo: "dana@estudio-alba.test",
      firma: "Otra firma",
      nombre: "Dana Distinta",
      pais: "Sur",
    });
    const existente: IdentidadConocida = {
      apellido: "Cliente",
      cargo: "Socia",
      correo: "dana@estudio-alba.test",
      entrevistas: [
        {
          faseId: FASE_1,
          id: "entrevista-fase-1",
          plantillaId: PLANTILLA_1,
        },
      ],
      firma: "Estudio Alba",
      nombre: "Dana",
      pais: "Norte",
      rol: "cliente",
      stakeholderId: "persona-1",
    };
    const fase1 = structuredClone(existente.entrevistas);

    const primero = aplicarPlan(planDe([nueva, cliente]), [existente]);
    const otraVez = aplicarPlan(
      planDe([nueva, cliente, nueva], primero.personas),
      primero.personas
    );

    expect(primero.aplicado).toBe(true);
    expect(primero.correosEnviados).toBe(0);
    expect(otraVez.personas).toHaveLength(2);
    expect(otraVez.correosEnviados).toBe(0);

    const guardada = otraVez.personas.find(
      (candidata) => candidata.stakeholderId === "persona-1"
    );
    const creada = otraVez.personas.find(
      (candidata) => candidata.correo === "cara@estudio-alba.test"
    );

    expect(guardada).toMatchObject({
      cargo: "Socia",
      firma: "Estudio Alba",
      nombre: "Dana",
      pais: "Norte",
      rol: "cliente",
    });
    expect(guardada?.entrevistas[0]).toEqual(fase1[0]);
    expect(
      guardada?.entrevistas.map((entrevista) => entrevista.faseId)
    ).toEqual([FASE_1, FASE_2]);
    expect(creada).toMatchObject({
      apellido: null,
      cargo: "MKt y Comunicaciones",
      nombre: "Cara Solis",
      pais: "Norte",
      rol: "stakeholder",
    });
    expect(creada?.entrevistas).toHaveLength(1);
    expect(otraVez.personas).toEqual(primero.personas);
  });
});
