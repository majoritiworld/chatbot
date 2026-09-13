import "server-only";

import { redirect } from "next/navigation";
import { getUsuarioPerfil } from "@/lib/consultoria/entrevistas";
import { landingPathForCurrentUser } from "@/lib/consultoria/portal";
import type { UserRole } from "@/lib/supabase/types";

export type AdminUser = {
  id: string;
  email: string | null;
  nombre: string | null;
};

export function isAdminRole(rol: UserRole) {
  return rol === "majoriti";
}

/** Redirects anyone who is not Majoriti. Never returns for those roles. */
export async function requireAdminUser(): Promise<AdminUser> {
  const context = await getUsuarioPerfil();

  if (!context?.user) {
    redirect("/login/admin?next=/admin");
  }

  const { user, perfil, rol } = context;

  if (rol === null) {
    redirect("/sin-acceso");
  }

  if (!isAdminRole(rol)) {
    redirect(await landingPathForCurrentUser());
  }

  return {
    email: user.email ?? null,
    id: user.id,
    nombre: perfil?.nombre ?? null,
  };
}
