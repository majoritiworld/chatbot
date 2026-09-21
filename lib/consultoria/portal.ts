import "server-only";

import { redirect } from "next/navigation";
import { rutaEntrevistaPermitida } from "@/lib/consultoria/destino-entrevista";
import { getUsuarioPerfil } from "@/lib/consultoria/entrevistas";
import {
  getEntrevistaIdByEmail,
  homePathForRol,
  isPortalRole,
  isStakeholderRole,
} from "@/lib/consultoria/roles";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

export type PortalUser = {
  email: string | null;
  id: string;
  nombre: string | null;
  proyectoId: string | null;
  rol: UserRole;
};

/**
 * Resolves the project for the current user. Clients carry it on their
 * `usuario` row; stakeholders are matched through their stakeholder email,
 * which is also how the RLS policies scope their rows.
 */
async function resolveProyectoId(
  rol: UserRole,
  perfilProyectoId: string | null | undefined,
  email: string | null | undefined
) {
  if (perfilProyectoId) {
    return perfilProyectoId;
  }

  if (!isStakeholderRole(rol) || !email) {
    return null;
  }

  const supabase = await createClient();
  const { data: stakeholder } = await supabase
    .from("stakeholder")
    .select("proyecto_id")
    .ilike("email", email)
    .maybeSingle();

  return stakeholder?.proyecto_id ?? null;
}

/** Where a signed-in user belongs right after auth, based on their role. */
export async function landingPathForCurrentUser(next?: string | null) {
  const context = await getUsuarioPerfil();

  if (!context?.user) {
    return "/login";
  }

  const { rol } = context;
  const explicito = rutaEntrevistaPermitida(next);
  if (explicito) {
    return explicito;
  }

  const supabase = await createClient();
  const entrevistaId = isStakeholderRole(rol)
    ? await getEntrevistaIdByEmail(supabase, context.user.email)
    : null;

  return homePathForRol(rol, entrevistaId);
}

/** Redirects anyone who is not a portal user. Never returns for those roles. */
export async function requirePortalUser(opciones?: {
  conProyecto?: boolean;
}): Promise<PortalUser> {
  const context = await getUsuarioPerfil();

  if (!context?.user) {
    redirect("/login?next=/portal");
  }

  const { user, perfil, rol } = context;

  if (rol === null) {
    redirect("/sin-acceso");
  }

  if (!isPortalRole(rol)) {
    redirect(rol === "majoriti" ? "/admin" : "/sin-acceso");
  }

  const proyectoId =
    opciones?.conProyecto === false
      ? (perfil?.proyecto_id ?? null)
      : await resolveProyectoId(rol, perfil?.proyecto_id, user.email);

  return {
    email: user.email ?? null,
    id: user.id,
    nombre: perfil?.nombre ?? null,
    proyectoId,
    rol,
  };
}
