import "server-only";

import type { User } from "@supabase/supabase-js";
import { nombreCompleto } from "@/lib/consultoria/nombre";
import type { RolPortal } from "@/lib/consultoria/roles";
import { createAdminClient } from "@/lib/supabase/admin";

/** Auth flags a duplicate signup with a code; older releases only set a message. */
const EMAIL_YA_EXISTE = /already (been )?registered|already exists/i;

/** `_` and `%` are ILIKE wildcards, and both appear in real addresses. */
export function patronEmail(email: string) {
  return email.replace(/[\\%_]/g, "\\$&");
}

export function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

function esEmailExistente(error: { code?: string; message: string }) {
  return error.code === "email_exists" || EMAIL_YA_EXISTE.test(error.message);
}

export type Invitacion = {
  nombre: string | null;
  proyectoId: string | null;
};

/**
 * Only emails Majoriti already added to a project (or existing portal users)
 * may request a sign-in code. Anyone else is told to contact Majoriti instead
 * of waiting for a mail that is never coming.
 */
export async function buscarInvitacion(
  email: string
): Promise<Invitacion | null> {
  const admin = createAdminClient();

  if (!admin) {
    return null;
  }

  const patron = patronEmail(email);
  const [{ data: usuario }, { data: stakeholder }] = await Promise.all([
    admin
      .from("usuario")
      .select("nombre, proyecto_id")
      .ilike("email", patron)
      .maybeSingle(),
    admin
      .from("stakeholder")
      .select("nombre, apellido, proyecto_id")
      .ilike("email", patron)
      .maybeSingle(),
  ]);

  if (!(usuario || stakeholder)) {
    return null;
  }

  return {
    nombre:
      usuario?.nombre ??
      (nombreCompleto(stakeholder?.nombre, stakeholder?.apellido) || null),
    proyectoId: usuario?.proyecto_id ?? stakeholder?.proyecto_id ?? null,
  };
}

/** Password login is only for Majoriti. Clients keep using the email code. */
export async function esCuentaMajoriti(email: string) {
  const admin = createAdminClient();

  if (!admin) {
    return false;
  }

  const { data } = await admin
    .from("usuario")
    .select("rol")
    .ilike("email", patronEmail(email))
    .maybeSingle();

  return data?.rol === "majoriti";
}

export type CuentaAsegurada =
  | { ok: true; userId: string | null; creada: boolean }
  | { ok: false };

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

async function confirmarAuthUser(admin: AdminClient, userId: string) {
  const { data: existente } = await admin.auth.admin.getUserById(userId);

  if (!existente.user || existente.user.email_confirmed_at) {
    return;
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  if (error) {
    console.error("No se pudo confirmar la cuenta de acceso", error.message);
  }
}

/**
 * Invites used to leave the account unconfirmed. Asking for a code then sent
 * Confirm signup (a link, no digits) instead of Magic Link with `{{ .Token }}`.
 * Confirm silently so OTP is a real code — also covers people added before
 * admin invites started confirming on the way in.
 */
async function confirmarCuentaParaCodigo(admin: AdminClient, email: string) {
  const { data: perfil } = await admin
    .from("usuario")
    .select("id")
    .ilike("email", patronEmail(email))
    .maybeSingle();

  if (!perfil) {
    return null;
  }

  await confirmarAuthUser(admin, perfil.id);
  return perfil.id;
}

/**
 * A stakeholder can exist without an Auth account, and `shouldCreateUser:false`
 * would then reject their code. Create the account up front — never touching
 * credentials of accounts that already exist.
 */
export async function ensureAuthUser({
  email,
  nombre,
}: {
  email: string;
  nombre?: string | null;
}): Promise<CuentaAsegurada> {
  const admin = createAdminClient();

  if (!admin) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY para preparar el acceso");
    return { ok: false };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    ...(nombre ? { user_metadata: { nombre } } : {}),
  });

  if (!error) {
    return { creada: true, ok: true, userId: data.user?.id ?? null };
  }

  if (esEmailExistente(error)) {
    const userId = await confirmarCuentaParaCodigo(admin, email);
    return { creada: false, ok: true, userId };
  }

  console.error("No se pudo preparar la cuenta de acceso", error.message);
  return { ok: false };
}

/**
 * `handle_new_user` creates the `usuario` row but cannot know the project, so a
 * fresh sign-in can land with a profile that has no `proyecto_id` — which reads
 * as "no tienes acceso". Fill the gaps from the stakeholder Majoriti invited.
 */
