/**
 * Sends one ETM invitation: Seba's run, one of the three approved trials (with
 * a hidden copy to Seba), or a fictitious address while mail is intercepted.
 *
 *   ENTREVISTA_ID=<uuid> CONFIRMAR_ENVIO=<same uuid> HABILITAR_INVITACIONES_CORREO=1 \
 *   NODE_OPTIONS=--conditions=react-server pnpm exec tsx scripts/enviar-invitacion-prueba-etm.ts
 */
import { enviarInvitacionPruebaEtm } from "@/lib/consultoria/email-entrevista";
import {
  correoInterceptado,
  EMAIL_PRUEBA_SEBA_ETM,
  PARTICIPANTES_APROBADOS_ETM,
} from "@/lib/consultoria/invitacion-etm";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DOMINIO_FICTICIO = "@example.test";

function escribir(linea: string) {
  process.stdout.write(`${linea}\n`);
}

async function destinatario(entrevistaId: string) {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  }
  const { data, error } = await admin
    .from("entrevista")
    .select("stakeholder(email)")
    .eq("id", entrevistaId)
    .single();
  if (error) {
    throw new Error(error.message);
  }
  const filas = [data.stakeholder].flat() as { email: string | null }[];
  return filas.at(0)?.email?.trim().toLowerCase() ?? "";
}

async function main() {
  const entrevistaId = process.env.ENTREVISTA_ID?.trim() ?? "";
  if (!UUID.test(entrevistaId)) {
    throw new Error("Falta ENTREVISTA_ID");
  }
  if (process.env.CONFIRMAR_ENVIO !== entrevistaId) {
    throw new Error("CONFIRMAR_ENVIO debe repetir ENTREVISTA_ID");
  }
  const email = await destinatario(entrevistaId);
  const ficticio =
    email.endsWith(DOMINIO_FICTICIO) &&
    correoInterceptado(process.env.RESEND_BASE_URL);
  if (
    !(
      email === EMAIL_PRUEBA_SEBA_ETM ||
      PARTICIPANTES_APROBADOS_ETM.has(email) ||
      ficticio
    )
  ) {
    throw new Error(
      "Solo Seba, las tres pruebas aprobadas o un correo ficticio interceptado."
    );
  }
  const resultado = await enviarInvitacionPruebaEtm(entrevistaId);
  if (resultado.estado === "enviado") {
    escribir(
      `aceptado por Resend entrevista=${entrevistaId} id=${resultado.resendId ?? "(sin id)"}`
    );
    return;
  }
  escribir(
    `ya enviada antes entrevista=${entrevistaId} ${resultado.detalle ?? ""}`
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Error de envío"}\n`
  );
  process.exitCode = 1;
});
