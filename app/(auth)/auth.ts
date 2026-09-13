import type { UserRole } from "@/lib/supabase/types";
import { getUsuarioPerfil } from "@/lib/consultoria/entrevistas";

/** Kept for template entitlements compatibility. Authenticated users are "regular". */
export type UserType = "guest" | "regular";

export type AppSession = {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    type: UserType;
    /** Null until Majoriti assigns a profile; treated as no access. */
    role: UserRole | null;
  };
};

export async function auth(): Promise<AppSession | null> {
  const context = await getUsuarioPerfil();
  if (!context?.user) {
    return null;
  }

  return {
    user: {
      id: context.user.id,
      email: context.user.email,
      name: context.perfil?.nombre ?? context.user.email ?? null,
      type: "regular",
      role: context.rol,
    },
  };
}

export async function signOut() {
  const { borrarCookiesImpersonacion } = await import(
    "@/lib/consultoria/impersonar"
  );
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.auth.signOut();
  await borrarCookiesImpersonacion();
}
