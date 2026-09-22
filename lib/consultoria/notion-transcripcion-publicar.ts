import {
  bloquesDesdeMarkdown,
  claveNotion,
  lotesDeBloques,
  matchUnicoPorNombre,
  type NotionPropertySchema,
  type NotionRelacionMatch,
  propiedadesPaginaTranscripcion,
  variantesBusquedaNotion,
} from "@/lib/consultoria/notion-transcripcion-contenido";

const NOTION_VERSION = "2025-09-03";
const LOTES_BLOQUES = 100;

type NotionFetch = typeof fetch;

type NotionPropertyPayload = {
  relation?: { data_source_id?: string; database_id?: string };
  select?: { options?: { name?: string }[] };
  type?: string;
};

type NotionJson = {
  code?: string;
  id?: string;
  message?: string;
  properties?: Record<string, NotionPropertyPayload>;
  results?: Record<string, unknown>[];
};

type NotionPageResult = {
  id?: string;
  properties?: Record<
    string,
    {
      title?: { plain_text?: string }[];
      type?: string;
    }
  >;
};

export type DatosPublicacionNotion = {
  email: string | null;
  estado: string;
  fecha: string | null;
  firma: string | null;
  markdown: string;
  nombre: string;
  proyectoCliente: string | null;
  proyectoNombre: string | null;
  titulo: string;
};

