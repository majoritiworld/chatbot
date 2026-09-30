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
  /** Null for a client brand without its own logo: never fall back to Majoriti. */
  logoSrc: string | null;
  /** Intrinsic pixels, so the access form reserves the real logo before it loads. */
  logoAlto?: number;
  logoAncho?: number;
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

const PNG_FIRMA = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const JPEG_INICIO = [255, 216] as const;
const MARCADORES_SIN_LONGITUD = new Set([1, 216, 217]);

function coincide(bytes: Uint8Array, firma: readonly number[]) {
  if (bytes.byteLength < firma.length) {
    return false;
  }
  for (const [indice, valor] of firma.entries()) {
    if (bytes.at(indice) !== valor) {
      return false;
    }
  }
  return true;
}

function medidasPng(bytes: Uint8Array) {
  if (!(coincide(bytes, PNG_FIRMA) && bytes.byteLength >= 24)) {
    return null;
  }
  if (
    bytes.at(12) !== 73 ||
    bytes.at(13) !== 72 ||
    bytes.at(14) !== 68 ||
    bytes.at(15) !== 82
  ) {
    return null;
  }
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ancho = vista.getUint32(16);
  const alto = vista.getUint32(20);
  if (ancho < 1 || alto < 1) {
    return null;
  }
  return { alto, ancho };
}

function marcadorSinLongitud(marcador: number) {
  return (
    MARCADORES_SIN_LONGITUD.has(marcador) ||
    (marcador >= 208 && marcador <= 215)
  );
}

function medidasJpeg(bytes: Uint8Array) {
  if (!coincide(bytes, JPEG_INICIO)) {
    return null;
  }
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 3 < bytes.byteLength) {
    if (bytes.at(offset) !== 255) {
      return null;
    }
    const marcador = bytes.at(offset + 1);
    if (marcador === undefined) {
      return null;
    }
    if (marcadorSinLongitud(marcador)) {
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.byteLength) {
      return null;
    }
    const longitud = vista.getUint16(offset + 2);
    if (
      (marcador === 192 || marcador === 193 || marcador === 194) &&
      offset + 9 <= bytes.byteLength
    ) {
      const alto = vista.getUint16(offset + 5);
      const ancho = vista.getUint16(offset + 7);
      if (ancho > 0 && alto > 0) {
        return { alto, ancho };
      }
      return null;
    }
    if (longitud < 2) {
      return null;
    }
    offset += 2 + longitud;
  }
  return null;
}

/** Width and height of a PNG or JPEG. Unknown formats reserve nothing. */
export function medidasImagen(bytes: Uint8Array) {
  return medidasPng(bytes) ?? medidasJpeg(bytes);
}

function logoDeMarca(
  logoPath: string | null | undefined,
  slug: string | null,
  personalizada: boolean
) {
  if (logoPath && slug) {
    return `/marca/${slug}/logo`;
  }
  return personalizada ? null : LOGO_PREDETERMINADO;
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
    logoSrc: logoDeMarca(fila.logo_path, slug, personalizada),
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

const INSTRUCCION_CODIGO =
  "Escribe tu correo y te enviaremos un código para entrar.";
const INSTRUCCION_GENERAL =
  "Escribe tu correo. Si el proyecto lo permite, entras directo. Si no, te enviamos un código.";

/** Copy for the email step. A branded project that always mails a code says so. */
export function textoInstruccionCorreo(
  marca: MarcaPublica,
  accesoDirecto = false
) {
  if (marca.personalizada && !accesoDirecto) {
    return INSTRUCCION_CODIGO;
  }
  return INSTRUCCION_GENERAL;
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
