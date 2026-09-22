const LIMITE_TEXTO = 2000;
const DIACRITICOS = /[\u0300-\u036f]/g;
const NO_ALFANUMERICO = /[^a-z0-9]+/g;
const NEGRITA_SOLA = /^\*\*(.+)\*\*$/;
const UUID_EN_TEXTO =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32}/i;

export type NotionRichText = {
  type: "text";
  text: { content: string };
};

export type NotionBlock =
  | {
      type: "heading_1";
      heading_1: { rich_text: NotionRichText[] };
    }
  | {
      type: "heading_2";
      heading_2: { rich_text: NotionRichText[] };
    }
  | {
      type: "heading_3";
      heading_3: { rich_text: NotionRichText[] };
    }
  | {
      type: "paragraph";
      paragraph: { rich_text: NotionRichText[] };
    }
  | { type: "divider"; divider: Record<string, never> };

export type NotionPropertySchema = {
  name: string;
  type: string;
  relationDatabaseId?: string;
  selectOptions?: string[];
};

export type NotionRelacionMatch = {
  id: string;
  titulo: string;
};

export type NotionPageProperties = Record<string, unknown>;

export function claveNotion(value: string) {
  return value
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .replace(NO_ALFANUMERICO, "");
}

export function textosNotion(value: string): NotionRichText[] {
  if (value.length === 0) {
    return [];
  }

  const partes: NotionRichText[] = [];
  for (let indice = 0; indice < value.length; indice += LIMITE_TEXTO) {
    partes.push({
      text: { content: value.slice(indice, indice + LIMITE_TEXTO) },
      type: "text",
    });
  }
  return partes;
}

function parrafo(texto: string): NotionBlock {
  return {
    paragraph: { rich_text: textosNotion(texto) },
    type: "paragraph",
  };
}

function heading(
  tipo: "heading_1" | "heading_2" | "heading_3",
  texto: string
): NotionBlock {
  if (tipo === "heading_1") {
    return { heading_1: { rich_text: textosNotion(texto) }, type: "heading_1" };
  }
  if (tipo === "heading_2") {
    return { heading_2: { rich_text: textosNotion(texto) }, type: "heading_2" };
  }
  return { heading_3: { rich_text: textosNotion(texto) }, type: "heading_3" };
}

export function bloquesDesdeMarkdown(markdown: string): NotionBlock[] {
  const bloques: NotionBlock[] = [];
  const lineasPendientes: string[] = [];

  const vaciarParrafo = () => {
    const texto = lineasPendientes.join("\n").trim();
    lineasPendientes.length = 0;
    if (texto.length > 0) {
      bloques.push(parrafo(texto));
    }
  };

  for (const linea of markdown.replaceAll("\r\n", "\n").split("\n")) {
    const recorte = linea.trim();
    if (recorte.startsWith("# ")) {
      vaciarParrafo();
      bloques.push(heading("heading_1", recorte.slice(2).trim()));
      continue;
    }
    if (recorte.startsWith("## ")) {
      vaciarParrafo();
      bloques.push(heading("heading_2", recorte.slice(3).trim()));
      continue;
    }
    if (recorte.startsWith("### ")) {
      vaciarParrafo();
      bloques.push(heading("heading_3", recorte.slice(4).trim()));
      continue;
    }
    if (recorte === "---") {
      vaciarParrafo();
      bloques.push({ divider: {}, type: "divider" });
      continue;
    }
    const negrita = NEGRITA_SOLA.exec(recorte);
    if (negrita) {
      vaciarParrafo();
      bloques.push(heading("heading_3", negrita.at(1) ?? recorte));
      continue;
    }
    if (recorte.length === 0) {
      vaciarParrafo();
      continue;
    }
    lineasPendientes.push(linea);
  }

  vaciarParrafo();
  return bloques;
}

function propiedadPorClaves(esquema: NotionPropertySchema[], claves: string[]) {
  const buscadas = new Set(claves.map(claveNotion));
  return esquema.find((propiedad) => buscadas.has(claveNotion(propiedad.name)));
}

export function variantesBusquedaNotion(nombre: string) {
  const limpio = nombre.trim();
  if (limpio.length === 0) {
    return [];
  }
  const conEspacios = limpio.replace(/([a-zñ])([A-ZÁÉÍÓÚ])/g, "$1 $2");
  return [...new Set([limpio, conEspacios])];
}

function coincideAmplio(buscado: string, titulo: string) {
  const clave = claveNotion(buscado);
  const candidato = claveNotion(titulo);
  if (!(clave && candidato)) {
    return false;
  }
  if (clave === candidato) {
    return true;
  }
  if (clave.length < 4 || candidato.length < 4) {
    return false;
  }
  return candidato.includes(clave) || clave.includes(candidato);
}

