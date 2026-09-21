"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  buscarInvitacion,
  ensureAuthUser,
  ensureUsuarioPerfil,
  esCuentaMajoriti,
  normalizarEmail,
  siteUrl,
} from "@/lib/consultoria/auth";
import {
  emailRedirectToAuth,
  rutaEntrevistaPermitida,
} from "@/lib/consultoria/destino-entrevista";
import { landingPathForCurrentUser } from "@/lib/consultoria/portal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ERROR_GENERICO =
  "No pudimos enviarte el código. Intenta de nuevo o escribe a Majoriti.";

const emailSchema = z.object({
  email: z.string().email(),
});

const codigoSchema = z.object({
  codigo: z.string().regex(/^\d{8}$/),
  email: z.string().email(),
});

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ERROR_ADMIN_LOGIN = "Email o contraseña incorrectos.";

export type AuthActionState = {
  status: "idle" | "invalid_data" | "failed" | "sent";
  message?: string;
  /** Echoed back so the code step can address the user and allow a resend. */
  email?: string;
  next?: string;
};

function esLimiteDeEnvios(error: { status?: number; message: string }) {
  return (
    error.status === 429 || /rate limit|security purposes/i.test(error.message)
  );
}

/**
 * Step 1: mail an 8-digit sign-in code to an invited address.
 *
 * The Magic Link *and* Confirm signup templates in the Supabase dashboard
 * must contain `{{ .Token }}` and must not contain `{{ .ConfirmationURL }}`.
 * A link in that mail is prefetched by scanners, burns the OTP, and is what
 * users receive instead of the code. Invite leaves the account unconfirmed,
 * so the first code request used to send Confirm signup — paste that
 * template too. See supabase/email-templates/.
 *
 * Sent via the admin client so this request is not bound to PKCE cookies
 * from the browser that asked for the code.
 */
export async function solicitarCodigo(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
  });
  const next = rutaEntrevistaPermitida(String(formData.get("next") ?? ""));

  if (!parsed.success) {
    return {
      message: "Escribe un email válido",
      next: next ?? undefined,
      status: "invalid_data",
    };
  }

  const email = normalizarEmail(parsed.data.email);
  const invitacion = await buscarInvitacion(email);

  if (!invitacion) {
    return {
      email,
      message:
        "Este correo no está en el portal. Escribe a Majoriti para que te den acceso.",
      next: next ?? undefined,
      status: "failed",
    };
  }

  const cuenta = await ensureAuthUser({ email, nombre: invitacion.nombre });
  const admin = createAdminClient();

  if (!(cuenta.ok && admin)) {
    return {
      email,
      message: ERROR_GENERICO,
      next: next ?? undefined,
      status: "failed",
    };
  }

  const { error } = await admin.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: emailRedirectToAuth(siteUrl(), next),
      shouldCreateUser: false,
    },
  });

  if (error) {
    if (esLimiteDeEnvios(error)) {
      return {
        email,
        message:
          "Revisa tu correo (y spam): el código ya salió. Puedes pedir otro en un minuto.",
        next: next ?? undefined,
        status: "sent",
      };
    }

    return {
      email,
      message: ERROR_GENERICO,
      next: next ?? undefined,
      status: "failed",
    };
  }

  return { email, next: next ?? undefined, status: "sent" };
}

/** Step 2: exchange the code for a session and land on the right home. */
export async function verificarCodigo(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const emailRaw = String(formData.get("email") ?? "");
  const next = rutaEntrevistaPermitida(String(formData.get("next") ?? ""));
  const parsed = codigoSchema.safeParse({
    codigo: String(formData.get("codigo") ?? "").replace(/\D/g, ""),
    email: emailRaw,
  });

  if (!parsed.success) {
    return {
      email: normalizarEmail(emailRaw),
      message: "El código tiene 8 dígitos",
      next: next ?? undefined,
      status: "invalid_data",
    };
  }

  const email = normalizarEmail(parsed.data.email);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: parsed.data.codigo,
    type: "email",
  });

  if (error || !data.user) {
    return {
      email,
      message: "Ese código no es válido o ya venció. Pide uno nuevo.",
      next: next ?? undefined,
      status: "failed",
    };
  }

  await ensureUsuarioPerfil(data.user);

  redirect(await landingPathForCurrentUser(next));
}

/** Majoriti only. Clients cannot obtain a session through this form. */
export async function iniciarSesionAdmin(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { message: "Escribe email y contraseña", status: "invalid_data" };
  }

  const email = normalizarEmail(parsed.data.email);

  if (!(await esCuentaMajoriti(email))) {
    return { email, message: ERROR_ADMIN_LOGIN, status: "failed" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { email, message: ERROR_ADMIN_LOGIN, status: "failed" };
  }

  await ensureUsuarioPerfil(data.user);
  redirect("/admin");
}
