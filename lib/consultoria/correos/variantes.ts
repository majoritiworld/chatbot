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
const CIERRE_CONFIRMACION =
  "Su entrevista está completa. No necesita hacer nada más.";
const YA_CERRADA = /nada más/i;
const MENCIONA_MINUTOS = /\bminutos\b/i;
const MENCIONA_GUARDADO = /guardar su avance|avance queda guardado/i;

export function remitenteVisible(cliente: string, configurado: string | null) {
  const base = configurado?.trim() || cliente;
  return base.endsWith(VIA_MAJORITI.trim()) ? base : `${base}${VIA_MAJORITI}`;
}

function saludo(nombre: string | null) {
  return nombre ? `Hola, ${nombre}:` : "Hola:";
}

function ayuda(identidad: IdentidadCorreo) {
  const quien = identidad.contactoNombre
    ? `${identidad.contactoNombre} (${identidad.contactoEmail})`
    : identidad.contactoEmail;
  return `¿Tiene alguna pregunta? Responda a este correo o escriba a ${quien}.`;
}

function firma(identidad: IdentidadCorreo, textos: TextosCorreo) {
  return textos.firma ?? `Equipo ${identidad.cliente}`;
}

function nombreIniciativa(identidad: IdentidadCorreo) {
  return identidad.titulo ? `«${identidad.titulo}»` : null;
}

export function correoConfirmacion({
  destinatario,
  identidad,
  siguientePaso,
  textos,
}: {
  destinatario: { email: string; nombre: string | null };
  identidad: IdentidadCorreo;
  siguientePaso: SiguientePaso | null;
  textos: TextosCorreo;
}): CorreoPreparado {
  const iniciativa = nombreIniciativa(identidad);
  const cuerpo = textos.cuerpo
    ? parrafosDeTexto(textos.cuerpo)
    : [
        `Gracias por completar la entrevista${iniciativa ? ` de ${iniciativa}` : ""}. Sus respuestas llegaron correctamente a ${identidad.cliente} y se considerarán en el trabajo del proyecto.`,
      ];
  const cerrada = cuerpo.some((parrafo) => YA_CERRADA.test(parrafo));
  const parrafos = cerrada ? cuerpo : [...cuerpo, CIERRE_CONFIRMACION];
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

  const subject =
    textos.asunto ??
    `Recibimos sus respuestas${identidad.titulo ? ` — ${identidad.titulo}` : ""}`;
  const preview = `${identidad.cliente} confirma que su entrevista quedó completa.`;
  const { html, text } = renderCorreo(identidad, {
    accion: null,
    ayuda: ayuda(identidad),
    comercial,
    firma: firma(identidad, textos),
    notas: [],
    parrafos,
    preview,
    saludo: saludo(destinatario.nombre),
    subject,
    titulo: "Recibimos sus respuestas",
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
}: {
  destinatario: { email: string; nombre: string | null };
  enlace: EnlaceAcceso;
  identidad: IdentidadCorreo;
  minutos: number | null;
  textos: TextosCorreo;
}): CorreoPreparado {
  const iniciativa = nombreIniciativa(identidad);
  const duracion = minutos
    ? `La entrevista toma aproximadamente ${minutos} minutos. Es una conversación guiada: puede responder por escrito o con la voz.`
    : "Es una conversación guiada: puede responder por escrito o con la voz.";
  const cuerpo = textos.cuerpo
    ? parrafosDeTexto(textos.cuerpo)
    : [
        `${identidad.cliente} le invita a participar en una entrevista${iniciativa ? ` de ${iniciativa}` : ""}. Sus respuestas ayudarán a ${identidad.cliente} a comprender mejor su experiencia y a orientar el trabajo del proyecto.`,
      ];
  const yaDiceDuracion = cuerpo.some((parrafo) =>
    MENCIONA_MINUTOS.test(parrafo)
  );
  const yaDiceGuardado = cuerpo.some((parrafo) =>
    MENCIONA_GUARDADO.test(parrafo)
  );
  const enlacePersonal = enlace.modo === "enlace_personal";
  const parrafos = [
    ...cuerpo,
    ...(yaDiceDuracion ? [] : [duracion]),
    ...(enlacePersonal && !yaDiceGuardado
      ? [
          "Puede guardar su avance y continuar más adelante desde este mismo enlace.",
        ]
      : []),
  ];

  const subject =
    textos.asunto ??
    `${identidad.cliente} le invita a una entrevista${identidad.titulo ? ` — ${identidad.titulo}` : ""}`;
  const preview = minutos
    ? `Una conversación guiada de unos ${minutos} minutos. Puede pausar y continuar cuando quiera.`
    : "Una conversación guiada. Puede pausar y continuar cuando quiera.";
  const notas = enlacePersonal
    ? []
    : [
        `Para entrar, escriba ${destinatario.email} y le enviaremos un código de acceso a este mismo correo.`,
        "Puede pausar y volver cuando quiera: su avance queda guardado y retoma donde lo dejó.",
        "Esta invitación es personal: el acceso queda vinculado a su correo. Le pedimos no reenviarla.",
      ];
  const { html, text } = renderCorreo(identidad, {
    accion: { etiqueta: "Comenzar mi entrevista", url: enlace.url },
    ayuda: ayuda(identidad),
    comercial: null,
    firma: firma(identidad, textos),
    notas,
    parrafos,
    preview,
    respaldoAccion: !enlacePersonal,
    saludo: saludo(destinatario.nombre),
    subject,
    titulo: identidad.titulo ?? "Le invitamos a una entrevista",
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
