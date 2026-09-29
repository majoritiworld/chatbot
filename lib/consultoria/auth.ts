import "server-only";

import type { EmailOtpType, User } from "@supabase/supabase-js";
import { z } from "zod";
import { proyectoUnicoLegacy } from "@/lib/consultoria/acceso-proyecto";
import { nombreCompleto } from "@/lib/consultoria/nombre";
import type { RolPortal } from "@/lib/consultoria/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
  /** Project allows email-only sign-in. Never true for Majoriti accounts. */
  accesoDirecto: boolean;
  esMajoriti: boolean;
  nombre: string | null;
  proyectoId: string | null;
};

export type BusquedaInvitacion =
  | { estado: "ausente" }
  | { estado: "encontrada"; invitacion: Invitacion }
  | { estado: "varios" };

/**
 * A project link only matches that project. Without a link, one existing
 * membership keeps the previous login. Several memberships do not choose one.
 * Majoriti keeps the password login; a project link never treats that account
 * as a participant.
 */
export async function buscarInvitacion(
  email: string,
  proyectoId?: string | null
): Promise<BusquedaInvitacion> {
  const admin = createAdminClient();

  if (!admin) {
    return { estado: "ausente" };
  }

  const patron = patronEmail(email);
  const { data: usuario } = await admin
    .from("usuario")
    .select("nombre, proyecto_id, rol")
    .ilike("email", patron)
    .maybeSingle();
  const esMajoriti = usuario?.rol === "majoriti";

  if (proyectoId) {
    if (esMajoriti) {
      return { estado: "ausente" };
    }
    return await invitacionEnProyecto(
      admin,
      email,
      proyectoId,
      usuario?.nombre ?? null
    );
  }

  if (esMajoriti) {
    return {
      estado: "encontrada",
      invitacion: {
        accesoDirecto: false,
        esMajoriti: true,
        nombre: usuario?.nombre ?? null,
        proyectoId: usuario?.proyecto_id ?? null,
      },
    };
  }

  const { data: accesos } = await admin
    .from("proyecto_acceso")
    .select("proyecto_id")
    .eq("email", email);
  const ids = (accesos ?? []).map((fila) => fila.proyecto_id);
  const unico = proyectoUnicoLegacy(ids);
  if (unico) {
    return await invitacionEnProyecto(
      admin,
      email,
      unico,
      usuario?.nombre ?? null
    );
  }
  if (ids.length > 1) {
    return { estado: "varios" };
  }

  const { data: stakeholders } = await admin
    .from("stakeholder")
    .select("nombre, apellido, proyecto_id")
    .ilike("email", patron);
  const proyectos = (stakeholders ?? []).map((fila) => fila.proyecto_id);
  if (usuario?.proyecto_id) {
    proyectos.push(usuario.proyecto_id);
  }
  const legado = proyectoUnicoLegacy(proyectos);
  if (!legado) {
    return proyectos.length > 1 ? { estado: "varios" } : { estado: "ausente" };
  }

  const stakeholder = (stakeholders ?? []).find(
    (fila) => fila.proyecto_id === legado
  );
  return {
    estado: "encontrada",
    invitacion: {
      accesoDirecto: await proyectoTieneAccesoDirecto(admin, legado),
      esMajoriti: false,
      nombre:
        usuario?.nombre ??
        (nombreCompleto(stakeholder?.nombre, stakeholder?.apellido) || null),
      proyectoId: legado,
    },
  };
}

async function invitacionEnProyecto(
  admin: AdminClient,
  email: string,
  proyectoId: string,
  nombreUsuario: string | null
): Promise<BusquedaInvitacion> {
  const [{ data: acceso }, { data: stakeholder }] = await Promise.all([
    admin
      .from("proyecto_acceso")
      .select("proyecto_id")
      .eq("proyecto_id", proyectoId)
      .eq("email", email)
      .maybeSingle(),
    admin
      .from("stakeholder")
      .select("nombre, apellido")
      .eq("proyecto_id", proyectoId)
      .ilike("email", patronEmail(email))
      .maybeSingle(),
  ]);

  if (!(acceso || stakeholder)) {
    return { estado: "ausente" };
  }

  return {
    estado: "encontrada",
    invitacion: {
      accesoDirecto: await proyectoTieneAccesoDirecto(admin, proyectoId),
      esMajoriti: false,
      nombre:
        nombreUsuario ??
        (nombreCompleto(stakeholder?.nombre, stakeholder?.apellido) || null),
      proyectoId,
    },
  };
}

async function proyectoTieneAccesoDirecto(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  proyectoId: string | null
) {
  if (!proyectoId) {
    return false;
  }

  const { data } = await admin
    .from("proyecto")
    .select("acceso_directo")
    .eq("id", proyectoId)
    .maybeSingle();

  return data?.acceso_directo === true;
}

const propiedadesEnlace = z.object({
  hashed_token: z.string().min(1).optional(),
  hashedToken: z.string().min(1).optional(),
  verification_type: z.string().optional(),
  verificationType: z.string().optional(),
});

