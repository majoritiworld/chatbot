import type { TextosComunicacion } from "@/lib/consultoria/comunicacion";

/** Public presentation of a project. No participants and no private fields. */

export const LOGO_PREDETERMINADO = "/images/majoriti-logo.png";

const SLUG_MIN = 3;
const SLUG_MAX = 64;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Paths that already exist. A project slug must not take them over. */
export const SLUGS_RESERVADOS = [
  "admin",
  "api",
  "auth",
  "chat",
  "favicon.ico",
  "images",
  "login",
  "marca",
  "ping",
  "portal",
  "register",
  "robots.txt",
  "sin-acceso",
  "sitemap.xml",
  "vista-previa-entrevista",
] as const;

const reservados = new Set<string>(SLUGS_RESERVADOS);

export type FilaMarca = {
  aviso_respuestas?: string | null;
  cliente?: string | null;
  color_principal?: string | null;
  contacto_email?: string | null;
  contacto_nombre?: string | null;
  logo_path?: string | null;
  nombre_publico?: string | null;
  slug?: string | null;
  texto_bienvenida?: string | null;
  titulo_iniciativa?: string | null;
};

export type MarcaPublica = {
  avisoRespuestas: string | null;
  color: string | null;
  colorTexto: string | null;
  contactoEmail: string | null;
  contactoNombre: string | null;
  logoSrc: string;
  nombre: string;
  personalizada: boolean;
  slug: string | null;
  textoBienvenida: string | null;
  titulo: string;
};

export function marcaPredeterminada(): MarcaPublica {
  return {
    avisoRespuestas: null,
    color: null,
    colorTexto: null,
    contactoEmail: null,
    contactoNombre: null,
    logoSrc: LOGO_PREDETERMINADO,
    nombre: "Majoriti",
    personalizada: false,
    slug: null,
    textoBienvenida: null,
    titulo: "Entrevista",
  };
}

export function slugNormalizado(value: string | null | undefined) {
  const slug = value?.trim().toLowerCase() ?? "";
  return slug.length > 0 ? slug : null;
}

/** Null when empty, invalid, or reserved. Never a redirect target. */
export function slugValido(value: string | null | undefined) {
  const slug = slugNormalizado(value);
  if (!slug) {
    return null;
  }
  if (
    slug.length < SLUG_MIN ||
    slug.length > SLUG_MAX ||
    !SLUG_RE.test(slug) ||
    reservados.has(slug)
  ) {
    return null;
  }
  return slug;
}

export function mensajeSlugInvalido(value: string) {
  const slug = slugNormalizado(value);
  if (!slug) {
    return "Escribe un identificador para el enlace.";
  }
  if (reservados.has(slug)) {
    return "Ese identificador está reservado por el portal.";
  }
  return "Usa letras minúsculas, números y guiones. Por ejemplo compliance-latam-2026.";
}

export function interpretarColor(value: string) {
  const color = value.trim();
  if (!color) {
    return { color: null, ok: true as const };
  }
  if (!COLOR_RE.test(color)) {
    return { ok: false as const };
  }
  return { color: color.toLowerCase(), ok: true as const };
}

export function textoSobreColor(hex: string) {
  const rojo = Number.parseInt(hex.slice(1, 3), 16);
  const verde = Number.parseInt(hex.slice(3, 5), 16);
  const azul = Number.parseInt(hex.slice(5, 7), 16);
  const luminancia = (0.299 * rojo + 0.587 * verde + 0.114 * azul) / 255;
  return luminancia > 0.62 ? "#141414" : "#fafafa";
}

