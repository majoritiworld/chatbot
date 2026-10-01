import { expect, test } from "@playwright/test";
import {
  construirArchivoTranscripcion,
  tituloTranscripcion,
} from "@/lib/consultoria/entrevista-contenido";
import {
  BASE_TRANSCRIPCIONES_ETM,
  esConversacionFicticiaEtm,
  esProyectoEtm,
  PAGINA_PROYECTO_NOTION_COMPLIANCE_LATAM,
  PAGINA_PROYECTO_NOTION_ETM,
  segmentoNotionEtm,
} from "@/lib/consultoria/notion-proyecto-etm";
import {
  bloquesDesdeMarkdown,
  configuracionNotionTranscripcion,
  lotesDeBloques,
  matchUnicoPorNombre,
  propiedadesPaginaTranscripcion,
  tituloNotionDeEntrevista,
  urlPaginaNotion,
} from "@/lib/consultoria/notion-transcripcion-contenido";
import { publicarPaginaTranscripcionNotion } from "@/lib/consultoria/notion-transcripcion-publicar";

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

  test("two interviews of one person get different Notion titles", () => {
    const nombre = "PRUEBA Seba Majoriti";
    expect(tituloNotionDeEntrevista(nombre, null)).toBe(
      tituloTranscripcion(nombre)
    );
    expect(
      tituloNotionDeEntrevista(nombre, "Entrevistas a colaboradores")
    ).toBe(`${tituloTranscripcion(nombre)} — Entrevistas a colaboradores`);
    expect(
      tituloNotionDeEntrevista(nombre, "Entrevistas a colaboradores")
    ).not.toBe(tituloNotionDeEntrevista(nombre, "Entrevistas a Firmas Socias"));
  });
});

const PERSONAS = "ad23ef07-d313-4849-aaf7-6c6c03f06485";
const PAGINA_FIRMAS = "3eb31b45-3629-8197-b8c9-e470c12c1e56";