async function notionJson({
  body,
  fetchImpl,
  method,
  ruta,
  token,
}: {
  body?: unknown;
  fetchImpl: NotionFetch;
  method: string;
  ruta: string;
  token: string;
}) {
  const response = await fetchImpl(`https://api.notion.com/v1/${ruta}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    method,
  });
  const data = (await response.json().catch(() => null)) as NotionJson | null;

  if (!response.ok) {
    throw new Error(data?.message ?? "Notion rechazó la solicitud");
  }

  return data;
}

function esquemaDesdeDatabase(
  properties: Record<string, NotionPropertyPayload> | undefined
): NotionPropertySchema[] {
  if (!properties) {
    return [];
  }

  return Object.entries(properties).map(([name, value]) => ({
    name,
    relationDatabaseId:
      value.relation?.data_source_id ?? value.relation?.database_id,
    selectOptions: value.select?.options
      ?.map((opcion) => opcion.name)
      .filter((opcion): opcion is string => Boolean(opcion)),
    type: value.type ?? "",
  }));
}

function tituloDePagina(page: NotionPageResult) {
  for (const value of Object.values(page.properties ?? {})) {
    if (value.type === "title") {
      return (
        value.title
          ?.map((parte) => parte.plain_text ?? "")
          .join("")
          .trim() ?? ""
      );
    }
  }
  return "";
}

function filtrosTitulo(propiedad: string, terminos: string[]) {
  const variantes = [
    ...new Set(terminos.flatMap((termino) => variantesBusquedaNotion(termino))),
  ];
  return variantes.flatMap((variante) => [
    { property: propiedad, title: { contains: variante } },
    { property: propiedad, title: { equals: variante } },
  ]);
}

async function consultarBase({
  config,
  databaseId,
  fetchImpl,
  filter,
}: {
  config: { token: string };
  databaseId: string;
  fetchImpl: NotionFetch;
  filter: Record<string, unknown>;
}) {
  const data = await notionJson({
    body: { filter, page_size: 20 },
    fetchImpl,
    method: "POST",
    ruta: `data_sources/${databaseId}/query`,
    token: config.token,
  });
  return (data?.results ?? []) as NotionPageResult[];
}

async function esquemaDeBase({
  config,
  databaseId,
  fetchImpl,
}: {
  config: { token: string };
  databaseId: string;
  fetchImpl: NotionFetch;
}) {
  const database = await notionJson({
    fetchImpl,
    method: "GET",
    ruta: `data_sources/${databaseId}`,
    token: config.token,
  });
  return esquemaDesdeDatabase(database?.properties);
}

async function buscarPorNombre({
  config,
  databaseId,
  fetchImpl,
  terminos,
}: {
  config: { token: string };
  databaseId: string;
  fetchImpl: NotionFetch;
  terminos: string[];
}): Promise<NotionRelacionMatch[]> {
  const limpios = terminos.map((termino) => termino.trim()).filter(Boolean);
  if (limpios.length === 0) {
    return [];
  }

  const esquema = await esquemaDeBase({ config, databaseId, fetchImpl });
  const tituloProp = esquema.find((propiedad) => propiedad.type === "title");
  if (!tituloProp) {
    return [];
  }

  const or = filtrosTitulo(tituloProp.name, limpios);
  if (or.length === 0) {
    return [];
  }

  const pages = await consultarBase({
    config,
    databaseId,
    fetchImpl,
    filter: or.length === 1 ? (or.at(0) ?? {}) : { or },
  });

  const vistos = new Set<string>();
  const matches: NotionRelacionMatch[] = [];
  for (const page of pages) {
    if (typeof page.id !== "string" || vistos.has(page.id)) {
      continue;
    }
    vistos.add(page.id);
    matches.push({ id: page.id, titulo: tituloDePagina(page) });
  }
  return matches;
}

async function buscarPersona({
  config,
  databaseId,
  email,
  fetchImpl,
  nombre,
}: {
  config: { token: string };
  databaseId: string;
  email: string | null;
  fetchImpl: NotionFetch;
  nombre: string;
}) {
  const esquema = await esquemaDeBase({ config, databaseId, fetchImpl });
  const emailProp = esquema.find((propiedad) => propiedad.type === "email");
  const correos = [
    ...new Set(
      [email?.trim(), email?.trim().toLowerCase()].filter(
        (valor): valor is string => Boolean(valor)
      )
    ),
  ];

  if (emailProp && correos.length > 0) {
    const filtro =
      correos.length === 1
        ? { email: { equals: correos.at(0) }, property: emailProp.name }
        : {
            or: correos.map((correo) => ({
              email: { equals: correo },
              property: emailProp.name,
            })),
          };
    const pages = await consultarBase({
      config,
      databaseId,
      fetchImpl,
      filter: filtro,
    });
    const ids = [
      ...new Set(
        pages
          .map((page) => page.id)
          .filter((id): id is string => typeof id === "string")
      ),
    ];
    if (ids.length === 1) {
      return ids.at(0) ?? null;
    }
    if (ids.length > 1) {
      return null;
    }
  }

  return matchUnicoPorNombre(
    nombre,
    await buscarPorNombre({
      config,
      databaseId,
      fetchImpl,
      terminos: [nombre],
    })
  );
}

function primerMatchUnico(
  terminos: (string | null | undefined)[],
  candidatos: NotionRelacionMatch[]
) {
  for (const termino of terminos) {
    if (!termino?.trim()) {
      continue;
    }
    const match = matchUnicoPorNombre(termino, candidatos);
    if (match) {
      return match;
    }
  }
  return null;
}

export async function publicarPaginaTranscripcionNotion({
  config,
  datos,
  fetchImpl = fetch,
}: {
  config: { databaseId: string; token: string };
  datos: DatosPublicacionNotion;
  fetchImpl?: NotionFetch;
}): Promise<{ pageId: string; status: "alreadyDone" | "created" }> {
  const bloques = bloquesDesdeMarkdown(datos.markdown);
  const lotes = lotesDeBloques(bloques, LOTES_BLOQUES);

  const database = await notionJson({
    fetchImpl,
    method: "GET",
    ruta: `data_sources/${config.databaseId}`,
    token: config.token,
  });
  const esquema = esquemaDesdeDatabase(database?.properties);
  const tituloProp = esquema.find((propiedad) => propiedad.type === "title");

  if (tituloProp) {
    const existentes = await notionJson({
      body: {
        filter: {
          property: tituloProp.name,
          title: { equals: datos.titulo },
        },
        page_size: 1,
      },
      fetchImpl,
      method: "POST",
      ruta: `data_sources/${config.databaseId}/query`,
      token: config.token,
    });
    const pageId = existentes?.results?.at(0)?.id;
    if (typeof pageId === "string") {
      return { pageId, status: "alreadyDone" };
    }
  }

  const personaProp = esquema.find(
    (propiedad) =>
      propiedad.type === "relation" &&
      ["entrevistado", "people", "persona", "stakeholder"].includes(
        claveNotion(propiedad.name)
      )
  );
  const orgProp = esquema.find(
    (propiedad) =>
      propiedad.type === "relation" &&
      ["organizacion", "organization", "empresa", "company"].includes(
        claveNotion(propiedad.name)
      )
  );
  const proyectoProp = esquema.find(
    (propiedad) =>
      propiedad.type === "relation" &&
      ["proyecto", "project"].includes(claveNotion(propiedad.name))
  );

  const [entrevistadoId, organizacionId, proyectoId] = await Promise.all([
    personaProp?.relationDatabaseId
      ? buscarPersona({
          config,
          databaseId: personaProp.relationDatabaseId,
          email: datos.email,
          fetchImpl,
          nombre: datos.nombre,
        })
      : Promise.resolve(null),
    orgProp?.relationDatabaseId
      ? buscarPorNombre({
          config,
          databaseId: orgProp.relationDatabaseId,
          fetchImpl,
          terminos: [datos.proyectoCliente, datos.proyectoNombre].filter(
            (termino): termino is string => Boolean(termino)
          ),
        }).then((candidatos) =>
          primerMatchUnico(
            [datos.proyectoCliente, datos.proyectoNombre],
            candidatos
          )
        )
      : Promise.resolve(null),
    proyectoProp?.relationDatabaseId
      ? buscarPorNombre({
          config,
          databaseId: proyectoProp.relationDatabaseId,
          fetchImpl,
          terminos: datos.proyectoNombre ? [datos.proyectoNombre] : [],
        }).then((candidatos) =>
          primerMatchUnico([datos.proyectoNombre], candidatos)
        )
      : Promise.resolve(null),
  ]);

  const creado = await notionJson({
    body: {
      children: lotes.at(0) ?? [],
      parent: {
        data_source_id: config.databaseId,
        type: "data_source_id",
      },
      properties: propiedadesPaginaTranscripcion({
        entrevistadoId,
        esquema,
        estado: datos.estado,
        fecha: datos.fecha,
        firma: datos.firma,
        nombre: datos.nombre,
        organizacionId,
        proyecto: datos.proyectoNombre,
        proyectoId,
        titulo: datos.titulo,
      }),
    },
    fetchImpl,
    method: "POST",
    ruta: "pages",
    token: config.token,
  });
  const pageId = creado?.id;
  if (typeof pageId !== "string") {
    throw new Error("Notion no devolvió la página");
  }

  const restantes = lotes.slice(1);
  let indiceLote = 0;
  while (indiceLote < restantes.length) {
    const lote = restantes.at(indiceLote);
    indiceLote += 1;
    if (!lote) {
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: Notion appends at most 100 children per request.
    await notionJson({
      body: { children: lote },
      fetchImpl,
      method: "PATCH",
      ruta: `blocks/${pageId}/children`,
      token: config.token,
    });
  }

  return { pageId, status: "created" };
}
