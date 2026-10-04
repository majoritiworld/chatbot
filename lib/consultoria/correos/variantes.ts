import type {
  SiguientePaso,
  TextosCorreo,
} from "@/lib/consultoria/comunicacion";
import type { IdentidadCorreo } from "@/lib/consultoria/correos/asignacion";
import type { EnlaceAcceso } from "@/lib/consultoria/correos/enlace-acceso";
import {
  parrafosDeTexto,
  renderCorreo,
} from "@/lib/consultoria/correos/plantilla";

export type TipoCorreo = "confirmacion" | "invitacion";

/** Everything a send or a preview needs. The mailbox is added when sending. */
export type CorreoPreparado = {
  destinatario: string;
  html: string;
  preview: string;
  remitenteVisible: string;
  replyTo: string;
  subject: string;
  text: string;
  tipo: TipoCorreo;
};

const VIA_MAJORITI = " vía Majoriti";
const CIERRE_CONFIRMACION = {
  tu: "Tu entrevista está completa. No necesitas hacer nada más.",
  usted: "Su entrevista está completa. No necesita hacer nada más.",
} as const;
const YA_CERRADA = /nada más/i;
const MENCIONA_MINUTOS = /\bminutos\b/i;
const MENCIONA_GUARDADO = /guardar (?:su|tu) avance|avance queda guardado/i;
const INVITACION_YA_EXPLICA_LA_VOZ = /con tu voz/i;
const PREFIJO_PRUEBA = "[PRUEBA] ";

export function remitenteVisible(cliente: string, configurado: string | null) {
  const base = configurado?.trim() || cliente;
  return base.endsWith(VIA_MAJORITI.trim()) ? base : `${base}${VIA_MAJORITI}`;
}

function saludo(nombre: string | null) {
  return nombre ? `Hola, ${nombre}:` : "Hola:";
}

function ayuda(identidad: IdentidadCorreo, trato: "tu" | "usted") {
  if (trato === "tu") {
    return `¿Tienes alguna pregunta? Responde a este correo o escribe a ${identidad.contactoEmail}.`;
  }
  const quien = identidad.contactoNombre
    ? `${identidad.contactoNombre} (${identidad.contactoEmail})`
    : identidad.contactoEmail;
  return `¿Tiene alguna pregunta? Responda a este correo o escriba a ${quien}.`;
}

function firma(identidad: IdentidadCorreo, textos: TextosCorreo) {
  return textos.firma ?? `Equipo ${identidad.cliente}`;
}

function previewInvitacion(minutos: number | null, trato: "tu" | "usted") {
  if (trato === "tu" && minutos) {
    return `Una conversación de unos ${minutos} minutos. Puedes pausar y continuar cuando quieras.`;
  }
  if (trato === "tu") {
    return "Una conversación guiada. Puedes pausar y continuar cuando quieras.";
  }
  if (minutos) {
    return `Una conversación guiada de unos ${minutos} minutos. Puede pausar y continuar cuando quiera.`;
  }
  return "Una conversación guiada. Puede pausar y continuar cuando quiera.";
}

function tituloInvitacion(
  identidad: IdentidadCorreo,
  subject: string,
  trato: "tu" | "usted"
) {
  if (identidad.titulo) {
    return identidad.titulo;
  }
  if (trato !== "tu") {
    return "Le invitamos a una entrevista";
  }
  if (subject.startsWith(PREFIJO_PRUEBA)) {
    return subject.slice(PREFIJO_PRUEBA.length);
  }
  return subject;
}

function textoDuracionInvitacion(
  minutos: number | null,
  trato: "tu" | "usted"
) {
  if (trato === "tu") {
    return minutos
      ? `La entrevista toma aproximadamente ${minutos} minutos. Es una conversación guiada: puedes responder por escrito o con la voz.`
      : "Es una conversación guiada: puedes responder por escrito o con la voz.";
  }
  return minutos
    ? `La entrevista toma aproximadamente ${minutos} minutos. Es una conversación guiada: puede responder por escrito o con la voz.`
    : "Es una conversación guiada: puede responder por escrito o con la voz.";
}

function nombreIniciativa(identidad: IdentidadCorreo) {
  return identidad.titulo ? `«${identidad.titulo}»` : null;
}

