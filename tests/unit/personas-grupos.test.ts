import { expect, test } from "@playwright/test";
import {
  combinarDestinatarios,
  parseDestinatarios,
  parseDestinatariosOpcional,
} from "@/lib/consultoria/destinatarios";
import {
  agruparPersonasPorAcceso,
  agruparPorFirmaYPais,
  convieneAgruparPorFirma,
} from "@/lib/consultoria/personas-grupos";

const persona = (
  nombre: string,
  firma: string | null,
  pais: string | null
) => ({
  firma,
  nombre,
  pais,
});

test.describe("Interviews grouped by firm and country", () => {
  test("sorts firms and countries, missing values last", () => {
    const grupos = agruparPorFirmaYPais([
      persona("Luis", "BLP", "Guatemala"),
      persona("Prueba", "  ", null),
      persona("Juan", "BLP", "Costa Rica"),
      persona("Carla", "Ferrere", "Uruguay"),
      persona("Leon", "BLP", "Costa Rica"),
      persona("Gerson", "Basham", null),
    ]);

    expect(grupos.map((grupo) => [grupo.firma, grupo.total])).toEqual([
      ["Basham", 1],
      ["BLP", 3],
      ["Ferrere", 1],
      [null, 1],
    ]);
    const blp = grupos.find((grupo) => grupo.firma === "BLP");
    expect(
      blp?.paises.map((pais) => [pais.pais, pais.personas.map((p) => p.nombre)])
    ).toEqual([
      ["Costa Rica", ["Juan", "Leon"]],
      ["Guatemala", ["Luis"]],
    ]);
  });

  test("keeps short or single-firm lists flat", () => {
    const pocas = [
      persona("A", "AZ", null),
      persona("B", "ComplianceLatam", null),
    ];
    expect(convieneAgruparPorFirma(pocas)).toBe(false);

    const unaFirma = Array.from({ length: 8 }, (_, i) =>
      persona(`P${i}`, "BLP", "Costa Rica")
    );
    expect(convieneAgruparPorFirma(unaFirma)).toBe(false);

    expect(
      convieneAgruparPorFirma([...unaFirma, persona("Z", "Ferrere", null)])
    ).toBe(true);
  });
});

test.describe("People grouped by portal access", () => {
  test("splits clients from everyone else", () => {
    const grupos = agruparPersonasPorAcceso([
      { rolPortal: "cliente" },
      { rolPortal: "stakeholder" },
      { rolPortal: null },
      { rolPortal: "cliente" },
    ]);

    expect(grupos.clientes).toHaveLength(2);
    expect(grupos.stakeholders).toHaveLength(2);
  });
});

test.describe("Interview recipients", () => {
  test("optional parser accepts an empty paste", () => {
    expect(parseDestinatariosOpcional("\n# comentario\n", null)).toEqual({
      destinatarios: [],
      ok: true,
    });
  });

  test("optional parser still rejects a bad line", () => {
    const parsed = parseDestinatariosOpcional("no-es-un-email", null);
    expect(parsed.ok).toBe(false);
  });

  test("keeps existing people and drops a pasted duplicate", () => {
    const combinados = combinarDestinatarios(
      [
        {
          apellido: "Lobos",
          email: "juan.lobos@emprendetumente.org",
          firma: "ETM",
          nombre: "Juan Pablo",
          rol: "cliente",
        },
      ],
      [
        {
          apellido: null,
          email: "juan.lobos@emprendetumente.org",
          firma: null,
          nombre: "Juan",
        },
        {
          apellido: "Fuentes",
          email: "gabriel.fuentes@emprendetumente.org",
          firma: null,
          nombre: "Gabriel",
        },
      ]
    );

    expect(combinados).toEqual([
      {
        apellido: "Lobos",
        email: "juan.lobos@emprendetumente.org",
        firma: "ETM",
        nombre: "Juan Pablo",
        rol: "cliente",
      },
      {
        apellido: "Fuentes",
        email: "gabriel.fuentes@emprendetumente.org",
        firma: null,
        nombre: "Gabriel",
      },
    ]);
  });

  test("required parser still asks for at least one email", () => {
    expect(parseDestinatarios("  ", null).ok).toBe(false);
  });
});