/** One row only: exact normalized title, otherwise a unique containment. */
export function matchUnicoPorNombre(
  buscado: string,
  candidatos: NotionRelacionMatch[]
) {
  const clave = claveNotion(buscado);
  if (!clave) {
    return null;
  }

  const exactos = candidatos.filter(
    (candidato) => claveNotion(candidato.titulo) === clave
  );
  if (exactos.length === 1) {
    return exactos.at(0)?.id ?? null;
  }
  if (exactos.length > 1) {
    return null;
  }

  const amplios = candidatos.filter((candidato) =>
    coincideAmplio(buscado, candidato.titulo)
  );
  if (amplios.length === 1) {
    return amplios.at(0)?.id ?? null;
  }
  return null;
}

export function propiedadesPaginaTranscripcion({
  esquema,
  entrevistadoId,
  estado,
  fecha,
  firma,
  nombre,
  organizacionId,
  proyecto,
  proyectoId,
  titulo,
}: {
  esquema: NotionPropertySchema[];
  entrevistadoId?: string | null;
  estado?: string | null;
  fecha: string | null;
  firma: string | null;
  nombre: string;
  organizacionId?: string | null;
  proyecto: string | null;
  proyectoId?: string | null;
  titulo: string;
}): NotionPageProperties {
  const propiedades: NotionPageProperties = {};
  const tituloProp = esquema.find((propiedad) => propiedad.type === "title");
  if (tituloProp) {
    propiedades[tituloProp.name] = {
      title: textosNotion(titulo),
    };
  }

  const asignarTexto = (claves: string[], valor: string | null) => {
    if (!valor) {
      return;
    }
    const propiedad = propiedadPorClaves(esquema, claves);
    if (!propiedad || propiedad.name === tituloProp?.name) {
      return;
    }
    if (propiedad.type === "rich_text") {
      propiedades[propiedad.name] = { rich_text: textosNotion(valor) };
    }
  };

  const asignarRelacion = (
    claves: string[],
    pageId: string | null | undefined
  ) => {
    if (!pageId) {
      return;
    }
    const propiedad = propiedadPorClaves(esquema, claves);
    if (propiedad?.type !== "relation") {
      return;
    }
    propiedades[propiedad.name] = { relation: [{ id: pageId }] };
  };

  const asignarSelect = (
    claves: string[],
    valor: string | null | undefined
  ) => {
    if (!valor) {
      return;
    }
    const propiedad = propiedadPorClaves(esquema, claves);
    if (propiedad?.type !== "select") {
      return;
    }
    if (
      propiedad.selectOptions &&
      !propiedad.selectOptions.some((opcion) => opcion === valor)
    ) {
      return;
    }
    propiedades[propiedad.name] = { select: { name: valor } };
  };

  asignarTexto(["nombre", "entrevistado", "stakeholder", "persona"], nombre);
  asignarTexto(["firma", "empresa", "company"], firma);
  asignarTexto(["proyecto", "project"], proyecto);
  asignarRelacion(
    ["entrevistado", "people", "persona", "stakeholder"],
    entrevistadoId
  );
  asignarRelacion(
    ["organizacion", "organization", "empresa", "company", "firma"],
    organizacionId
  );
  asignarRelacion(["proyecto", "project"], proyectoId);
  asignarSelect(
    ["estado", "status"],
    estado === "completada" ? "Procesada" : null
  );

  const fechaProp = propiedadPorClaves(esquema, [
    "fecha",
    "date",
    "completada",
    "fecha completada",
  ]);
  if (fechaProp?.type === "date" && fecha) {
    const dia = fecha.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
      propiedades[fechaProp.name] = { date: { start: dia } };
    }
  }

  return propiedades;
}

export function lotesDeBloques<T>(items: T[], tamanio: number): T[][] {
  const lotes: T[][] = [];
  for (let indice = 0; indice < items.length; indice += tamanio) {
    lotes.push(items.slice(indice, indice + tamanio));
  }
  return lotes;
}

export function urlPaginaNotion(pageId: string) {
  return `https://notion.so/${pageId.replaceAll("-", "")}`;
}

export function configuracionNotionTranscripcion({
  databaseId,
  token,
}: {
  databaseId: string | undefined;
  token: string | undefined;
}) {
  const tokenLimpio = token?.trim();
  const encontrado = databaseId?.match(UUID_EN_TEXTO)?.at(0);
  if (!(tokenLimpio && encontrado)) {
    return null;
  }
  const database =
    encontrado.includes("-") || encontrado.length !== 32
      ? encontrado
      : `${encontrado.slice(0, 8)}-${encontrado.slice(8, 12)}-${encontrado.slice(12, 16)}-${encontrado.slice(16, 20)}-${encontrado.slice(20)}`;
  return { databaseId: database, token: tokenLimpio };
}
