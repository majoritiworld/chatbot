import { slugValido } from "@/lib/consultoria/marca";

/** Only same-origin interview URLs may travel in `next`. UUID version 1–8. */
const ENTREVISTA_DESTINO =
  /^\/portal\/entrevista\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function pathEntrevista(entrevistaId: string) {
  return `/portal/entrevista/${entrevistaId}`;
}

/**
 * Invitation and login `next` values: interview path only. Rejects open
 * redirects, protocol-relative URLs, encoded slashes, and leftover chat routes.
 */
export function rutaEntrevistaPermitida(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const recortado = value.trim();
  if (
    !recortado.startsWith("/") ||
    recortado.startsWith("//") ||
    recortado.includes("\\") ||
    recortado.includes("://") ||
    recortado.includes("%")
  ) {
    return null;
  }

  const path = recortado.split("?")[0]?.split("#")[0] ?? "";
  if (!ENTREVISTA_DESTINO.test(path)) {
    return null;
  }

  return path;
}

export function destinoSesionEnLogin(next: string | null, home: string) {
  return rutaEntrevistaPermitida(next) ?? home;
}

export function emailRedirectToAuth(
  site: string,
  next: string | null,
  proyecto?: string | null
) {
  const origen = site.replace(/\/$/, "");
  const callback = `${origen}/auth/callback`;
  const params = new URLSearchParams();
  const destino = rutaEntrevistaPermitida(next);
  const slug = slugValido(proyecto);
  if (destino) {
    params.set("next", destino);
  }
  if (slug) {
    params.set("proyecto", slug);
  }
  const consulta = params.toString();
  return consulta.length > 0 ? `${callback}?${consulta}` : callback;
}

export function enlaceCallbackEntrevista({
  hashedToken,
  site,
  type,
  entrevistaId,
}: {
  hashedToken: string;
  site: string;
  type: string;
  entrevistaId: string;
}) {
  const destino = rutaEntrevistaPermitida(pathEntrevista(entrevistaId));
  const origen = site.replace(/\/$/, "");
  const params = new URLSearchParams({
    token_hash: hashedToken,
    type,
  });
  if (destino) {
    params.set("next", destino);
  }

  return `${origen}/auth/callback?${params.toString()}`;
}

export function enlaceLoginEntrevista(site: string, entrevistaId: string) {
  const destino = rutaEntrevistaPermitida(pathEntrevista(entrevistaId));
  const origen = site.replace(/\/$/, "");
  if (!destino) {
    return `${origen}/login`;
  }

  return `${origen}/login?next=${encodeURIComponent(destino)}`;
}

export function enlacePortal(site: string) {
  return site.replace(/\/$/, "");
}

export type AsignacionInvitacion = {
  entrevistaId: string;
  email: string;
  nombre: string | null;
};

export type ResultadoInvitacionEntrevista =
  | { creada: boolean; ok: true }
  | { message: string; ok: false };

/**
 * Prepares the account for an assigned interview. Does not send mail and
 * does not create another interview.
 */
export async function ejecutarInvitacionEntrevista({
  entrevistaId,
  cargarAsignacion,
  asegurarCuenta,
}: {
  entrevistaId: string;
  cargarAsignacion: (id: string) => Promise<AsignacionInvitacion | null>;
  asegurarCuenta: (args: {
    email: string;
    nombre: string | null;
  }) => Promise<{ creada: boolean; ok: true } | { ok: false }>;
}): Promise<ResultadoInvitacionEntrevista> {
  const asignacion = await cargarAsignacion(entrevistaId);
  if (!asignacion) {
    return {
      message: "Esa entrevista no existe.",
      ok: false,
    };
  }

  const cuenta = await asegurarCuenta({
    email: asignacion.email,
    nombre: asignacion.nombre,
  });
  if (!cuenta.ok) {
    return {
      message: "No se pudo preparar el acceso a la entrevista.",
      ok: false,
    };
  }

  return { creada: cuenta.creada, ok: true };
}