export async function ensureUsuarioPerfil(user: User) {
  const admin = createAdminClient();
  const email = user.email ? normalizarEmail(user.email) : null;

  if (!(admin && email)) {
    return;
  }

  const [{ data: stakeholder }, { data: perfil }] = await Promise.all([
    admin
      .from("stakeholder")
      .select("nombre, apellido, proyecto_id")
      .ilike("email", patronEmail(email))
      .maybeSingle(),
    admin
      .from("usuario")
      .select("id, nombre, proyecto_id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (!perfil) {
    const metadata = user.user_metadata as { nombre?: string } | null;
    const nombreStakeholder = nombreCompleto(
      stakeholder?.nombre,
      stakeholder?.apellido
    );
    const { error } = await admin.from("usuario").insert({
      email,
      id: user.id,
      nombre: nombreStakeholder || metadata?.nombre || null,
      proyecto_id: stakeholder?.proyecto_id ?? null,
    });

    if (error) {
      console.error("No se pudo crear el perfil del usuario", error.message);
    }

    return;
  }

  const parches: { nombre?: string; proyecto_id?: string } = {};

  if (!perfil.nombre && stakeholder) {
    const nombreStakeholder = nombreCompleto(
      stakeholder.nombre,
      stakeholder.apellido
    );
    if (nombreStakeholder) {
      parches.nombre = nombreStakeholder;
    }
  }

  if (!perfil.proyecto_id && stakeholder?.proyecto_id) {
    parches.proyecto_id = stakeholder.proyecto_id;
  }

  if (Object.keys(parches).length === 0) {
    return;
  }

  const { error } = await admin
    .from("usuario")
    .update(parches)
    .eq("id", user.id);

  if (error) {
    console.error("No se pudo completar el perfil del usuario", error.message);
  }
}

/**
 * Sets portal access (cliente vs stakeholder) on the `usuario` row. Never
 * touches Majoriti or comité accounts. `proyecto_id` is filled only when empty
 * so an invite cannot pull someone off another project.
 */
async function asignarAccesoPortal({
  email,
  proyectoId,
  rol,
  userId,
}: {
  email: string;
  proyectoId: string;
  rol: RolPortal;
  userId?: string | null;
}) {
  const admin = createAdminClient();

  if (!admin) {
    return;
  }

  const { data: perfil } = userId
    ? await admin
        .from("usuario")
        .select("id, rol, proyecto_id")
        .eq("id", userId)
        .maybeSingle()
    : await admin
        .from("usuario")
        .select("id, rol, proyecto_id")
        .ilike("email", patronEmail(email))
        .maybeSingle();

  if (!perfil) {
    return;
  }

  if (perfil.rol === "majoriti" || perfil.rol === "comite") {
    return;
  }

  const parches: { rol?: RolPortal; proyecto_id?: string } = {};

  if (perfil.rol !== rol) {
    parches.rol = rol;
  }

  if (!perfil.proyecto_id) {
    parches.proyecto_id = proyectoId;
  }

  if (Object.keys(parches).length === 0) {
    return;
  }

  const { error } = await admin
    .from("usuario")
    .update(parches)
    .eq("id", perfil.id);

  if (error) {
    console.error("No se pudo asignar el acceso del portal", error.message);
  }
}

/**
 * Prepares Auth + portal role without mailing. Interview mail is a separate
 * step so an existing account can receive a new assignment link unchanged.
 */
export async function asegurarAccesoPortal({
  email,
  nombre,
  proyectoId,
  rol = "stakeholder",
}: {
  email: string;
  nombre?: string | null;
  proyectoId: string;
  rol?: RolPortal;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const cuenta = await ensureAuthUser({ email, nombre });
  if (!cuenta.ok) {
    return {
      message: "No se pudo preparar el acceso al portal.",
      ok: false,
    };
  }

  await asignarAccesoPortal({
    email,
    proyectoId,
    rol,
    userId: cuenta.userId,
  });
  return { ok: true };
}

export type ResultadoRolPortal = { ok: true } | { ok: false; message: string };

/**
 * Changes cliente vs stakeholder on an existing portal account. Refuses
 * Majoriti and comité so this cannot be used to escalate privileges.
 */
export async function cambiarRolPortal({
  email,
  rol,
}: {
  email: string;
  rol: RolPortal;
}): Promise<ResultadoRolPortal> {
  const admin = createAdminClient();

  if (!admin) {
    return {
      message: "No se pudo actualizar el acceso al portal.",
      ok: false,
    };
  }

  const { data: perfil } = await admin
    .from("usuario")
    .select("id, rol")
    .ilike("email", patronEmail(normalizarEmail(email)))
    .maybeSingle();

  if (!perfil) {
    return {
      message:
        "Todavía no tiene cuenta. Envíale la entrevista para darle acceso y luego cambia el rol.",
      ok: false,
    };
  }

  if (perfil.rol === "majoriti" || perfil.rol === "comite") {
    return {
      message: "Esa cuenta no se puede cambiar desde aquí.",
      ok: false,
    };
  }

  if (perfil.rol === rol) {
    return { ok: true };
  }

  const { error } = await admin
    .from("usuario")
    .update({ rol })
    .eq("id", perfil.id);

  if (error) {
    return { message: error.message, ok: false };
  }

  return { ok: true };
}

export type ResultadoCuentaPortal =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Keeps the portal login in sync when Majoriti edits a person. Email has to
 * move on Auth first: `usuario.email` is what they type at /login.
 */
export async function actualizarCuentaPortal({
  emailActual,
  email,
  nombre,
}: {
  emailActual: string;
  email: string;
  nombre: string;
}): Promise<ResultadoCuentaPortal> {
  const admin = createAdminClient();

  if (!admin) {
    if (email === emailActual) {
      return { ok: true };
    }

    return {
      message: "No se pudo actualizar el correo de acceso al portal.",
      ok: false,
    };
  }

  const { data: perfil } = await admin
    .from("usuario")
    .select("id, rol, nombre")
    .ilike("email", patronEmail(emailActual))
    .maybeSingle();

  if (!perfil) {
    return { ok: true };
  }

  if (perfil.rol === "majoriti" || perfil.rol === "comite") {
    if (email === emailActual) {
      return { ok: true };
    }

    return {
      message: "Esa cuenta no se puede cambiar desde aquí.",
      ok: false,
    };
  }

  if (email !== emailActual) {
    const { data: ocupado } = await admin
      .from("usuario")
      .select("id")
      .ilike("email", patronEmail(email))
      .neq("id", perfil.id)
      .maybeSingle();

    if (ocupado) {
      return {
        message: "Ya hay una cuenta con ese correo",
        ok: false,
      };
    }

    const { error: authError } = await admin.auth.admin.updateUserById(
      perfil.id,
      {
        email,
        email_confirm: true,
        user_metadata: { nombre },
      }
    );

    if (authError) {
      return { message: authError.message, ok: false };
    }
  }

  const parches: { email?: string; nombre?: string } = {};

  if (email !== emailActual) {
    parches.email = email;
  }

  if (perfil.nombre !== nombre) {
    parches.nombre = nombre;
  }

  if (Object.keys(parches).length === 0) {
    return { ok: true };
  }

  const { error } = await admin
    .from("usuario")
    .update(parches)
    .eq("id", perfil.id);

  if (error) {
    return { message: error.message, ok: false };
  }

  return { ok: true };
}

export type ResultadoInvitacion = {
  enviado: boolean;
  message: string;
};

/**
 * Sends the one-click invite mail and confirms the account so a later code
 * request uses Magic Link, not Confirm signup. Failing to mail never loses
 * the stakeholder: they can always ask for a code at /login.
 */
export async function invitarAlPortal({
  email,
  nombre,
  proyectoId,
  rol = "stakeholder",
}: {
  email: string;
  nombre?: string | null;
  proyectoId: string;
  rol?: RolPortal;
}): Promise<ResultadoInvitacion> {
  const admin = createAdminClient();

  if (!admin) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY para invitar al portal");
    return {
      enviado: false,
      message:
        "Persona agregada. No pudimos enviar el correo de acceso: puede entrar pidiendo un código en el portal.",
    };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: nombre ? { nombre } : undefined,
    redirectTo: `${siteUrl()}/auth/callback`,
  });

  if (!error && data.user) {
    await confirmarAuthUser(admin, data.user.id);
    await ensureUsuarioPerfil(data.user);
    await asignarAccesoPortal({
      email,
      proyectoId,
      rol,
      userId: data.user.id,
    });
    return {
      enviado: true,
      message: `Invitado como ${rol}. Le enviamos un correo para entrar al portal.`,
    };
  }

  if (error && esEmailExistente(error)) {
    await ensureAuthUser({ email, nombre });
    await asignarAccesoPortal({ email, proyectoId, rol });
    return {
      enviado: false,
      message: `Agregado como ${rol}. Ya tenía cuenta: no sale correo nuevo. Avísale que entre al portal con su email.`,
    };
  }

  console.error("No se pudo invitar al portal", error?.message);
  return {
    enviado: false,
    message:
      "Agregado, pero el correo de invitación no salió. Puede entrar pidiendo un código en el portal.",
  };
}
