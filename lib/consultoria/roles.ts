import type { SupabaseClient } from "@supabase/supabase-js";
import { rutaEntrevistaPermitida } from "@/lib/consultoria/destino-entrevista";
import { normalizarEstado } from "@/lib/consultoria/fase-estado";
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
 * their interview; clients always land on the project portal — even if they
 * left mid-interview or on the post-submit screen.
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

/**
 * Paths that must resolve the stakeholder's home interview to redirect.
 * Interview pages and API routes authorize the requested id instead.
 */
export function stakeholderPathNeedsLandingInterview(pathname: string) {
  return (
    isGenericChatPath(pathname) ||
    stakeholderNeedsInterviewLanding(pathname) ||
    pathname.startsWith("/admin")
  );
}

export function mismoEmail(
  izquierda: string | null | undefined,
  derecha: string | null | undefined
) {
  if (!(izquierda && derecha)) {
    return false;
  }

  return izquierda.trim().toLowerCase() === derecha.trim().toLowerCase();
}

/**
 * Leftover Chat SDK routes. Sending a message in the interview used to
 * `pushState` here; Next.js treats that as a real navigation.
 */
export function isGenericChatPath(pathname: string) {
  return (
    pathname === "/" || pathname === "/chat" || pathname.startsWith("/chat/")
  );
}

/**
 * Where to send someone right after signing in. An explicit interview path
 * wins; anything else uses the role home.
 */
export function resolveAuthLanding(
  _rol: UserRole | string | null | undefined,
  next: string | null,
  home: string
) {
  return rutaEntrevistaPermitida(next) ?? home;
}

export type EntrevistaLandingFila = {
  estado: string;
  faseDisponible?: boolean;
  flujo_estado?: string | null;
  id: string;
  ordenFase?: number | null;
  ultima_actividad?: string | null;
};

function actividadLanding(valor: string | null | undefined) {
  return valor ?? "";
}

/** Conversational states beat leftover review rows when choosing home. */
export function entrevistaAbiertaEnCurso(
  flujoEstado: string | null | undefined
) {
  return flujoEstado !== "revision";
}

function entrevistasDeLaFaseMasNueva(entrevistas: EntrevistaLandingFila[]) {
  const ordenes = entrevistas.flatMap((item) =>
    typeof item.ordenFase === "number" ? [item.ordenFase] : []
  );
  if (ordenes.length === 0) {
    return entrevistas;
  }
  const maxima = Math.max(...ordenes);
  return entrevistas.filter((item) => item.ordenFase === maxima);
}

/**
 * Home interview among the ones assigned to this person whose phase is open.
 * A blocked or not-yet-enabled phase does not take the link, even if its
 * order is higher. Among the available ones, the highest phase order wins
 * over a more recently used earlier interview. Within that phase: in-progress
 * chat first, then an undelivered review, then a completed one.
 */
export function elegirEntrevistaLanding(entrevistas: EntrevistaLandingFila[]) {
  const disponibles = entrevistas.filter(
    (item) => item.faseDisponible !== false
  );
  if (disponibles.length === 0) {
    return null;
  }

  const deLaFase = entrevistasDeLaFaseMasNueva(disponibles);
  const abiertas = deLaFase.filter((item) => item.estado !== "completada");
  const enCurso = abiertas.filter((item) =>
    entrevistaAbiertaEnCurso(item.flujo_estado)
  );
  let candidatas = deLaFase;
  if (enCurso.length > 0) {
    candidatas = enCurso;
  } else if (abiertas.length > 0) {
    candidatas = abiertas;
  }

  const ordenadas = [...candidatas].sort((izquierda, derecha) => {
    const porActividad = actividadLanding(
      derecha.ultima_actividad
    ).localeCompare(actividadLanding(izquierda.ultima_actividad));
    if (porActividad !== 0) {
      return porActividad;
    }
    return izquierda.id.localeCompare(derecha.id);
  });

  return ordenadas.at(0)?.id ?? null;
}

/**
 * Own interview id for the signed-in email. With a project, only that
 * project's interview. Without one, a single membership keeps the previous
 * landing; several memberships do not pick a project.
 */
