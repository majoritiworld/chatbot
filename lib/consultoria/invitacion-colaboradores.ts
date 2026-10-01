import { NOMBRE_FASE_COLABORADORES } from "@/lib/consultoria/guiones/compliance-latam-colaboradores";

/**
 * Stays false until an explicit later confirmation of the whole phase.
 * Do not flip this to send the campaign.
 */
export function envioInvitacionesColaboradoresPermitido() {
  return false;
}

/** One authorized trial. It does not open the phase. */
export const ENTREVISTA_PRUEBA_COLABORADORES =
  "1190524f-79e3-49e8-b090-7000711d21ad";

export const EMAIL_PRUEBA_COLABORADORES = "seba@majoriti.world";

const PREFIJO_ASUNTO_PRUEBA = "[PRUEBA] ";
const EMPRESA_DE_PRUEBA = /^prueba(?:$|[\s·—\-–])/i;
const CORREO_PRUEBA_CARGA = /^prueba-colaborador-[^@]+@majoriti\.world$/;

export function esExcepcionEnvioPruebaColaboradores({
  email,
  entrevistaId,
  faseNombre,
}: {
  email: string;
  entrevistaId: string;
  faseNombre: string | null;
}) {
  return (
    faseNombre?.trim() === NOMBRE_FASE_COLABORADORES &&
    entrevistaId === ENTREVISTA_PRUEBA_COLABORADORES &&
    email.trim().toLowerCase() === EMAIL_PRUEBA_COLABORADORES
  );
}

/** Trial rows stay out of a future colaboradores campaign. Other phases are unchanged. */
export function excluirDeCampanaColaboradores(
  faseNombre: string | null,
  fila: { correo?: string | null; empresa?: string | null }
) {
  return (
    faseNombre?.trim() === NOMBRE_FASE_COLABORADORES &&
    esParticipantePruebaColaboradores(fila)
  );
}

/** Trial rows stay out of the 284 real recipients and out of the campaign. */
export function esParticipantePruebaColaboradores({
  correo,
  empresa,
}: {
  correo?: string | null;
  empresa?: string | null;
}) {
  const email = correo?.trim().toLowerCase() ?? "";
  const organizacion = empresa?.trim() ?? "";
  if (email === EMAIL_PRUEBA_COLABORADORES) {
    return true;
  }
  if (CORREO_PRUEBA_CARGA.test(email)) {
    return true;
  }
  return EMPRESA_DE_PRUEBA.test(organizacion);
}

export function asuntoConPrefijoPrueba(asunto: string) {
  const limpio = asunto.trim();
  if (limpio.startsWith(PREFIJO_ASUNTO_PRUEBA)) {
    return limpio;
  }
  return `${PREFIJO_ASUNTO_PRUEBA}${limpio}`;
}

/**
 * Holds invitations and the thank-you mail of this phase until confirmed.
 * The single trial assignment is the only exception, and only for its own address.
 */
export function debeRetenerCorreoColaboradores(
  faseNombre: string | null,
  entrevista?: { email?: string | null; entrevistaId?: string | null }
) {
  if (faseNombre?.trim() !== NOMBRE_FASE_COLABORADORES) {
    return false;
  }
  if (
    esExcepcionEnvioPruebaColaboradores({
      email: entrevista?.email ?? "",
      entrevistaId: entrevista?.entrevistaId ?? "",
      faseNombre,
    })
  ) {
    return false;
  }
  return !envioInvitacionesColaboradoresPermitido();
}
