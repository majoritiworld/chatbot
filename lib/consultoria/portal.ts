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
  const { data: stakeholders } = await supabase
    .from("stakeholder")
    .select("proyecto_id")
    .ilike("email", email);
  const filas = stakeholders ?? [];
  if (filas.length === 1) {
    return filas.at(0)?.proyecto_id ?? null;
  }
  return null;
}

/** Where a signed-in user belongs. A project link stays inside that project. */
export async function landingPathForCurrentUser(
  next?: string | null,
  proyectoId?: string | null
) {
  const context = await getUsuarioPerfil();

  if (!context?.user) {
    return "/login";
  }

  const { rol } = context;
  const explicito = rutaEntrevistaPermitida(next);
  const supabase = await createClient();

  if (proyectoId) {
    if (explicito && context.user.email) {
      const destinoId = explicito.split("/").at(-1);
      const { data: stakeholders } = await supabase
        .from("stakeholder")
        .select("id")
        .eq("proyecto_id", proyectoId)
        .ilike("email", context.user.email);
      const stakeholderId = stakeholders?.at(0)?.id;
      if (destinoId && stakeholderId) {
        const { data: propia } = await supabase
          .from("entrevista")
          .select("id")
          .eq("id", destinoId)
          .eq("stakeholder_id", stakeholderId)
          .maybeSingle();
        if (propia) {
          return explicito;
        }
      }
    }

    const entrevistaId = await getEntrevistaIdByEmail(
      supabase,
      context.user.email,
      proyectoId
    );
    if (entrevistaId) {
      return `/portal/entrevista/${entrevistaId}`;
    }
    return homePathForRol(rol, null);
  }

  if (explicito) {
    return explicito;
  }

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
