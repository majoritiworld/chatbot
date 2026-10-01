import { FASES_ETM_TUESDAY } from "@/lib/consultoria/guiones/etm-tuesday";

const fases = new Set<string>(FASES_ETM_TUESDAY);

/**
 * Prepared walkthrough assignments. Their mail stays held until Seba
 * approves it explicitly after his own run.
 */
export const PARTICIPANTES_PENDIENTES_ETM: ReadonlySet<string> = new Set([
  "amelia.somavia@emprendetumente.org",
  "gabriel.fuentes@emprendetumente.org",
  "juan.lobos@emprendetumente.org",
]);

/** Seba's own run: the only real address that gets ETM mail today. */
export const EMAIL_PRUEBA_SEBA_ETM = "seba@majoriti.world";

/** Internal trials. Out of the real pilot and out of Notion. */
export const PARTICIPANTES_PRUEBA_ETM: ReadonlySet<string> = new Set([
  ...PARTICIPANTES_PENDIENTES_ETM,
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
 * Seba's run, or fictitious addresses while mail is intercepted. The three
 * prepared ETM people and the real pilot stay held.
 */
export function envioCorreoEtmPermitido(
  email: string | null | undefined,
  resendBaseUrl: string | undefined
) {
  const destino = normalizado(email);
  if (destino === EMAIL_PRUEBA_SEBA_ETM) {
    return true;
  }
  return (
    correoInterceptado(resendBaseUrl) && destino.endsWith(DOMINIO_FICTICIO)
  );
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