function tipoOtp(value: string | undefined): EmailOtpType {
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

/**
 * Opens a session for an invited email without mailing a code. The caller
 * decides which projects may use this.
 */
export async function abrirSesionPorCorreo(
  email: string
): Promise<{ ok: true; user: User } | { ok: false }> {
  const admin = createAdminClient();

  if (!admin) {
    return { ok: false };
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    email,
    type: "magiclink",
  });
  const properties = propiedadesEnlace.safeParse(link?.properties);
  const hashedToken = properties.success
    ? (properties.data.hashed_token ?? properties.data.hashedToken)
    : undefined;
  const verificationType = properties.success
    ? (properties.data.verification_type ?? properties.data.verificationType)
    : undefined;

  if (linkError || !hashedToken) {
    return { ok: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: hashedToken,
    type: tipoOtp(verificationType),
  });

  if (error || !data.user) {
    return { ok: false };
  }

  return { ok: true, user: data.user };
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

  const [{ data: stakeholders }, { data: perfil }] = await Promise.all([
    admin
      .from("stakeholder")
      .select("nombre, apellido, proyecto_id")
      .ilike("email", patronEmail(email)),
    admin
      .from("usuario")
      .select("id, nombre, proyecto_id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  const lista = stakeholders ?? [];
  const proyectoUnico = proyectoUnicoLegacy(
    lista.map((fila) => fila.proyecto_id)
  );
  const stakeholder =
    lista.find((fila) => fila.proyecto_id === perfil?.proyecto_id) ??
    (lista.length === 1 ? lista.at(0) : null);

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
      proyecto_id: proyectoUnico,
    });

    if (error) {
      console.error("No se pudo crear el perfil del usuario", error.message);
    }

    return;
  }

  const parches: { nombre?: string; proyecto_id?: string } = {};

  if (!perfil.nombre && lista.length > 0) {
    const conNombre = stakeholder ?? lista.at(0);
    const nombreStakeholder = nombreCompleto(
      conNombre?.nombre,
      conNombre?.apellido
    );
    if (nombreStakeholder) {
      parches.nombre = nombreStakeholder;
    }
  }

  if (!perfil.proyecto_id && proyectoUnico) {
    parches.proyecto_id = proyectoUnico;
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
 * Records permission for this project. The profile keeps its home
 * `proyecto_id` and role once set, so a second project cannot move them.
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

  const { error: accesoError } = await admin.from("proyecto_acceso").upsert(
    {
      email: normalizarEmail(email),
      proyecto_id: proyectoId,
      rol,
      usuario_id: perfil.id,
    },
    { onConflict: "proyecto_id,email" }
  );

  if (accesoError) {
    console.error(
      "No se pudo registrar el acceso al proyecto",
      accesoError.message
    );
  }

  const parches: { rol?: RolPortal; proyecto_id?: string } = {};
  const esProyectoDePerfil =
    !perfil.proyecto_id || perfil.proyecto_id === proyectoId;

  if (esProyectoDePerfil && perfil.rol !== rol) {
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
  proyectoId,
  rol,
}: {
  email: string;
  proyectoId?: string;
  rol: RolPortal;
}): Promise<ResultadoRolPortal> {
  const admin = createAdminClient();

  if (!admin) {
    return {
      message: "No se pudo actualizar el acceso al portal.",
      ok: false,
    };
  }

  const emailNormalizado = normalizarEmail(email);
  const { data: perfil } = await admin
    .from("usuario")
    .select("id, rol, proyecto_id")
    .ilike("email", patronEmail(emailNormalizado))
    .maybeSingle();

  if (!perfil) {
    return {
      message:
        "Todavía no tiene cuenta. Prepara el acceso desde el proyecto y luego cambia el rol.",
      ok: false,
    };
  }

  if (proyectoId) {
    const { error: accesoError } = await admin.from("proyecto_acceso").upsert(
      {
        email: emailNormalizado,
        proyecto_id: proyectoId,
        rol,
        usuario_id: perfil.id,
      },
      { onConflict: "proyecto_id,email" }
    );
    if (accesoError) {
      return { message: accesoError.message, ok: false };
    }
  }

  const actualizarRolGlobal =
    !proyectoId || !perfil.proyecto_id || perfil.proyecto_id === proyectoId;
  if (!actualizarRolGlobal) {
    return { ok: true };
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
 * Prepares the portal account for this project and does not send mail.
 * The client shares the project link from their own inbox.
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
  const acceso = await asegurarAccesoPortal({
    email,
    nombre,
    proyectoId,
    rol,
  });

  if (!acceso.ok) {
    return {
      enviado: false,
      message:
        "Persona agregada. No pudimos preparar el acceso: inténtalo de nuevo.",
    };
  }

  return {
    enviado: false,
    message:
      "Acceso preparado, sin correo de invitación. Comparte el enlace del proyecto.",
  };
}
