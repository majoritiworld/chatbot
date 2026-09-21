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

export function emailRedirectToAuth(site: string, next: string | null) {
  const origen = site.replace(/\/$/, "");
  const callback = `${origen}/auth/callback`;
  const destino = rutaEntrevistaPermitida(next);
  if (!destino) {
    return callback;
  }

  return `${callback}?next=${encodeURIComponent(destino)}`;
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
  | { creada: boolean; enviado: true; ok: true }
  | { message: string; ok: false };

/**
 * Sends access to an already assigned interview. Never creates another row or
 * changes portal role — those belong to account provisioning.
 */
export async function ejecutarInvitacionEntrevista({
  entrevistaId,
  cargarAsignacion,
  asegurarCuenta,
  enviarCorreo,
}: {
  entrevistaId: string;
  cargarAsignacion: (id: string) => Promise<AsignacionInvitacion | null>;
  asegurarCuenta: (args: {
    email: string;
    nombre: string | null;
  }) => Promise<{ creada: boolean; ok: true } | { ok: false }>;
  enviarCorreo: (args: {
    email: string;
    entrevistaId: string;
    nombre: string | null;
  }) => Promise<void>;
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

  await enviarCorreo({
    email: asignacion.email,
    entrevistaId: asignacion.entrevistaId,
    nombre: asignacion.nombre,
  });

  return { creada: cuenta.creada, enviado: true, ok: true };
}
