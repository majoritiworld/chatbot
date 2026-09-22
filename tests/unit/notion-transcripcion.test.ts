import { expect, test } from "@playwright/test";
import {
  construirArchivoTranscripcion,
  tituloTranscripcion,
} from "@/lib/consultoria/entrevista-contenido";
import {
  bloquesDesdeMarkdown,
  configuracionNotionTranscripcion,
  lotesDeBloques,
  matchUnicoPorNombre,
  propiedadesPaginaTranscripcion,
  urlPaginaNotion,
} from "@/lib/consultoria/notion-transcripcion-contenido";

test.describe("Notion transcript mapping", () => {
  test("turns markdown into headings, a divider and spoken turns", () => {
    const archivo = construirArchivoTranscripcion({
      fecha: "2026-09-22T12:00:00.000Z",
      firma: "Acme",
      nombre: "Colomba Pérez",
      proyecto: "Diagnóstico",
      turnos: [
        {
          at: "2026-09-22T12:00:00.000Z",
          id: "t-1",
          ofertaCierre: false,
          rol: "entrevistador",
          seccionId: "s-1",
          texto: "¿Cómo arrancan el día?",
        },
        {
          at: "2026-09-22T12:01:00.000Z",
          id: "t-2",
          ofertaCierre: false,
          rol: "entrevistado",
          seccionId: "s-1",
          texto: "Con una reunión corta.",
        },
      ],
    });

    const bloques = bloquesDesdeMarkdown(archivo.content);
    expect(bloques.at(0)).toMatchObject({
      heading_1: {
        rich_text: [
          { text: { content: tituloTranscripcion("Colomba Pérez") } },
        ],
      },
      type: "heading_1",
    });
    expect(bloques.some((bloque) => bloque.type === "divider")).toBe(true);
    expect(
      bloques
        .filter((bloque) => bloque.type === "heading_3")
        .map((bloque) => {
          if (bloque.type !== "heading_3") {
            return "";
          }
          return bloque.heading_3.rich_text.at(0)?.text.content;
        })
    ).toEqual(["Entrevistador", "Entrevistado"]);
  });

  test("maps title, text and date properties from the database schema", () => {
    const propiedades = propiedadesPaginaTranscripcion({
      esquema: [
        { name: "Name", type: "title" },
        { name: "Proyecto", type: "rich_text" },
        { name: "Firma", type: "rich_text" },
        { name: "Fecha", type: "date" },
      ],
      fecha: "2026-09-22T15:00:00.000Z",
      firma: "Acme",
      nombre: "Rodrigo",
      proyecto: "Diagnóstico",
      titulo: tituloTranscripcion("Rodrigo"),
    });

    expect(propiedades.Name).toEqual({
      title: [{ text: { content: "Transcripción — Rodrigo" }, type: "text" }],
    });
    expect(propiedades.Proyecto).toEqual({
      rich_text: [{ text: { content: "Diagnóstico" }, type: "text" }],
    });
    expect(propiedades.Firma).toEqual({
      rich_text: [{ text: { content: "Acme" }, type: "text" }],
    });
    expect(propiedades.Fecha).toEqual({ date: { start: "2026-09-22" } });
  });

  test("reads the database id from a Notion URL and chunks children", () => {
    expect(
      configuracionNotionTranscripcion({
        databaseId:
          "https://www.notion.so/workspace/232e3a1a0abc4e8ea111222333444555?v=1",
        token: " secret ",
      })
    ).toEqual({
      databaseId: "232e3a1a-0abc-4e8e-a111-222333444555",
      token: "secret",
    });
    expect(
      configuracionNotionTranscripcion({ databaseId: "abc", token: "x" })
    ).toBeNull();
    expect(lotesDeBloques([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(urlPaginaNotion("aaaa-bbbb")).toBe("https://notion.so/aaaabbbb");
  });

  test("links relations only when the name match is unique", () => {
    const compliance = {
      id: "org-1",
      titulo: "Compliance Latam",
    };
    const consultoria = {
      id: "proj-1",
      titulo: "Consultoria ComplianceLatam",
    };
    expect(matchUnicoPorNombre("ComplianceLatam", [compliance])).toBe("org-1");
    expect(matchUnicoPorNombre("ComplianceLatam", [consultoria])).toBe(
      "proj-1"
    );
    expect(
      matchUnicoPorNombre("ComplianceLatam", [
        compliance,
        { id: "org-2", titulo: "Compliance Latam Chile" },
      ])
    ).toBe("org-1");
    expect(
      matchUnicoPorNombre("ComplianceLatam", [
        consultoria,
        { id: "org-2", titulo: "Compliance Latam Chile" },
      ])
    ).toBeNull();
    expect(
      matchUnicoPorNombre("AZ", [{ id: "org-az", titulo: "AZ Chile" }])
    ).toBeNull();

    const propiedades = propiedadesPaginaTranscripcion({
      entrevistadoId: "person-1",
      esquema: [
        { name: "Título", type: "title" },
        { name: "Entrevistado", type: "relation" },
        { name: "Organización", type: "relation" },
        { name: "Proyecto", type: "relation" },
        {
          name: "Estado",
          selectOptions: ["Pendiente", "Procesada"],
          type: "select",
        },
        { name: "Fecha", type: "date" },
      ],
      estado: "completada",
      fecha: "2026-09-22T15:00:00.000Z",
      firma: "AZ",
      nombre: "Rodrigo Albagli",
      organizacionId: "org-1",
      proyecto: "ComplianceLatam",
      proyectoId: "proj-1",
      titulo: tituloTranscripcion("Rodrigo Albagli"),
    });

    expect(propiedades.Entrevistado).toEqual({
      relation: [{ id: "person-1" }],
    });
    expect(propiedades.Organización).toEqual({
      relation: [{ id: "org-1" }],
    });
    expect(propiedades.Proyecto).toEqual({
      relation: [{ id: "proj-1" }],
    });
    expect(propiedades.Estado).toEqual({ select: { name: "Procesada" } });
    expect(propiedades.Firma).toBeUndefined();
  });
});
