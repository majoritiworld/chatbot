import { config } from "dotenv";
import { Resend } from "resend";
import { enviarCorreoInvitacion } from "@/lib/consultoria/email-entrevista";
import {
  EMAIL_PRUEBA_COLABORADORES,
  ENTREVISTA_PRUEBA_COLABORADORES,
} from "@/lib/consultoria/invitacion-colaboradores";
import { createAdminClient } from "@/lib/supabase/admin";

config({ path: ".env.local" });

const PORTAL = "https://portal.majoriti.world";

function escribir(linea: string) {
  process.stdout.write(`${linea}\n`);
}

function uno<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

async function main() {
  if (process.env.HABILITAR_INVITACIONES_CORREO !== "1") {
    throw new Error("Falta la habilitación puntual de esta ejecución.");
  }
  if (process.env.NEXT_PUBLIC_SITE_URL !== PORTAL) {
    throw new Error("El enlace no saldría del portal público.");
  }
  if (process.env.BLOQUEAR_CORREO_ENTREVISTA === "1") {
    throw new Error("El bloqueo local de correo sigue activo.");
  }

  const admin = createAdminClient();
  if (!admin) {
    throw new Error("No hay cliente administrativo.");
  }

  const { data: previos } = await admin
    .from("invitacion_envio")
    .select("id")
    .eq("entrevista_id", ENTREVISTA_PRUEBA_COLABORADORES)
    .eq("estado", "enviado")
    .limit(1);
  if ((previos ?? []).length > 0) {
    escribir("Ya había un envío registrado. No se reenvió.");
    return;
  }

  const { data: fila, error: errorFila } = await admin
    .from("entrevista")
    .select(
      "id, estado, flujo_estado, transcripcion, stakeholder:stakeholder_id(email)"
    )
    .eq("id", ENTREVISTA_PRUEBA_COLABORADORES)
    .maybeSingle();
  if (errorFila || !fila) {
    throw new Error("No está la entrevista de prueba.");
  }
  const stakeholder = uno(fila.stakeholder);
  if (stakeholder?.email?.trim().toLowerCase() !== EMAIL_PRUEBA_COLABORADORES) {
    throw new Error(
      "La entrevista de prueba no pertenece al destinatario autorizado."
    );
  }
  const turnos = Array.isArray(fila.transcripcion)
    ? fila.transcripcion.length
    : 0;
  if (
    fila.estado !== "abierta" ||
    fila.flujo_estado !== "bienvenida" ||
    turnos > 0
  ) {
    throw new Error("La entrevista de prueba ya no está sin iniciar.");
  }

  let aceptado: { id?: string | null } | null = null;
  try {
    aceptado = await enviarCorreoInvitacion(ENTREVISTA_PRUEBA_COLABORADORES);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "Error de envío";
    await admin.from("invitacion_envio").insert({
      correo: EMAIL_PRUEBA_COLABORADORES,
      detalle,
      entrevista_id: ENTREVISTA_PRUEBA_COLABORADORES,
      estado: "error",
    });
    throw error;
  }

  const { error: errorRegistro } = await admin.from("invitacion_envio").insert({
    correo: EMAIL_PRUEBA_COLABORADORES,
    detalle: "prueba autorizada",
    entrevista_id: ENTREVISTA_PRUEBA_COLABORADORES,
    estado: "enviado",
  });
  if (errorRegistro) {
    throw new Error(
      `Resend aceptó ${aceptado?.id ?? "sin id"}, pero no quedó el registro.`
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const correoId = aceptado?.id;
  if (!(apiKey && correoId)) {
    escribir("Resend aceptó el mensaje sin id consultable. Registro guardado.");
    return;
  }

  const resend = new Resend(apiKey);
  await new Promise((resolve) => {
    setTimeout(resolve, 5000);
  });
  const consulta = await resend.emails.get(correoId);
  if (consulta.error || !consulta.data) {
    escribir(
      `Resend aceptó ${correoId}. No se pudo leer el estado posterior: ${consulta.error?.message ?? "sin datos"}.`
    );
    return;
  }
  const { bcc, cc, from, last_event, reply_to, subject, to } = consulta.data;
  escribir(
    [
      `id=${correoId}`,
      `evento=${last_event}`,
      `from=${from}`,
      `to=${(to ?? []).join(",")}`,
      `cc=${(cc ?? []).join(",") || "ninguna"}`,
      `bcc=${(bcc ?? []).join(",") || "ninguna"}`,
      `reply_to=${(reply_to ?? []).join(",")}`,
      `subject=${subject}`,
    ].join("\n")
  );
}

main().catch((error: unknown) => {
  const mensaje = error instanceof Error ? error.message : "Error de envío";
  process.stderr.write(`${mensaje}\n`);
  process.exitCode = 1;
});