export function presentacionPublica(fila: FilaMarca): MarcaPublica {
  const slug = slugValido(fila.slug);
  const colorInterpretado = interpretarColor(fila.color_principal ?? "");
  const color = colorInterpretado.ok ? colorInterpretado.color : null;
  const nombrePublico = fila.nombre_publico?.trim() ?? "";
  const titulo = fila.titulo_iniciativa?.trim() ?? "";
  const bienvenida = fila.texto_bienvenida?.trim() ?? "";
  const aviso = fila.aviso_respuestas?.trim() ?? "";
  const contactoNombre = fila.contacto_nombre?.trim() ?? "";
  const contactoEmail = fila.contacto_email?.trim() ?? "";
  const personalizada = Boolean(
    nombrePublico ||
      fila.logo_path ||
      color ||
      titulo ||
      bienvenida ||
      contactoNombre ||
      contactoEmail ||
      slug
  );
  let nombre = "Majoriti";
  if (nombrePublico) {
    nombre = nombrePublico;
  } else if (personalizada) {
    nombre = fila.cliente?.trim() || "el proyecto";
  }

  return {
    avisoRespuestas: aviso || null,
    color,
    colorTexto: color ? textoSobreColor(color) : null,
    contactoEmail: contactoEmail || null,
    contactoNombre: contactoNombre || null,
    logoSrc:
      fila.logo_path && slug ? `/marca/${slug}/logo` : LOGO_PREDETERMINADO,
    nombre,
    personalizada,
    slug,
    textoBienvenida: bienvenida || null,
    titulo: titulo || (personalizada ? nombre : "Entrevista"),
  };
}

export function enlaceDeProyecto(site: string, slug: string) {
  return `${site.replace(/\/$/, "")}/${slug}`;
}

export function textoAccesoInvitacion(marca: MarcaPublica) {
  if (!marca.personalizada) {
    return "El acceso es solo para personas invitadas por Majoriti. Si tu correo no está, escríbenos y lo agregamos.";
  }
  if (marca.contactoEmail) {
    const quien = marca.contactoNombre
      ? `${marca.contactoNombre} (${marca.contactoEmail})`
      : marca.contactoEmail;
    return `El acceso es solo para personas invitadas por ${marca.nombre}. Si tu correo no está, escribe a ${quien}.`;
  }
  return `El acceso es solo para personas invitadas por ${marca.nombre}. Si tu correo no está, usa el contacto que te compartieron.`;
}

export function textoBienvenidaParticipante(
  marca: MarcaPublica,
  temas: string
) {
  if (marca.textoBienvenida) {
    return marca.textoBienvenida;
  }
  const quien = marca.personalizada ? marca.nombre : "Majoriti";
  return `Esta es una conversación guiada con un agente de ${quien}. Hay ${temas}. En cada uno podrás responder por escrito o con la voz, y el agente hará preguntas para profundizar.`;
}

export function textoContactoFallo(marca: MarcaPublica) {
  if (marca.personalizada && marca.contactoNombre) {
    return `Contacta a ${marca.contactoNombre}.`;
  }
  if (marca.personalizada) {
    return `Contacta al equipo de ${marca.nombre}.`;
  }
  return "Contacta a Majoriti.";
}

export function textoPausa(marca: MarcaPublica) {
  if (!marca.personalizada) {
    return "Puedes pausar y volver después. Lo que ya enviaste se conserva.";
  }
  return `Puedes pausar y volver después. ${marca.nombre} conserva lo que ya enviaste.`;
}

export function textoSinEntrevista(marca: MarcaPublica) {
  const quien = marca.personalizada ? marca.nombre : "Majoriti";
  return `Todavía no tienes una entrevista asignada. Cuando ${quien} la publique, entrarás directo a ella.`;
}

export function textoAvisoEnviada(marca: MarcaPublica) {
  if (!marca.personalizada) {
    return "Entrevista enviada. Majoriti te contactará para continuar.";
  }
  return `Entrevista enviada. ${marca.nombre} te contactará para continuar.`;
}

export function contextoConMarca(marca: MarcaPublica, cliente: string | null) {
  if (!marca.personalizada) {
    const nombre = cliente?.trim() ? cliente.trim() : "tu compañía";
    return `La preparó el equipo de Majoriti junto con ${nombre} para este proyecto de consultoría.`;
  }
  return `La preparó ${marca.nombre} para este proyecto.`;
}

