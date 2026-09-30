import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { normalizarEmail } from "@/lib/consultoria/auth";
import { slugValido } from "@/lib/consultoria/marca";
import {
  COOKIE_ENTREVISTA,
  decidirEntradaEnlace,
  decidirEntradaSoloCorreo,
  empaquetarSesionEntrevista,
  hashTokenEnlace,
  leerSesionEntrevistaValor,
  MENSAJE_SESION_AJENA,
  MENSAJE_SOLO_CORREO_SIN_ACCESO,
  opcionesCookieEntrevista,
  type SesionEntrevista,
  sesionPortalPermiteEntrar,
} from "@/lib/consultoria/sesion-entrevista";
import {
  cifrarSecreto,
  descifrarSecreto,
} from "@/lib/consultoria/token-cifrado";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Uno<T> = T | T[] | null | undefined;

type FilaEntrevistaAcceso = {
  stakeholder: Uno<{
    email: string | null;
    proyecto: Uno<{ slug: string | null }>;
    proyecto_id: string | null;
  }>;
  tarea: Uno<{
    fase: Uno<{
      acceso_enlace_personal: boolean | null;
      acceso_solo_correo: boolean | null;
      id: string;
      proyecto_id: string | null;
    }>;
    tipo: string | null;
  }>;
};

type FilaEnlace = {
  entrevista: Uno<FilaEntrevistaAcceso>;
  entrevista_id: string;
  revocado_en: string | null;
  token_hash: string;
};

const SELECT_ENTREVISTA_ACCESO = `
  stakeholder:stakeholder_id ( email, proyecto_id, proyecto:proyecto_id ( slug ) ),
  tarea ( tipo, fase:fase_id ( id, proyecto_id, acceso_enlace_personal, acceso_solo_correo ) )
`;

const SELECT_ENLACE = `
  entrevista_id,
  token_hash,
  revocado_en,
  entrevista:entrevista_id ( ${SELECT_ENTREVISTA_ACCESO} )
`;

function uno<T>(valor: Uno<T>): T | null {
  if (Array.isArray(valor)) {
    return valor.at(0) ?? null;
  }
  return valor ?? null;
}

function lista<T>(valor: Uno<T>): T[] {
  if (Array.isArray(valor)) {
    return valor;
  }
  return valor ? [valor] : [];
}

