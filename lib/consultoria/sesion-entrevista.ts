import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

function normalizar(email: string) {
  return email.trim().toLowerCase();
}

export const MENSAJE_ENLACE_INVALIDO =
  "Este enlace ya no está disponible. Puede entrar con su correo electrónico y un código de verificación.";

export function hashTokenEnlace(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** What the stored link row says about a visit. Nothing here reads a cookie. */
export function decidirEntradaEnlace({
  encontrado,
  faseHabilitada,
  revocado,
}: {
  encontrado: boolean;
  faseHabilitada: boolean;
  revocado: boolean;
}) {
  if (!(encontrado && faseHabilitada) || revocado) {
    return { mensaje: MENSAJE_ENLACE_INVALIDO, ok: false as const };
  }
  return { ok: true as const };
}

/** Same text for an unknown email and for one assigned elsewhere. */
export const MENSAJE_SOLO_CORREO_SIN_ACCESO =
  "No podemos abrir una entrevista con ese correo desde aquí. Si recibió un enlace personal, ábralo desde su invitación. También puede entrar con su correo y un código de verificación.";

export const MENSAJE_SOLO_CORREO_VARIAS =
  "Este correo tiene más de una entrevista asignada. Escriba al equipo del proyecto para continuar.";

export const MENSAJE_SESION_AJENA =
  "Este navegador tiene abierta la sesión de otra persona. Ciérrela antes de entrar a esta entrevista.";

export function decidirEntradaSoloCorreo(
  asignaciones: Array<{ entrevista_id: string; fase_id: string }>
) {
  const [unica, ...otras] = asignaciones;
  if (!unica) {
    return { mensaje: MENSAJE_SOLO_CORREO_SIN_ACCESO, ok: false as const };
  }
  if (otras.length > 0) {
    return { mensaje: MENSAJE_SOLO_CORREO_VARIAS, ok: false as const };
  }
  return {
    entrevistaId: unica.entrevista_id,
    faseId: unica.fase_id,
    ok: true as const,
  };
}

/** A portal session of someone else is never replaced without a word. */
export function sesionPortalPermiteEntrar(
  emailPortal: string | null | undefined,
  emailAsignacion: string
) {
  return (
    !emailPortal || normalizar(emailPortal) === normalizar(emailAsignacion)
  );
}

/**
 * Whether the interview cookie may open this assignment.
 * No habitual session: the cookie stands alone.
 * Same person, except a committee account: the cookie may open it.
 * Another person, or a committee account: the cookie does not.
 */
export function decidirCookieFrenteASesionHabitual({
  emailCookie,
  emailHabitual,
  haySesionHabitual,
  rolHabitual,
}: {
  emailCookie: string;
  emailHabitual: string | null | undefined;
  haySesionHabitual: boolean;
  rolHabitual: string | null | undefined;
}): "permitida" | "ajena" | "comite" {
  if (!haySesionHabitual) {
    return "permitida";
  }
  if (
    !emailHabitual ||
    !sesionPortalPermiteEntrar(emailHabitual, emailCookie)
  ) {
    return "ajena";
  }
  if (rolHabitual === "comite") {
    return "comite";
  }
  return "permitida";
}

/**
 * A habitual session may open its own email-only assignment.
 * Committee stays out. Another person's session stays out.
 * A collaborator phase (no email-only access) stays out.
 */
export function puedeAbrirAsignacionConSesionHabitual({
  accesoSoloCorreo,
  emailAsignacion,
  emailHabitual,
  rolHabitual,
}: {
  accesoSoloCorreo: boolean;
  emailAsignacion: string;
  emailHabitual: string | null | undefined;
  rolHabitual: string | null | undefined;
}) {
  if (!accesoSoloCorreo) {
    return false;
  }
  return (
    decidirCookieFrenteASesionHabitual({
      emailCookie: emailAsignacion,
      emailHabitual,
      haySesionHabitual: true,
      rolHabitual,
    }) === "permitida"
  );
}

export const COOKIE_ENTREVISTA = "mj_entrevista";

const MAX_AGE_S = 60 * 60 * 12;
const PROPOSITO = "entrevista-acceso-v2";
const HASH_ENLACE = /^[0-9a-f]{64}$/;

const sesionSchema = z.discriminatedUnion("via", [
  z.object({
    email: z.string().email(),
    enlace: z.string().regex(HASH_ENLACE),
    entrevistaId: z.guid(),
    exp: z.number().int(),
    via: z.literal("enlace"),
  }),
  z.object({
    email: z.string().email(),
    entrevistaId: z.guid(),
    exp: z.number().int(),
    faseId: z.guid(),
    via: z.literal("correo"),
  }),
]);

/**
 * Opens one interview without a Supabase session. It carries no role: the
 * server re-checks the phase setting and the assignment on every request.
 */
export type SesionEntrevista =
  | {
      email: string;
      /** Hash of the link that opened it; a revoked or replaced link ends it. */
      enlace: string;
      entrevistaId: string;
      via: "enlace";
    }
  | {
      email: string;
      entrevistaId: string;
      faseId: string;
      via: "correo";
    };

function secreto() {
  return process.env.AUTH_SECRET ?? "";
}

export function opcionesCookieEntrevista() {
  return {
    httpOnly: true,
    maxAge: MAX_AGE_S,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function firmar(payload: string) {
  return createHmac("sha256", secreto())
    .update(`${PROPOSITO}.${payload}`)
    .digest("base64url");
}

export function empaquetarSesionEntrevista(sesion: SesionEntrevista) {
  const payload = Buffer.from(
    JSON.stringify({
      ...sesion,
      email: normalizar(sesion.email),
      exp: Math.floor(Date.now() / 1000) + MAX_AGE_S,
    }),
    "utf8"
  ).toString("base64url");
  return `${firmar(payload)}.${payload}`;
}

/** Signature and expiry only. The link row is checked on the server. */
export function leerSesionEntrevistaValor(
  value: string | undefined
): SesionEntrevista | null {
  if (!(value && secreto())) {
    return null;
  }

  const punto = value.indexOf(".");
  if (punto <= 0) {
    return null;
  }

  const firma = value.slice(0, punto);
  const payload = value.slice(punto + 1);
  const esperada = firmar(payload);
  const firmaBuffer = Buffer.from(firma);
  const esperadaBuffer = Buffer.from(esperada);
  if (
    firmaBuffer.length !== esperadaBuffer.length ||
    !timingSafeEqual(firmaBuffer, esperadaBuffer)
  ) {
    return null;
  }

  try {
    const parsed = sesionSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
    );
    if (!parsed.success || parsed.data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    const { exp: _exp, ...sesion } = parsed.data;
    return sesion;
  } catch {
    return null;
  }
}

const RUTAS_API_ENTREVISTA = new Set([
  "/api/chat",
  "/api/entrevista/enviar",
  "/api/entrevista/finalizar",
  "/api/entrevista/flujo",
  "/api/entrevista/guardar",
  "/api/entrevista/sintesis",
  "/api/transcribe",
]);

/** Paths a link cookie may open. Anything else stays on portal auth. */
export function rutaCubiertaPorSesionEntrevista(
  pathname: string,
  entrevistaId: string
) {
  return (
    pathname === `/portal/entrevista/${entrevistaId}` ||
    RUTAS_API_ENTREVISTA.has(pathname)
  );
}
