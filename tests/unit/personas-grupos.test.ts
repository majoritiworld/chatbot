import { expect, test } from "@playwright/test";
import {
  combinarDestinatarios,
  parseDestinatarios,
  parseDestinatariosOpcional,
} from "@/lib/consultoria/destinatarios";
import { agruparPersonasPorAcceso } from "@/lib/consultoria/personas-grupos";

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
