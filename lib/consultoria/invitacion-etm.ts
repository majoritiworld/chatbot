import { FASES_ETM_TUESDAY } from "@/lib/consultoria/guiones/etm-tuesday";

const fases = new Set<string>(FASES_ETM_TUESDAY);

/**
 * Walkthrough trials approved by Seba on 1 Oct 2026 after his own run:
 * one invitation each, with a hidden copy to him, and the thank-you.
 */
export const PARTICIPANTES_APROBADOS_ETM: ReadonlySet<string> = new Set([
  "amelia.somavia@emprendetumente.org",
  "gabriel.fuentes@emprendetumente.org",
  "juan.lobos@emprendetumente.org",
]);

/** Seba's own run. Its mail carries [PRUEBA] in the subject. */
export const EMAIL_PRUEBA_SEBA_ETM = "seba@majoriti.world";

/** Internal trials. Out of the real pilot and out of Notion. */
export const PARTICIPANTES_PRUEBA_ETM: ReadonlySet<string> = new Set([
  ...PARTICIPANTES_APROBADOS_ETM,
  EMAIL_PRUEBA_SEBA_ETM,
]);

const HOSTS_INTERCEPTOR = new Set(["127.0.0.1", "localhost"]);
const DOMINIO_FICTICIO = "@example.test";

export function esFaseEtm(faseNombre: string | null) {
  return fases.has(faseNombre?.trim() ?? "");
}

export function esParticipantePruebaEtm(email: string | null | undefined) {
  return PARTICIPANTES_PRUEBA_ETM.has(email?.trim().toLowerCase() ?? "");
}

/** A local Resend stand-in: the mail never leaves the machine. */
export function correoInterceptado(baseUrl: string | undefined) {
  if (!baseUrl?.trim()) {
    return false;
  }
  try {
    return HOSTS_INTERCEPTOR.has(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
}

function normalizado(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function esPruebaSebaEtm(
  faseNombre: string | null,
  email: string | null | undefined
) {
  return esFaseEtm(faseNombre) && normalizado(email) === EMAIL_PRUEBA_SEBA_ETM;
}

/**
 * Seba's run, the three approved trials, or fictitious addresses while mail
 * is intercepted. Any other ETM address and the real pilot stay held.
 */
export function envioCorreoEtmPermitido(
  email: string | null | undefined,
  resendBaseUrl: string | undefined
) {
  const destino = normalizado(email);
  if (
    destino === EMAIL_PRUEBA_SEBA_ETM ||
    PARTICIPANTES_APROBADOS_ETM.has(destino)
  ) {
    return true;
  }
  return (
    correoInterceptado(resendBaseUrl) && destino.endsWith(DOMINIO_FICTICIO)
  );
}

/** Seba gets a hidden copy of each approved trial invitation, never of thank-yous. */
export function copiaOcultaInvitacionEtm(
  faseNombre: string | null,
  email: string | null | undefined
) {
  return esFaseEtm(faseNombre) &&
    PARTICIPANTES_APROBADOS_ETM.has(normalizado(email))
    ? EMAIL_PRUEBA_SEBA_ETM
    : null;
}

/** Phase batches stay held for ETM: trials go one by one. */
export function debeRetenerCorreoEtm(
  faseNombre: string | null,
  destino?: { email?: string | null; resendBaseUrl?: string }
) {
  if (!esFaseEtm(faseNombre)) {
    return false;
  }
  if (!destino) {
    return true;
  }
  return !envioCorreoEtmPermitido(destino.email, destino.resendBaseUrl);
}