function describirEntrevista(fila: FilaEntrevistaAcceso | null) {
  const stakeholder = uno(fila?.stakeholder);
  const fases = lista(fila?.tarea)
    .filter((tarea) => tarea.tipo === "entrevista")
    .map((tarea) => uno(tarea.fase))
    .filter(
      (fase): fase is NonNullable<typeof fase> =>
        fase !== null && fase.proyecto_id === stakeholder?.proyecto_id
    );
  return {
    email: stakeholder?.email ? normalizarEmail(stakeholder.email) : "",
    fases,
    slug: slugValido(uno(stakeholder?.proyecto)?.slug ?? null),
  };
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

async function sesionEnlaceVigente(
  admin: Admin,
  sesion: Extract<SesionEntrevista, { via: "enlace" }>
) {
  const { data, error } = await admin
    .from("entrevista_enlace")
    .select(SELECT_ENLACE)
    .eq("entrevista_id", sesion.entrevistaId)
    .maybeSingle();
  if (error || !data) {
    return false;
  }
  const fila = data as unknown as FilaEnlace;
  const entrevista = describirEntrevista(uno(fila.entrevista));
  return (
    decidirEntradaEnlace({
      encontrado: fila.token_hash === sesion.enlace,
      faseHabilitada: entrevista.fases.some(
        (fase) => fase.acceso_enlace_personal === true
      ),
      revocado: Boolean(fila.revocado_en),
    }).ok && entrevista.email === sesion.email
  );
}

async function sesionCorreoVigente(
  admin: Admin,
  sesion: Extract<SesionEntrevista, { via: "correo" }>
) {
  const { data, error } = await admin
    .from("entrevista")
    .select(SELECT_ENTREVISTA_ACCESO)
    .eq("id", sesion.entrevistaId)
    .maybeSingle();
  if (error || !data) {
    return false;
  }
  const entrevista = describirEntrevista(
    data as unknown as FilaEntrevistaAcceso
  );
  return (
    entrevista.email === sesion.email &&
    entrevista.fases.some(
      (fase) => fase.id === sesion.faseId && fase.acceso_solo_correo === true
    )
  );
}

/**
 * The interview cookie, confirmed against the database on every request. It
 * opens one interview and never carries a role.
 */
export const leerSesionEntrevista = cache(
  async (): Promise<SesionEntrevista | null> => {
    const jar = await cookies();
    const sesion = leerSesionEntrevistaValor(jar.get(COOKIE_ENTREVISTA)?.value);
    const admin = sesion ? createAdminClient() : null;
    if (!(sesion && admin)) {
      return null;
    }
    const vigente =
      sesion.via === "enlace"
        ? await sesionEnlaceVigente(admin, sesion)
        : await sesionCorreoVigente(admin, sesion);
    return vigente ? sesion : null;
  }
);

export async function borrarSesionEntrevista() {
  const jar = await cookies();
  jar.delete(COOKIE_ENTREVISTA);
}

async function emailSesionPortal() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

/** A portal session or an interview cookie of someone else is never replaced. */
async function hayOtraPersonaConectada(email: string) {
  if (!sesionPortalPermiteEntrar(await emailSesionPortal(), email)) {
    return true;
  }
  const previa = await leerSesionEntrevista();
  return !sesionPortalPermiteEntrar(previa?.email, email);
}

async function abrirSesionEntrevista(sesion: SesionEntrevista) {
  const jar = await cookies();
  jar.set(
    COOKIE_ENTREVISTA,
    empaquetarSesionEntrevista(sesion),
    opcionesCookieEntrevista()
  );
}

function secretoCifrado() {
  return process.env.AUTH_SECRET ?? "";
}

/** Reuses the active link; a revoked one is replaced by a new token. */
export async function asegurarEnlaceEntrevista(entrevistaId: string) {
  const admin = createAdminClient();
  const secreto = secretoCifrado();
  if (!(admin && secreto)) {
    return null;
  }
  const { data: existente } = await admin
    .from("entrevista_enlace")
    .select("token_cifrado, revocado_en")
    .eq("entrevista_id", entrevistaId)
    .maybeSingle();
  if (existente && !existente.revocado_en) {
    return descifrarSecreto(existente.token_cifrado, secreto);
  }
  const token = randomBytes(32).toString("base64url");
  const { error } = await admin.from("entrevista_enlace").upsert(
    {
      entrevista_id: entrevistaId,
      revocado_en: null,
      token_cifrado: cifrarSecreto(token, secreto),
      token_hash: hashTokenEnlace(token),
    },
    { onConflict: "entrevista_id" }
  );
  if (error) {
    throw error;
  }
  return token;
}

export async function revocarEnlaceEntrevista(entrevistaId: string) {
  const admin = createAdminClient();
  if (!admin) {
    return false;
  }
  const { error } = await admin
    .from("entrevista_enlace")
    .update({ revocado_en: new Date().toISOString() })
    .eq("entrevista_id", entrevistaId);
  return !error;
}

export type ResultadoEntrada =
  | { ok: true; entrevistaId: string }
  | {
      ok: false;
      motivo: "no_disponible" | "sesion_ajena";
      slug: string | null;
    };

/**
 * Opens the interview from the personal link, with no email or code. The token
 * is not consumed, so a mail scanner that follows the link does not spend it.
 */
export async function entrarConEnlace(
  token: string
): Promise<ResultadoEntrada> {
  const admin = createAdminClient();
  const limpio = token.trim();
  if (!(admin && limpio)) {
    return { motivo: "no_disponible", ok: false, slug: null };
  }
  const hash = hashTokenEnlace(limpio);
  const { data, error } = await admin
    .from("entrevista_enlace")
    .select(SELECT_ENLACE)
    .eq("token_hash", hash)
    .maybeSingle();
  if (error || !data) {
    return { motivo: "no_disponible", ok: false, slug: null };
  }
  const fila = data as unknown as FilaEnlace;
  const entrevista = describirEntrevista(uno(fila.entrevista));
  const decision = decidirEntradaEnlace({
    encontrado: Boolean(entrevista.email),
    faseHabilitada: entrevista.fases.some(
      (fase) => fase.acceso_enlace_personal === true
    ),
    revocado: Boolean(fila.revocado_en),
  });
  if (!decision.ok) {
    return { motivo: "no_disponible", ok: false, slug: entrevista.slug };
  }
  if (await hayOtraPersonaConectada(entrevista.email)) {
    return { motivo: "sesion_ajena", ok: false, slug: entrevista.slug };
  }
  await abrirSesionEntrevista({
    email: entrevista.email,
    enlace: hash,
    entrevistaId: fila.entrevista_id,
    via: "enlace",
  });
  return { entrevistaId: fila.entrevista_id, ok: true };
}

/** False as well before the migration adds the setting. */
export async function proyectoTieneAccesoSoloCorreo(proyectoId: string) {
  const admin = createAdminClient();
  if (!admin) {
    return false;
  }
  const { count, error } = await admin
    .from("fase")
    .select("id", { count: "exact", head: true })
    .eq("proyecto_id", proyectoId)
    .eq("acceso_solo_correo", true);
  return !error && (count ?? 0) > 0;
}

export type ResultadoSoloCorreo =
  | { ok: true; entrevistaId: string }
  | { ok: false; mensaje: string; sesionAjena?: true };

/**
 * Email-only entry, for phases with `acceso_solo_correo`. Knowing the assigned
 * email is enough by explicit decision; nothing is created and no mail leaves.
 */
export async function entrarSoloConCorreo({
  correo,
  slug,
}: {
  correo: string;
  slug: string;
}): Promise<ResultadoSoloCorreo> {
  const admin = createAdminClient();
  const email = normalizarEmail(correo);
  const proyecto = slugValido(slug);
  if (!(admin && email && proyecto)) {
    return { mensaje: MENSAJE_SOLO_CORREO_SIN_ACCESO, ok: false };
  }
  const { data, error } = await admin.rpc("entrevistas_acceso_solo_correo", {
    p_email: email,
    p_slug: proyecto,
  });
  if (error) {
    return { mensaje: MENSAJE_SOLO_CORREO_SIN_ACCESO, ok: false };
  }
  const decision = decidirEntradaSoloCorreo(
    (data ?? []) as Array<{ entrevista_id: string; fase_id: string }>
  );
  if (!decision.ok) {
    return decision;
  }
  if (await hayOtraPersonaConectada(email)) {
    return { mensaje: MENSAJE_SESION_AJENA, ok: false, sesionAjena: true };
  }
  await abrirSesionEntrevista({
    email,
    entrevistaId: decision.entrevistaId,
    faseId: decision.faseId,
    via: "correo",
  });
  return { entrevistaId: decision.entrevistaId, ok: true };
}
