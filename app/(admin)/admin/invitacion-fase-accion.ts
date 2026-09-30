"use server";

import { requireAdminUser } from "@/lib/consultoria/admin";
import { enviarInvitacionesDeFase } from "@/lib/consultoria/email-entrevista";

export async function solicitarEnvioInvitacionesFase(
  faseId: string,
  _previo: string | null
) {
  await requireAdminUser();
  const resultado = await enviarInvitacionesDeFase(faseId);
  if (resultado.bloqueado) {
    return `${resultado.bloqueado}. No se envió ningún correo.`;
  }
  return `Enviados: ${resultado.enviados}. Omitidos: ${resultado.omitidos}. Errores: ${resultado.errores}.`;
}
