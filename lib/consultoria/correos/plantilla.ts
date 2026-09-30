import { textoSobreColor } from "@/lib/consultoria/marca";

/** What the client contributes to the look of a message. */
export type IdentidadVisual = {
  cliente: string;
  color: string | null;
  logoUrl: string | null;
};

export type AccionCorreo = {
  etiqueta: string;
  url: string;
};

/** Optional promo after the message. The button has no fallback URL in HTML. */
export type BloqueComercialCorreo = {
  accion: AccionCorreo | null;
  parrafos: string[];
};

export type ContenidoCorreo = {
  accion: AccionCorreo | null;
  ayuda: string;
  comercial: BloqueComercialCorreo | null;
  firma: string;
  notas: string[];
  parrafos: string[];
  preview: string;
  saludo: string;
  subject: string;
  titulo: string;
};

const NEUTRO = "#1f2937";
const TEXTO = "#1f2937";
const TENUE = "#6b7280";
const FONDO = "#f4f4f5";
const BORDE = "#e4e4e7";
const FUENTE =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const PIE = "Enviado a través de Majoriti";

const HTML_ESPECIALES = /[&<>"']/g;
const HTML_ESCAPE: Record<string, string> = {
  "'": "&#39;",
  '"': "&quot;",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const SALTO_PARRAFO = /\n{2,}/;
const SALTO_LINEA = /\n/g;

export function escapeHtml(value: string) {
  return value.replace(
    HTML_ESPECIALES,
    (caracter) => HTML_ESCAPE[caracter] ?? caracter
  );
}

/** Splits configured copy into paragraphs; single line breaks are kept. */
export function parrafosDeTexto(texto: string) {
  return texto
    .split(SALTO_PARRAFO)
    .map((parrafo) => parrafo.trim())
    .filter((parrafo) => parrafo.length > 0);
}

function colores(color: string | null) {
  if (color && COLOR_RE.test(color)) {
    return { acento: color.toLowerCase(), sobreAcento: textoSobreColor(color) };
  }
  return { acento: NEUTRO, sobreAcento: "#ffffff" };
}

function parrafoHtml(texto: string, estilo: string) {
  const contenido = escapeHtml(texto).replace(SALTO_LINEA, "<br />");
  return `<p style="margin:0 0 16px;${estilo}">${contenido}</p>`;
}

function cabeceraHtml(identidad: IdentidadVisual) {
  const nombre = escapeHtml(identidad.cliente);
  if (identidad.logoUrl) {
    return `<img src="${escapeHtml(identidad.logoUrl)}" alt="${nombre}" height="40" style="display:block;height:40px;width:auto;max-width:220px;border:0;outline:none;text-decoration:none;font-family:${FUENTE};font-size:18px;font-weight:700;line-height:40px;color:${TEXTO};" />`;
  }
  return `<p style="margin:0;font-family:${FUENTE};font-size:18px;font-weight:700;line-height:1.3;color:${TEXTO};">${nombre}</p>`;
}

function botonHtml(
  accion: AccionCorreo,
  acento: string,
  sobreAcento: string,
  respaldo: boolean
) {
  const url = escapeHtml(accion.url);
  const margen = respaldo ? "8px 0 12px" : "8px 0 0";
  const boton = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:${margen};">
<tr><td bgcolor="${acento}" style="border-radius:8px;background-color:${acento};">
<a href="${url}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 26px;font-family:${FUENTE};font-size:16px;font-weight:600;line-height:1.2;color:${sobreAcento};text-decoration:none;border-radius:8px;">${escapeHtml(accion.etiqueta)}</a>
</td></tr></table>`;
  if (!respaldo) {
    return boton;
  }
  return `${boton}
<p style="margin:0 0 20px;font-family:${FUENTE};font-size:13px;line-height:1.5;color:${TENUE};">Si el botón no funciona, copie este enlace en su navegador:<br /><a href="${url}" target="_blank" rel="noopener" style="color:${TENUE};word-break:break-all;">${url}</a></p>`;
}

function bloqueComercialHtml(
  bloque: BloqueComercialCorreo,
  cuerpo: string,
  acento: string,
  sobreAcento: string
) {
  const parrafos = bloque.parrafos
    .map((parrafo) => parrafoHtml(parrafo, cuerpo))
    .join("\n");
  const boton = bloque.accion
    ? botonHtml(bloque.accion, acento, sobreAcento, false)
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 32px;">
<tr><td class="comercial" bgcolor="${FONDO}" style="background-color:${FONDO};border:1px solid ${BORDE};border-radius:12px;padding:20px 22px;">
${parrafos}
${boton}
</td></tr></table>`;
}

export function renderCorreo(
  identidad: IdentidadVisual,
  contenido: ContenidoCorreo
) {
  const { acento, sobreAcento } = colores(identidad.color);
  const cuerpo = `font-family:${FUENTE};font-size:16px;line-height:1.6;color:${TEXTO};`;
  const tenue = `font-family:${FUENTE};font-size:14px;line-height:1.55;color:${TENUE};`;

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(contenido.subject)}</title>
<style>
:root { color-scheme: light; supported-color-schemes: light; }
@media (max-width: 620px) {
  .contenedor { width: 100% !important; }
  .interior { padding: 28px 22px !important; }
  .comercial { padding: 16px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${FONDO};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(contenido.preview)}${"&#8199;&#847;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${FONDO}" style="background-color:${FONDO};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" class="contenedor" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid ${BORDE};border-radius:12px;">
<tr><td height="4" bgcolor="${acento}" style="height:4px;background-color:${acento};border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td class="interior" style="padding:36px 40px;">
${cabeceraHtml(identidad)}
<h1 style="margin:28px 0 20px;font-family:${FUENTE};font-size:24px;font-weight:700;line-height:1.3;color:${TEXTO};">${escapeHtml(contenido.titulo)}</h1>
${parrafoHtml(contenido.saludo, cuerpo)}
${contenido.parrafos.map((parrafo) => parrafoHtml(parrafo, cuerpo)).join("\n")}
${contenido.comercial ? bloqueComercialHtml(contenido.comercial, cuerpo, acento, sobreAcento) : ""}
${contenido.accion ? botonHtml(contenido.accion, acento, sobreAcento, true) : ""}
${contenido.notas.map((nota) => parrafoHtml(nota, tenue)).join("\n")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr><td style="border-top:1px solid ${BORDE};padding-top:20px;">
${parrafoHtml(contenido.ayuda, tenue)}
<p style="margin:0;font-family:${FUENTE};font-size:16px;font-weight:600;line-height:1.5;color:${TEXTO};">${escapeHtml(contenido.firma)}</p>
</td></tr></table>
</td></tr>
</table>
<p style="margin:20px 0 0;font-family:${FUENTE};font-size:12px;line-height:1.5;color:${TENUE};">${PIE}</p>
</td></tr>
</table>
</body>
</html>`;

  const comercial = contenido.comercial?.parrafos ?? [];
  const enlaceComercial = contenido.comercial?.accion
    ? [
        `${contenido.comercial.accion.etiqueta}: ${contenido.comercial.accion.url}`,
      ]
    : [];
  const accion = contenido.accion
    ? [`${contenido.accion.etiqueta}: ${contenido.accion.url}`]
    : [];
  const text = [
    contenido.titulo,
    contenido.saludo,
    ...contenido.parrafos,
    ...comercial,
    ...enlaceComercial,
    ...accion,
    ...contenido.notas,
    contenido.ayuda,
    contenido.firma,
    `—\n${PIE}`,
  ].join("\n\n");

  return { html, text };
}
