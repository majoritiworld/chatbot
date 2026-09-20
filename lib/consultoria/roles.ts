import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/supabase/types";

/** Access granted when Majoriti sends an interview. */
export type RolPortal = "cliente" | "stakeholder";

export const ROLES_PORTAL = ["cliente", "stakeholder"] as const;

export function isClienteRole(
  rol: UserRole | string | null | undefined
): rol is "cliente" {
  return rol === "cliente";
}

/** Invited respondents (firma socia, and later other limited-access guests). */
export function isStakeholderRole(
  rol: UserRole | string | null | undefined
): rol is "stakeholder" {
  return rol === "stakeholder";
}

export function isPortalRole(
  rol: UserRole | string | null | undefined
): rol is "cliente" | "stakeholder" {
  return isClienteRole(rol) || isStakeholderRole(rol);
}

/**
 * Home after auth. Stakeholders skip the phase timeline and go straight to
 * their interview; clients always land on the project portal — even if they
 * left mid-interview or on the post-submit screen.
 */
export function homePathForRol(
  rol: UserRole | string | null | undefined,
  entrevistaId?: string | null
) {
  if (isStakeholderRole(rol)) {
    return entrevistaId ? `/portal/entrevista/${entrevistaId}` : "/portal";
  }

  if (isClienteRole(rol)) {
    return "/portal";
  }

  return rol === "majoriti" ? "/admin" : "/sin-acceso";
}

export function stakeholderNeedsInterviewLanding(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/fase/")
  );
}

/**
 * Paths that must resolve the stakeholder's home interview to redirect.
 * Interview pages and API routes authorize the requested id instead.
 */
export function stakeholderPathNeedsLandingInterview(pathname: string) {
  return (
    isGenericChatPath(pathname) ||
    stakeholderNeedsInterviewLanding(pathname) ||
    pathname.startsWith("/admin")
  );
}

export function mismoEmail(
  izquierda: string | null | undefined,
  derecha: string | null | undefined
) {
  if (!(izquierda && derecha)) {
    return false;
  }

  return izquierda.trim().toLowerCase() === derecha.trim().toLowerCase();
}

/**
 * Leftover Chat SDK routes. Sending a message in the interview used to
 * `pushState` here; Next.js treats that as a real navigation.
 */
export function isGenericChatPath(pathname: string) {
  return (
    pathname === "/" || pathname === "/chat" || pathname.startsWith("/chat/")
  );
}

/**
 * Where to send someone right after signing in. Clients ignore `next` so a
 * leftover interview URL never dumps them back into chat or post-submit.
 */
export function resolveAuthLanding(
  rol: UserRole | string | null | undefined,
  next: string | null,
  home: string
) {
  if (
    isClienteRole(rol) ||
    !next ||
    isGenericChatPath(next) ||
    stakeholderNeedsInterviewLanding(next)
  ) {
    return home;
  }

  return next;
}

export type EntrevistaLandingFila = {
  estado: string;
  flujo_estado?: string | null;
  id: string;
  ultima_actividad?: string | null;
};

function actividadLanding(valor: string | null | undefined) {
  return valor ?? "";
}

/** Conversational states beat leftover review rows when choosing home. */
export function entrevistaAbiertaEnCurso(
  flujoEstado: string | null | undefined
) {
  return flujoEstado !== "revision";
}

/**
 * Home interview for a stakeholder with several rows: in-progress chat first,
 * then an undelivered review, then a completed one. Recency beats UUID order.
 */
export function elegirEntrevistaLanding(entrevistas: EntrevistaLandingFila[]) {
  if (entrevistas.length === 0) {
    return null;
  }

  const abiertas = entrevistas.filter((item) => item.estado !== "completada");
  const enCurso = abiertas.filter((item) =>
    entrevistaAbiertaEnCurso(item.flujo_estado)
  );
  let candidatas = entrevistas;
  if (enCurso.length > 0) {
    candidatas = enCurso;
  } else if (abiertas.length > 0) {
    candidatas = abiertas;
  }

  const ordenadas = [...candidatas].sort((izquierda, derecha) => {
    const porActividad = actividadLanding(
      derecha.ultima_actividad
    ).localeCompare(actividadLanding(izquierda.ultima_actividad));
    if (porActividad !== 0) {
      return porActividad;
    }
    return izquierda.id.localeCompare(derecha.id);
  });

  return ordenadas.at(0)?.id ?? null;
}

/** Own interview id for the signed-in email. Prefers one still in progress. */
export async function getEntrevistaIdByEmail(
  supabase: SupabaseClient,
  email: string | null | undefined
) {
  if (!email) {
    return null;
  }

  const { data: stakeholder } = await supabase
    .from("stakeholder")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (!stakeholder) {
    return null;
  }

  const { data: entrevistas } = await supabase
    .from("entrevista")
    .select("id, estado, flujo_estado, ultima_actividad")
    .eq("stakeholder_id", stakeholder.id);

  return elegirEntrevistaLanding(entrevistas ?? []);
}
