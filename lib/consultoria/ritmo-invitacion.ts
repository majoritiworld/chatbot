/**
 * Resend's published default is 2 requests per second. This account's quota
 * cannot be read: the API key only sends mail. The batch therefore waits one
 * second between messages unless INVITACION_RITMO_MS says otherwise.
 */
export const RITMO_INVITACION_MS = 1000;

export const INTENTOS_INVITACION = 5;

const TOPE_ESPERA_CRECIENTE_MS = 60_000;

const TOPE_RETRY_AFTER_MS = 15 * 60 * 1000;

const CODIGOS_REINTENTO = new Set([
  "application_error",
  "concurrent_idempotent_requests",
  "daily_quota_exceeded",
  "internal_server_error",
  "monthly_quota_exceeded",
  "network",
  "rate_limit_exceeded",
]);

const ESTADOS_REINTENTO = new Set([408, 429, 500, 502, 503, 504]);

export class ErrorEnvioCorreo extends Error {
  readonly codigo: string;
  readonly retryAfterMs: number | null;
  readonly statusCode: number | null;

  constructor(
    datos: {
      codigo: string;
      message: string;
      retryAfterMs: number | null;
      statusCode: number | null;
    },
    options?: { cause?: unknown }
  ) {
    super(datos.message, options);
    this.name = "ErrorEnvioCorreo";
    this.codigo = datos.codigo;
    this.retryAfterMs = datos.retryAfterMs;
    this.statusCode = datos.statusCode;
  }
}

export function ritmoInvitacionDesdeEntorno(
  env: Record<string, string | undefined>
) {
  return {
    intentosMaximos: enteroAcotado(
      env.INVITACION_INTENTOS_MAX,
      INTENTOS_INVITACION,
      1,
      8
    ),
    intervaloMs: enteroAcotado(
      env.INVITACION_RITMO_MS,
      RITMO_INVITACION_MS,
      200,
      TOPE_ESPERA_CRECIENTE_MS
    ),
  };
}

export function leerRetryAfterMs(
  headers: Record<string, string> | null | undefined
) {
  if (!headers) {
    return null;
  }
  const crudo = headers["retry-after"] ?? headers["Retry-After"];
  if (!crudo) {
    return null;
  }
  const segundos = Number(crudo);
  if (Number.isFinite(segundos) && segundos >= 0) {
    return Math.min(segundos * 1000, TOPE_RETRY_AFTER_MS);
  }
  const fecha = Date.parse(crudo);
  if (Number.isNaN(fecha)) {
    return null;
  }
  return Math.min(Math.max(0, fecha - Date.now()), TOPE_RETRY_AFTER_MS);
}

export function esperaReintentoMs({
  intento,
  intervaloBaseMs,
  retryAfterMs,
}: {
  intento: number;
  intervaloBaseMs: number;
  retryAfterMs: number | null;
}) {
  const creciente = Math.min(
    intervaloBaseMs * 2 ** Math.max(0, intento - 1),
    TOPE_ESPERA_CRECIENTE_MS
  );
  if (retryAfterMs === null) {
    return creciente;
  }
  return Math.max(creciente, retryAfterMs);
}

export function decisionReintento(
  error: unknown
): { retryAfterMs: number | null; tipo: "si" } | { tipo: "no" } {
  if (!(error instanceof ErrorEnvioCorreo)) {
    return { tipo: "no" };
  }
  if (error.codigo === "invalid_idempotent_request") {
    return { tipo: "no" };
  }
  const porEstado =
    error.statusCode !== null && ESTADOS_REINTENTO.has(error.statusCode);
  if (!(CODIGOS_REINTENTO.has(error.codigo) || porEstado)) {
    return { tipo: "no" };
  }
  return { retryAfterMs: error.retryAfterMs, tipo: "si" };
}

/** Retries one logical send. The caller keeps the same body and idempotency key. */
export async function ejecutarEnvioConReintentos<T>({
  dormir,
  enviar,
  intento = 1,
  intentosMaximos,
  intervaloBaseMs,
}: {
  dormir: (ms: number) => Promise<void>;
  enviar: () => Promise<T>;
  intento?: number;
  intentosMaximos: number;
  intervaloBaseMs: number;
}): Promise<T> {
  try {
    return await enviar();
  } catch (error) {
    const decision = decisionReintento(error);
    if (decision.tipo === "no" || intento >= intentosMaximos) {
      throw error;
    }
    await dormir(
      esperaReintentoMs({
        intento,
        intervaloBaseMs,
        retryAfterMs: decision.retryAfterMs,
      })
    );
    return await ejecutarEnvioConReintentos({
      dormir,
      enviar,
      intento: intento + 1,
      intentosMaximos,
      intervaloBaseMs,
    });
  }
}

export function detalleEnvioAceptado(id: string | null | undefined) {
  const limpio = id?.trim() ?? "";
  if (!limpio) {
    return null;
  }
  return `resend:${limpio}`;
}

export function dormirMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function enteroAcotado(
  valor: string | undefined,
  defecto: number,
  minimo: number,
  maximo: number
) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    return defecto;
  }
  return Math.min(maximo, Math.max(minimo, Math.trunc(numero)));
}
