import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  ensureAuthUser,
  ensureUsuarioPerfil,
  normalizarEmail,
} from "@/lib/consultoria/auth";
import { nombreCompleto } from "@/lib/consultoria/nombre";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const COOKIE_RETURN = "mj_return";
const COOKIE_COMO = "mj_como";
const MAX_AGE_S = 60 * 60 * 8;

const sesionGuardadaSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});

const vistaComoSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(1),
});

export type VistaComo = z.infer<typeof vistaComoSchema>;

function patronEmail(email: string) {
  return email.replace(/[\\%_]/g, "\\$&");
}

function secreto() {
  return process.env.AUTH_SECRET ?? "";
}

function opcionesCookie() {
  return {
    httpOnly: true,
    maxAge: MAX_AGE_S,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function firmar(payload: string) {
  return createHmac("sha256", secreto()).update(payload).digest("base64url");
}

function empaquetar(data: unknown) {
  const payload = Buffer.from(JSON.stringify(data), "utf8").toString(
    "base64url"
  );
  return `${firmar(payload)}.${payload}`;
}

function desempaquetar(value: string | undefined): unknown {
  if (!value) {
    return null;
  }

  const punto = value.indexOf(".");
  if (punto <= 0) {
    return null;
  }

  const firma = value.slice(0, punto);
  const payload = value.slice(punto + 1);
  const esperada = firmar(payload);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function leerVistaComo(): Promise<VistaComo | null> {
  if (!secreto()) {
    return null;
  }

  const jar = await cookies();
  const parsed = vistaComoSchema.safeParse(
    desempaquetar(jar.get(COOKIE_COMO)?.value)
  );
  return parsed.success ? parsed.data : null;
}

async function leerSesionGuardada() {
  const jar = await cookies();
  const parsed = sesionGuardadaSchema.safeParse(
    desempaquetar(jar.get(COOKIE_RETURN)?.value)
  );
  return parsed.success ? parsed.data : null;
}

export async function borrarCookiesImpersonacion() {
  const jar = await cookies();
  const expired = { ...opcionesCookie(), maxAge: 0 };
  jar.set(COOKIE_COMO, "", expired);
  jar.set(COOKIE_RETURN, "", expired);
}

async function guardarRetornoSiHaceFalta() {
  const existente = await leerSesionGuardada();
  if (existente) {
    return true;
  }

  if (!secreto()) {
    return false;
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!(session?.access_token && session.refresh_token)) {
    return false;
  }

  const jar = await cookies();
  jar.set(
    COOKIE_RETURN,
    empaquetar({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
    opcionesCookie()
  );
  return true;
}

async function marcarVistaComo(vista: VistaComo) {
  const jar = await cookies();
  jar.set(COOKIE_COMO, empaquetar(vista), opcionesCookie());
}

function tipoEmail(value: string | undefined): EmailOtpType {
  switch (value) {
    case "email":
    case "email_change":
    case "invite":
    case "magiclink":
    case "recovery":
    case "signup":
      return value;
    default:
      return "magiclink";
  }
}

export type ResultadoImpersonar = { ok: true } | { ok: false; message: string };

/**
 * Replaces the current session with the stakeholder's. The Majoriti session is
 * stashed in an httpOnly cookie so "Volver al admin" can restore it.
 */
export async function impersonarStakeholder(
  stakeholderId: string
): Promise<ResultadoImpersonar> {
  const admin = createAdminClient();

  if (!admin) {
    return {
      message: "No se pudo preparar el acceso al portal.",
      ok: false,
    };
  }

  if (!secreto()) {
    return {
      message: "Falta AUTH_SECRET para guardar la sesión de Majoriti.",
      ok: false,
    };
  }

  const { data: stakeholder } = await admin
    .from("stakeholder")
    .select("id, nombre, apellido, email")
    .eq("id", stakeholderId)
    .maybeSingle();

  if (!stakeholder) {
    return { message: "No encontramos a ese stakeholder.", ok: false };
  }

  const nombreVisible = nombreCompleto(
    stakeholder.nombre,
    stakeholder.apellido
  );
  const email = normalizarEmail(stakeholder.email);
  const cuenta = await ensureAuthUser({
    email,
    nombre: nombreVisible,
  });

  if (!cuenta.ok) {
    return {
      message: "No se pudo preparar la cuenta de esa persona.",
      ok: false,
    };
  }

  const { data: perfil } = await admin
    .from("usuario")
    .select("rol")
    .ilike("email", patronEmail(email))
    .maybeSingle();

  if (perfil?.rol === "majoriti") {
    return {
      message: "Esa cuenta es de Majoriti. Entra con su propio correo.",
      ok: false,
    };
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    email,
    type: "magiclink",
  });
  const properties = z
    .object({
      hashed_token: z.string().min(1).optional(),
      hashedToken: z.string().min(1).optional(),
      verification_type: z.string().optional(),
      verificationType: z.string().optional(),
    })
    .safeParse(link?.properties);
  const hashedToken = properties.success
    ? (properties.data.hashed_token ?? properties.data.hashedToken)
    : undefined;
  const verificationType = properties.success
    ? (properties.data.verification_type ?? properties.data.verificationType)
    : undefined;

  if (linkError || !hashedToken) {
    return {
      message: "No se pudo abrir el portal de esa persona. Intenta de nuevo.",
      ok: false,
    };
  }

  const guardado = await guardarRetornoSiHaceFalta();
  if (!guardado) {
    return {
      message: "No se pudo guardar la sesión de Majoriti para volver.",
      ok: false,
    };
  }

  const supabase = await createClient();
  const { data: sesion, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: hashedToken,
    type: tipoEmail(verificationType),
  });

  if (verifyError || !sesion.user) {
    return {
      message: "No se pudo entrar como esa persona. Intenta de nuevo.",
      ok: false,
    };
  }

  await ensureUsuarioPerfil(sesion.user);
  await marcarVistaComo({
    email,
    nombre: nombreVisible,
  });

  return { ok: true };
}

export async function restaurarSesionMajoriti(): Promise<ResultadoImpersonar> {
  const guardada = await leerSesionGuardada();

  if (!guardada) {
    return {
      message: "No hay una sesión de Majoriti para recuperar.",
      ok: false,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.setSession({
    access_token: guardada.access_token,
    refresh_token: guardada.refresh_token,
  });

  await borrarCookiesImpersonacion();

  if (error) {
    return {
      message:
        "La sesión de Majoriti ya no sirve. Entra de nuevo con tu correo.",
      ok: false,
    };
  }

  return { ok: true };
}