test.describe("ETM Notion destination", () => {
  test("links the existing Consultoria ETM project and does not reuse a title", async () => {
    const paginas = new Map<string, string>();
    const llamadas: string[] = [];
    let creadas = 0;
    const fetchImpl: typeof fetch = (input, init) => {
      const ruta = String(input).replace("https://api.notion.com/v1/", "");
      llamadas.push(`${init?.method ?? "GET"} ${ruta}`);
      const body =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as {
              filter?: { rich_text?: { equals?: string }; title?: unknown };
              properties?: {
                "ID entrevista"?: {
                  rich_text?: { text?: { content?: string } }[];
                };
                Proyecto?: { relation?: { id?: string }[] };
                Segmento?: { select?: { name?: string } };
              };
            })
          : null;
      if (ruta === `data_sources/${BASE_TRANSCRIPCIONES_ETM}`) {
        return Promise.resolve(
          Response.json({
            properties: {
              "ID entrevista": { type: "rich_text" },
              Name: { type: "title" },
              Participante: {
                relation: { data_source_id: PERSONAS },
                type: "relation",
              },
              Proyecto: {
                relation: {
                  data_source_id: "4e10d8e1-eda6-49c0-b200-41cec303207d",
                },
                type: "relation",
              },
              Segmento: {
                select: {
                  options: [
                    { name: "Mentor" },
                    { name: "Mentoreado" },
                    { name: "Sponsor" },
                  ],
                },
                type: "select",
              },
            },
          })
        );
      }
      if (ruta === `data_sources/${PERSONAS}`) {
        return Promise.resolve(
          Response.json({
            properties: {
              Email: { type: "email" },
              Name: { type: "title" },
            },
          })
        );
      }
      if (ruta === `data_sources/${PERSONAS}/query`) {
        return Promise.resolve(
          Response.json({
            results: [{ id: "persona-1", properties: {} }],
          })
        );
      }
      if (ruta === `data_sources/${BASE_TRANSCRIPCIONES_ETM}/query`) {
        expect(body?.filter?.title).toBeUndefined();
        const entrevistaId = body?.filter?.rich_text?.equals ?? "";
        const pageId = paginas.get(entrevistaId);
        return Promise.resolve(
          Response.json({
            results: pageId ? [{ id: pageId }] : [],
          })
        );
      }
      if (ruta === "pages") {
        creadas += 1;
        const entrevistaId =
          body?.properties?.["ID entrevista"]?.rich_text?.at(0)?.text
            ?.content ?? "";
        const pageId = `pagina-etm-${creadas}`;
        paginas.set(entrevistaId, pageId);
        expect(body?.properties?.Proyecto?.relation?.at(0)?.id).toBe(
          PAGINA_PROYECTO_NOTION_ETM
        );
        expect(body?.properties?.Proyecto?.relation?.at(0)?.id).not.toBe(
          PAGINA_PROYECTO_NOTION_COMPLIANCE_LATAM
        );
        return Promise.resolve(Response.json({ id: pageId }));
      }
      return Promise.resolve(
        Response.json({ message: `ruta inesperada ${ruta}` }, { status: 400 })
      );
    };

    const datos = {
      destinoEtm: true,
      email: "ana@empresa.real",
      estado: "completada",
      fecha: "2026-10-01T12:00:00.000Z",
      firma: "Norte",
      markdown: "Conversación de prueba de asociación.",
      nombre: "Ana Real",
      proyectoCliente: "Emprendetumente",
      proyectoNombre: "ETM Tuesday",
      proyectoNotionId: PAGINA_PROYECTO_NOTION_ETM,
      segmento: "Mentor",
      titulo: "Transcripción — PRUEBA Seba Majoriti",
    };
    const config = {
      databaseId: BASE_TRANSCRIPCIONES_ETM,
      token: "token-de-prueba",
    };
    const primera = await publicarPaginaTranscripcionNotion({
      config,
      datos: {
        ...datos,
        entrevistaId: "11111111-1111-4111-8111-111111111111",
      },
      fetchImpl,
    });
    const reintento = await publicarPaginaTranscripcionNotion({
      config,
      datos: {
        ...datos,
        entrevistaId: "11111111-1111-4111-8111-111111111111",
      },
      fetchImpl,
    });
    const otra = await publicarPaginaTranscripcionNotion({
      config,
      datos: {
        ...datos,
        entrevistaId: "22222222-2222-4222-8222-222222222222",
        segmento: "Mentoreado",
      },
      fetchImpl,
    });

    expect(primera).toEqual({ pageId: "pagina-etm-1", status: "created" });
    expect(reintento).toEqual({
      pageId: "pagina-etm-1",
      status: "alreadyDone",
    });
    expect(otra.pageId).toBe("pagina-etm-2");
    expect(primera.pageId).not.toBe(PAGINA_FIRMAS);
    expect(creadas).toBe(2);
    expect(
      llamadas.some((llamada) => llamada.includes("4e10d8e1-eda6-49c0-b200"))
    ).toBe(false);
    expect(
      llamadas.some((llamada) => llamada.includes("e043fecb-df40-4496-baae"))
    ).toBe(false);
  });

  test("rejects the ComplianceLatam database for an ETM interview", async () => {
    const fetchImpl: typeof fetch = () =>
      Promise.reject(new Error("No debía consultar Notion"));
    await expect(
      publicarPaginaTranscripcionNotion({
        config: {
          databaseId: "e043fecb-df40-4496-baae-8a46daedc03f",
          token: "token-de-prueba",
        },
        datos: {
          destinoEtm: true,
          email: "ana@empresa.real",
          entrevistaId: "33333333-3333-4333-8333-333333333333",
          estado: "completada",
          fecha: null,
          firma: null,
          markdown: "No publicar",
          nombre: "Ana Real",
          proyectoCliente: "Emprendetumente",
          proyectoNombre: "ETM Tuesday",
          proyectoNotionId: PAGINA_PROYECTO_NOTION_ETM,
          segmento: "Sponsor",
          titulo: "Transcripción — Ana Real",
        },
        fetchImpl,
      })
    ).rejects.toThrow("destino de ComplianceLatam");
  });

  test("keeps fictional demo conversations out of Notion", () => {
    expect(
      esConversacionFicticiaEtm({
        email: "marina.lagos.demo@example.test",
        proyectoNombre: "ETM Tuesday (demo local)",
      })
    ).toBe(true);
    expect(
      esProyectoEtm({
        cliente: "Emprendetumente",
        nombre: "ETM Tuesday",
        slug: "etm-tuesday",
      })
    ).toBe(true);
    expect(
      esConversacionFicticiaEtm({
        email: "ana@empresa.real",
        proyectoNombre: "ETM Tuesday",
      })
    ).toBe(false);
    expect(segmentoNotionEtm("Mentores ETM Tuesday")).toBe("Mentor");
    expect(segmentoNotionEtm("Mentoreados ETM Tuesday")).toBe("Mentoreado");
    expect(segmentoNotionEtm("Sponsors ETM Tuesday")).toBe("Sponsor");
    expect(PAGINA_PROYECTO_NOTION_ETM).not.toBe(
      PAGINA_PROYECTO_NOTION_COMPLIANCE_LATAM
    );
  });
});
