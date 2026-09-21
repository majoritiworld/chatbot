import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { ensureUsuarioPerfil } from "@/lib/consultoria/auth";
import { rutaEntrevistaPermitida } from "@/lib/consultoria/destino-entrevista";
import {
  getEntrevistaIdByEmail,
  homePathForRol,
  isStakeholderRole,
  resolveAuthLanding,
} from "@/lib/consultoria/roles";

/** Types Supabase can send us through an invite or sign-in mail. */
const TIPOS_EMAIL = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

function tipoEmail(value: string | null): EmailOtpType | null {
  return value && TIPOS_EMAIL.has(value as EmailOtpType)
    ? (value as EmailOtpType)
    : null;
}

async function landingForUser(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  email: string | null | undefined,
  next: string | null
) {
  const { data: perfil } = await supabase
    .from("usuario")
    .select("rol")
    .eq("id", userId)
    .maybeSingle();

  const explicito = rutaEntrevistaPermitida(next);
  const entrevistaId =
    explicito || !isStakeholderRole(perfil?.rol)
      ? null
      : await getEntrevistaIdByEmail(supabase, email);

  return resolveAuthLanding(
    perfil?.rol,
    next,
    homePathForRol(perfil?.rol, entrevistaId)
  );
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = tipoEmail(searchParams.get("type"));
  const next = rutaEntrevistaPermitida(searchParams.get("next"));

  const destino = (path: string) => new URL(`${base}${path}`, origin);

  // Whatever happens, the user lands on a screen that can get them in: the
  // login form asks for a code instead of telling them to create an account.
  const loginErrorUrl = destino("/login?error=auth");
  if (next) {
    loginErrorUrl.searchParams.set("next", next);
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!(supabaseUrl && supabaseAnonKey)) {
    return NextResponse.redirect(loginErrorUrl);
  }

  // Build the redirect first so the auth cookies are written onto it.
  let response = NextResponse.redirect(destino(next ?? "/portal"));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.redirect(destino(next ?? "/portal"));
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  async function finishAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(loginErrorUrl);
    }

    // An invite mail is often the first time we see this account: make sure the
    // profile carries the project before we decide where they belong.
    await ensureUsuarioPerfil(user);

    const landing = await landingForUser(supabase, user.id, user.email, next);
    const redirected = NextResponse.redirect(destino(landing));

    for (const cookie of response.cookies.getAll()) {
      redirected.cookies.set(cookie);
    }

    return redirected;
  }

  // Hashed tokens work across devices. They are single-use: expired or
  // scanner-consumed links must recover through OTP with the same destination.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return finishAuth();
    }

    console.error("auth callback verifyOtp failed");
    return NextResponse.redirect(loginErrorUrl);
  }

  // Fallback for older PKCE links, which only work in the browser that started
  // the flow.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return finishAuth();
    }

    console.error("auth callback code exchange failed");
    return NextResponse.redirect(loginErrorUrl);
  }

  return NextResponse.redirect(loginErrorUrl);
}