/**
 * True when this interview is the email-only assignment of this address.
 * A personal-link phase does not count.
 */
export async function asignacionTieneAccesoSoloCorreo(
  supabase: SupabaseClient,
  entrevistaId: string,
  email: string | null | undefined
) {
  if (!email) {
    return false;
  }

  const { data } = await supabase
    .from("entrevista")
    .select(
      "stakeholder:stakeholder_id ( email ), tarea ( tipo, fase:fase_id ( acceso_solo_correo ) )"
    )
    .eq("id", entrevistaId)
    .maybeSingle();

  if (!data) {
    return false;
  }

  const fila = data as {
    stakeholder:
      | { email: string | null }
      | Array<{ email: string | null }>
      | null;
    tarea:
      | Array<{
          fase:
            | { acceso_solo_correo: boolean | null }
            | Array<{ acceso_solo_correo: boolean | null }>
            | null;
          tipo: string | null;
        }>
      | {
          fase:
            | { acceso_solo_correo: boolean | null }
            | Array<{ acceso_solo_correo: boolean | null }>
            | null;
          tipo: string | null;
        }
      | null;
  };
  const stakeholder = primerObjeto(fila.stakeholder);
  if (!mismoEmail(stakeholder?.email, email)) {
    return false;
  }

  let tareas: Array<{
    fase:
      | { acceso_solo_correo: boolean | null }
      | Array<{ acceso_solo_correo: boolean | null }>
      | null;
    tipo: string | null;
  }> = [];
  if (Array.isArray(fila.tarea)) {
    tareas = fila.tarea;
  } else if (fila.tarea) {
    tareas = [fila.tarea];
  }
  for (const tarea of tareas) {
    if (tarea.tipo !== "entrevista") {
      continue;
    }
    const fase = primerObjeto(tarea.fase);
    if (fase?.acceso_solo_correo === true) {
      return true;
    }
  }
  return false;
}

export async function getEntrevistaIdByEmail(
  supabase: SupabaseClient,
  email: string | null | undefined,
  proyectoId?: string | null
) {
  if (!email) {
    return null;
  }

  let consulta = supabase
    .from("stakeholder")
    .select("id, proyecto_id")
    .ilike("email", email);
  if (proyectoId) {
    consulta = consulta.eq("proyecto_id", proyectoId);
  }
  const { data: stakeholders } = await consulta;
  const filas = stakeholders ?? [];
  if (filas.length === 0) {
    return null;
  }
  if (!proyectoId && filas.length > 1) {
    return null;
  }
  const stakeholder = filas.at(0);
  if (!stakeholder) {
    return null;
  }

  const { data: entrevistas } = await supabase
    .from("entrevista")
    .select(
      "id, estado, flujo_estado, ultima_actividad, plantilla:plantilla_id(fase:fase_id(orden, estado))"
    )
    .eq("stakeholder_id", stakeholder.id)
    .order("id");

  return elegirEntrevistaLanding(
    (entrevistas ?? []).map((fila) => {
      const fase = faseDePlantilla(fila.plantilla);
      return {
        estado: fila.estado,
        faseDisponible: fase.disponible,
        flujo_estado: fila.flujo_estado,
        id: fila.id,
        ordenFase: fase.orden,
        ultima_actividad: fila.ultima_actividad,
      };
    })
  );
}

function primerObjeto<T>(valor: T | T[] | null | undefined) {
  if (Array.isArray(valor)) {
    return valor.at(0) ?? null;
  }
  return valor ?? null;
}

function faseDePlantilla(plantilla: unknown) {
  const fila = primerObjeto(
    plantilla as {
      fase?:
        | { estado?: string | null; orden?: number }
        | Array<{ estado?: string | null; orden?: number }>
        | null;
    } | null
  );
  const fase = primerObjeto(fila?.fase);
  const orden = typeof fase?.orden === "number" ? fase.orden : null;
  const estado = typeof fase?.estado === "string" ? fase.estado : null;
  return {
    disponible: estado === null || normalizarEstado(estado) !== "bloqueado",
    orden,
  };
}
