import "server-only";

import { Resend } from "resend";

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

function plantillaAgradecimiento(nombre?: string | null) {
  const saludo = nombre?.trim() ? `Hola ${nombre.trim()},` : "Hola,";
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

export async function enviarCorreoAgradecimiento({
  email,
  entrevistaId,
  nombre,
}: {
  email: string;
  entrevistaId: string;
  nombre?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INTERVIEW_EMAIL_FROM;
  if (!(apiKey && from)) {
    throw new Error("El correo de agradecimiento no está configurado");
  }

  const copiaEquipo =
    process.env.INTERVIEW_EMAIL_BCC?.trim() || "hello@majoriti.world";
  const destinatario = email.trim();
  const mismaBandeja = destinatario.toLowerCase() === copiaEquipo.toLowerCase();

  const resend = new Resend(apiKey);
  const plantilla = plantillaAgradecimiento(nombre);
  const { data, error } = await resend.emails.send(
    {
      from,
      html: plantilla.html,
      subject: "Gracias por participar en la entrevista",
      text: plantilla.text,
      to: [destinatario],
      ...(!mismaBandeja && { bcc: [copiaEquipo] }),
    },
    { idempotencyKey: `entrevista-${entrevistaId}-agradecimiento` }
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
