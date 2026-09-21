import "server-only";

import { Resend } from "resend";
import { debeBloquearCorreoEntrevista } from "@/lib/consultoria/entrevista-piloto";

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

function saludoCorreo(nombre?: string | null) {
  return nombre?.trim() ? `Hola ${nombre.trim()},` : "Hola,";
}

function plantillaAgradecimiento(nombre?: string | null) {
  const saludo = saludoCorreo(nombre);
  const cuerpo =
    "Gracias por completar la entrevista con Majoriti. Tus respuestas fueron enviadas correctamente y serán consideradas en el trabajo de consultoría.";

  return {
    html: `<p>${escapeHtml(saludo)}</p>
<p>${cuerpo}</p>
<p>No necesitas hacer nada más.</p>
<p>Equipo Majoriti</p>`,
    text: `${saludo}

${cuerpo}

No necesitas hacer nada más.

Equipo Majoriti`,
  };
}

function plantillaInvitacion({
  enlace,
  nombre,
}: {
  enlace: string;
  nombre?: string | null;
}) {
  const saludo = saludoCorreo(nombre);
  const cuerpo =
    "Te invitamos a responder una entrevista con Majoriti. Abre el enlace para ir a la entrevista que te corresponde.";

  return {
    html: `<p>${escapeHtml(saludo)}</p>
<p>${cuerpo}</p>
<p><a href="${escapeHtml(enlace)}">Abrir tu entrevista</a></p>
<p>Equipo Majoriti</p>`,
    text: `${saludo}

${cuerpo}

${enlace}

Equipo Majoriti`,
  };
}

async function enviarConResend({
  destinatario,
  html,
  idempotencyKey,
  subject,
  text,
}: {
  destinatario: string;
  html: string;
  idempotencyKey?: string;
  subject: string;
  text: string;
}) {
  if (
    debeBloquearCorreoEntrevista({
      flag: process.env.BLOQUEAR_CORREO_ENTREVISTA,
      vercel: process.env.VERCEL,
    })
  ) {
    throw new Error("Correo bloqueado en el servidor local de prueba");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INTERVIEW_EMAIL_FROM;
  if (!(apiKey && from)) {
    throw new Error("El correo de la entrevista no está configurado");
  }

  const copiaEquipo =
    process.env.INTERVIEW_EMAIL_BCC?.trim() || "hello@majoriti.world";
  const mismaBandeja = destinatario.toLowerCase() === copiaEquipo.toLowerCase();

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send(
    {
      from,
      html,
      subject,
      text,
      to: [destinatario],
      ...(!mismaBandeja && { bcc: [copiaEquipo] }),
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function enviarCorreoAgradecimiento({
  email,
  entrevistaId,
  nombre,
}: {
  email: string;
  entrevistaId: string;
  nombre?: string | null;
}) {
  const plantilla = plantillaAgradecimiento(nombre);
  return await enviarConResend({
    destinatario: email.trim(),
    html: plantilla.html,
    idempotencyKey: `entrevista-${entrevistaId}-agradecimiento`,
    subject: "Gracias por participar en la entrevista",
    text: plantilla.text,
  });
}

export async function enviarCorreoInvitacionEntrevista({
  email,
  enlace,
  nombre,
}: {
  email: string;
  enlace: string;
  nombre?: string | null;
}) {
  const plantilla = plantillaInvitacion({ enlace, nombre });
  return await enviarConResend({
    destinatario: email.trim(),
    html: plantilla.html,
    subject: "Invitación a la entrevista de Majoriti",
    text: plantilla.text,
  });
}
