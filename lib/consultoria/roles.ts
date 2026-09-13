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
 * their interview; clients land on the project portal.
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
    .select("id, estado")
    .eq("stakeholder_id", stakeholder.id)
    .order("id");

  if (!entrevistas || entrevistas.length === 0) {
    return null;
  }

  const abierta = entrevistas.find((item) => item.estado !== "completada");
  return (abierta ?? entrevistas.at(0))?.id ?? null;
}
