import "server-only";

import { Resend } from "resend";
import {
  remitenteConNombre,
  type TextosComunicacion,
} from "@/lib/consultoria/comunicacion";
import { debeBloquearCorreoEntrevista } from "@/lib/consultoria/entrevista-piloto";
import {
  claveIdempotenciaConfirmacion,
  contenidoConfirmacionEntrevista,
  type MarcaPublica,
  marcaPredeterminada,
} from "@/lib/consultoria/marca";

async function enviarConResend({
  copiarEquipo = true,
  destinatario,
  html,
  idempotencyKey,
  remitente,
  subject,
  text,
}: {
  copiarEquipo?: boolean;
  destinatario: string;
  html: string;
  idempotencyKey?: string;
  remitente?: string | null;
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

  const baseUrl = process.env.RESEND_BASE_URL?.trim();
  const resend = baseUrl ? new Resend(apiKey, { baseUrl }) : new Resend(apiKey);
  const { data, error } = await resend.emails.send(
    {
      from: remitenteConNombre(from, remitente ?? null),
      html,
      subject,
      text,
      to: [destinatario],
      ...(copiarEquipo && !mismaBandeja && { bcc: [copiaEquipo] }),
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function enviarCorreoAgradecimiento({
  comunicacion,
  email,
  entrevistaId,
  marca = marcaPredeterminada(),
  nombre,
}: {
  comunicacion?: TextosComunicacion | null;
  email: string;
  entrevistaId: string;
  marca?: MarcaPublica;
  nombre?: string | null;
}) {
  const plantilla = contenidoConfirmacionEntrevista({
    comunicacion,
    marca,
    nombre,
  });
  return await enviarConResend({
    destinatario: email.trim(),
    html: plantilla.html,
    idempotencyKey: claveIdempotenciaConfirmacion(entrevistaId),
    remitente: plantilla.remitente,
    subject: plantilla.subject,
    text: plantilla.text,
  });
}