export function puntosUsoConMarca(marca: MarcaPublica, cliente: string | null) {
  if (!marca.personalizada) {
    const nombre = cliente?.trim() ? cliente.trim() : "tu compañía";
    return [
      `Se guardan de forma exclusiva para ${nombre}.`,
      "El equipo de Majoriti las revisa durante el proyecto para analizarlas, generar insights y apoyar a la organización.",
      "No hace falta terminar de una: puedes guardar y continuar otro día.",
    ] as const;
  }
  return [
    `Se guardan de forma exclusiva para ${marca.nombre}.`,
    `${marca.nombre} las usa durante el proyecto para analizarlas y apoyar a la organización.`,
    "No hace falta terminar de una: puedes guardar y continuar otro día.",
  ] as const;
}

export function claveIdempotenciaConfirmacion(entrevistaId: string) {
  return `entrevista-${entrevistaId}-agradecimiento`;
}

const HTML_ESPECIALES = /[&<>"']/g;
const HTML_ESCAPE: Record<string, string> = {
  "'": "&#39;",
  '"': "&quot;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeHtml(value: string) {
  return value.replace(
    HTML_ESPECIALES,
    (caracter) => HTML_ESCAPE[caracter] ?? caracter
  );
}

const CIERRE_ACCION = "No necesitas hacer nada más.";

function parrafosHtml(texto: string) {
  return texto
    .split(/\n{2,}/)
    .map((parrafo) => `<p>${escapeHtml(parrafo.trim())}</p>`)
    .join("");
}

function htmlBloqueComercial(
  comunicacion: TextosComunicacion | null | undefined
) {
  const texto = comunicacion?.bloqueComercial;
  if (!texto) {
    return "";
  }
  const url = comunicacion.bloqueComercialUrl;
  const etiqueta = comunicacion.bloqueComercialEtiqueta;
  const enlace =
    url && etiqueta
      ? `<p><a href="${escapeHtml(url)}">${escapeHtml(etiqueta)}</a></p>`
      : "";
  return `<hr />${parrafosHtml(texto)}${enlace}`;
}

function textoBloqueComercial(
  comunicacion: TextosComunicacion | null | undefined
) {
  const texto = comunicacion?.bloqueComercial;
  if (!texto) {
    return "";
  }
  const url = comunicacion.bloqueComercialUrl;
  const etiqueta = comunicacion.bloqueComercialEtiqueta;
  const enlace = url && etiqueta ? `\n\n${etiqueta}: ${url}` : "";
  return `\n\n${texto}${enlace}`;
}

export function contenidoConfirmacionEntrevista({
  comunicacion,
  marca,
  nombre,
}: {
  comunicacion?: TextosComunicacion | null;
  marca: MarcaPublica;
  nombre?: string | null;
}) {
  const saludo = nombre?.trim() ? `Hola ${nombre.trim()},` : "Hola,";
  const quien = marca.personalizada ? marca.nombre : "Majoriti";
  const titulo = marca.personalizada ? marca.titulo : "la entrevista";
  const cuerpo =
    comunicacion?.correoCuerpo ??
    `Gracias por completar ${titulo} con ${quien}. Tus respuestas fueron recibidas y serán consideradas en el trabajo de consultoría.`;
  const cierre =
    comunicacion?.correoFirma ??
    (marca.personalizada ? `Equipo ${marca.nombre}` : "Equipo Majoriti");
  const subject =
    comunicacion?.correoAsunto ??
    (marca.personalizada
      ? `Recibimos tus respuestas — ${marca.titulo}`
      : "Gracias por participar en la entrevista");
  const incluyeCierre = cuerpo.includes(CIERRE_ACCION);
  const text = [
    saludo,
    "",
    cuerpo,
    incluyeCierre ? "" : `\n${CIERRE_ACCION}`,
    "",
    cierre,
    textoBloqueComercial(comunicacion),
  ].join("\n");

  return {
    html: `<p>${escapeHtml(saludo)}</p>
${parrafosHtml(cuerpo)}
${incluyeCierre ? "" : `<p>${CIERRE_ACCION}</p>`}
<p>${escapeHtml(cierre)}</p>${htmlBloqueComercial(comunicacion)}`,
    remitente: comunicacion?.correoRemitente ?? null,
    subject,
    text,
  };
}