export function correoConfirmacion({
  destinatario,
  identidad,
  siguientePaso,
  textos,
  trato = "usted",
}: {
  destinatario: { email: string; nombre: string | null };
  identidad: IdentidadCorreo;
  siguientePaso: SiguientePaso | null;
  textos: TextosCorreo;
  trato?: "tu" | "usted";
}): CorreoPreparado {
  const iniciativa = nombreIniciativa(identidad);
  const cuerpo = textos.cuerpo
    ? parrafosDeTexto(textos.cuerpo)
    : [
        `Gracias por completar la entrevista${iniciativa ? ` de ${iniciativa}` : ""}. Sus respuestas llegaron correctamente a ${identidad.cliente} y se considerarán en el trabajo del proyecto.`,
      ];
  const cerrada = cuerpo.some((parrafo) => YA_CERRADA.test(parrafo));
  const parrafos = cerrada ? cuerpo : [...cuerpo, CIERRE_CONFIRMACION[trato]];
  const comercial = siguientePaso
    ? {
        accion:
          siguientePaso.url && siguientePaso.etiqueta
            ? {
                etiqueta: siguientePaso.etiqueta,
                url: siguientePaso.url,
              }
            : null,
        parrafos: parrafosDeTexto(siguientePaso.texto),
      }
    : null;

  const recibimos =
    trato === "tu" ? "Recibimos tus respuestas" : "Recibimos sus respuestas";
  const subject =
    textos.asunto ??
    `${recibimos}${identidad.titulo ? ` — ${identidad.titulo}` : ""}`;
  const preview = `${identidad.cliente} confirma que ${trato === "tu" ? "tu" : "su"} entrevista quedó completa.`;
  const { html, text } = renderCorreo(identidad, {
    accion: null,
    ayuda: ayuda(identidad, trato),
    comercial,
    firma: firma(identidad, textos),
    notas: [],
    parrafos,
    preview,
    saludo: saludo(destinatario.nombre),
    subject,
    titulo: recibimos,
  });

  return {
    destinatario: destinatario.email,
    html,
    preview,
    remitenteVisible: remitenteVisible(identidad.cliente, textos.remitente),
    replyTo: identidad.contactoEmail,
    subject,
    text,
    tipo: "confirmacion",
  };
}

export function correoInvitacion({
  destinatario,
  enlace,
  identidad,
  minutos,
  textos,
  trato = "usted",
}: {
  destinatario: { email: string; nombre: string | null };
  enlace: EnlaceAcceso;
  identidad: IdentidadCorreo;
  minutos: number | null;
  textos: TextosCorreo;
  trato?: "tu" | "usted";
}): CorreoPreparado {
  const iniciativa = nombreIniciativa(identidad);
  const duracion = textoDuracionInvitacion(minutos, trato);
  const cuerpo = textos.cuerpo
    ? parrafosDeTexto(textos.cuerpo)
    : [
        `${identidad.cliente} le invita a participar en una entrevista${iniciativa ? ` de ${iniciativa}` : ""}. Sus respuestas ayudarán a ${identidad.cliente} a comprender mejor su experiencia y a orientar el trabajo del proyecto.`,
      ];
  const yaDiceDuracion = cuerpo.some((parrafo) =>
    MENCIONA_MINUTOS.test(parrafo)
  );
  const yaDiceGuardado = cuerpo.some(
    (parrafo) =>
      MENCIONA_GUARDADO.test(parrafo) ||
      INVITACION_YA_EXPLICA_LA_VOZ.test(parrafo)
  );
  const enlacePersonal = enlace.modo === "enlace_personal";
  const textoAyuda = ayuda(identidad, trato);
  const textoFirma =
    trato === "tu" && !firma(identidad, textos).startsWith("Saludos")
      ? `Saludos,\n${firma(identidad, textos)}`
      : firma(identidad, textos);
  const saludoTexto = saludo(destinatario.nombre);
  const piezasPlantilla = new Set([saludoTexto, textoAyuda, textoFirma]);
  const cuerpoVisible = cuerpo.filter(
    (parrafo) => !piezasPlantilla.has(parrafo)
  );
  const parrafos = [
    ...cuerpoVisible,
    ...(yaDiceDuracion ? [] : [duracion]),
    ...(enlacePersonal && !yaDiceGuardado
      ? [
          trato === "tu"
            ? "Puedes guardar tu avance y continuar más adelante desde este mismo enlace."
            : "Puede guardar su avance y continuar más adelante desde este mismo enlace.",
        ]
      : []),
  ];

  const subject =
    textos.asunto ??
    `${identidad.cliente} le invita a una entrevista${identidad.titulo ? ` — ${identidad.titulo}` : ""}`;
  const preview = previewInvitacion(minutos, trato);
  const notas = enlacePersonal
    ? []
    : [
        `Para entrar, escriba ${destinatario.email} y le enviaremos un código de acceso a este mismo correo.`,
        "Puede pausar y volver cuando quiera: su avance queda guardado y retoma donde lo dejó.",
        "Esta invitación es personal: el acceso queda vinculado a su correo. Le pedimos no reenviarla.",
      ];
  const titulo = tituloInvitacion(identidad, subject, trato);
  const { html, text } = renderCorreo(identidad, {
    accion: { etiqueta: "Comenzar mi entrevista", url: enlace.url },
    ayuda: textoAyuda,
    comercial: null,
    firma: textoFirma,
    notas,
    parrafos,
    preview,
    respaldoAccion: !enlacePersonal,
    saludo: saludoTexto,
    subject,
    titulo,
  });

  return {
    destinatario: destinatario.email,
    html,
    preview,
    remitenteVisible: remitenteVisible(identidad.cliente, textos.remitente),
    replyTo: identidad.contactoEmail,
    subject,
    text,
    tipo: "invitacion",
  };
}
