import "server-only";

import { siteUrl } from "@/lib/consultoria/auth";
import {
  evaluarAsignacionCorreo,
  type FilaFaseCorreo,
  type FilaProyectoCorreo,
  type ResultadoAsignacionCorreo,
} from "@/lib/consultoria/correos/asignacion";
import type { TipoCorreo } from "@/lib/consultoria/correos/variantes";
import { createAdminClient } from "@/lib/supabase/admin";

const COLUMNAS_FASE =
  "proyecto_id, bloque_comercial, bloque_comercial_etiqueta, bloque_comercial_url, correo_asunto, correo_cuerpo, correo_firma, correo_remitente, minutos";

const COLUMNAS_PROYECTO =
  "id, cliente, nombre_publico, slug, logo_path, color_principal, titulo_iniciativa, contacto_email, contacto_nombre, correo_asunto, correo_cuerpo, correo_firma, correo_remitente";

/** Invitation copy and access mode live in columns added by later migrations. */
const COLUMNAS_INVITACION = "invitacion_asunto, invitacion_cuerpo";
const COLUMNAS_INVITACION_FASE = `${COLUMNAS_INVITACION}, acceso_enlace_personal`;

type FilaTextosInvitacion = {
  acceso_enlace_personal?: boolean | null;
  invitacion_asunto?: string | null;
  invitacion_cuerpo?: string | null;
};

function primero<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) {
    return valor.at(0) ?? null;
  }
  return valor ?? null;
}

/** Only localhost off Vercel may use plain http links and images. */
export function permitirOrigenLocal() {
  return process.env.VERCEL !== "1";
}

type FilaStakeholder = {
  apellido: string | null;
  email: string | null;
  nombre: string | null;
  proyecto_id: string | null;
};

type FilaPlantilla = {
  fase: (FilaFaseCorreo & { id: string }) | null;
  proyecto_id: string | null;
};

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

async function textosInvitacion(
  admin: Admin,
  proyectoId: string,
  faseId: string | null
) {
  const proyecto = await admin
    .from("proyecto")
    .select(COLUMNAS_INVITACION)
    .eq("id", proyectoId)
    .maybeSingle();
  if (proyecto.error) {
    throw new Error(
      "Faltan los textos de invitación en la base. Aplica la migración correspondiente."
    );
  }
  if (!faseId) {
    return { fase: null, proyecto: proyecto.data as FilaTextosInvitacion };
  }
  const fase = await admin
    .from("fase")
    .select(COLUMNAS_INVITACION_FASE)
    .eq("id", faseId)
    .maybeSingle();
  if (fase.error) {
    throw new Error(
      "Faltan los textos de invitación en la base. Aplica la migración correspondiente."
    );
  }
  return {
    fase: fase.data as FilaTextosInvitacion,
    proyecto: proyecto.data as FilaTextosInvitacion,
  };
}

/** Project-level invitation copy for the admin form; null before the migration. */
export async function textosInvitacionDeProyecto(proyectoId: string) {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }
  try {
    const { proyecto } = await textosInvitacion(admin, proyectoId, null);
    return {
      asunto: proyecto?.invitacion_asunto ?? null,
      cuerpo: proyecto?.invitacion_cuerpo ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * A real project and phase with a fictitious participant, for previews.
 * Read only. `faltaMigracion` is true when invitation copy cannot be read yet.
 */
export async function filasDeProyectoParaVistaPrevia(
  proyectoId: string,
  faseId: string | null
) {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }
  const [proyecto, fases] = await Promise.all([
    admin
      .from("proyecto")
      .select(COLUMNAS_PROYECTO)
      .eq("id", proyectoId)
      .maybeSingle(),
    admin
      .from("fase")
      .select(`id, nombre, orden, ${COLUMNAS_FASE}`)
      .eq("proyecto_id", proyectoId)
      .order("orden"),
  ]);
  if (proyecto.error || !proyecto.data || fases.error) {
    return null;
  }
  const listaFases = (fases.data ?? []) as Array<
    FilaFaseCorreo & { id: string; nombre: string }
  >;
  const fase =
    listaFases.find((fila) => fila.id === faseId) ?? listaFases.at(0) ?? null;

  let faltaMigracion = false;
  let textos: Awaited<ReturnType<typeof textosInvitacion>> = {
    fase: null,
    proyecto: {},
  };
  try {
    textos = await textosInvitacion(admin, proyectoId, fase?.id ?? null);
  } catch {
    faltaMigracion = true;
  }

  const filaProyecto = proyecto.data as FilaProyectoCorreo;
  return {
    faltaMigracion,
    faseId: fase?.id ?? null,
    fases: listaFases.map((fila) => ({ id: fila.id, nombre: fila.nombre })),
    filas: {
      entrevistaId: "00000000-0000-4000-8000-000000000000",
      fase: fase ? { ...fase, ...textos.fase } : null,
      plantillaProyectoId: proyectoId,
      proyecto: { ...filaProyecto, ...textos.proyecto },
      stakeholder: {
        apellido: "Ejemplo",
        email: "participante.ejemplo@example.com",
        nombre: "Participante",
        proyecto_id: proyectoId,
      },
    },
    nombre: filaProyecto.nombre_publico ?? filaProyecto.cliente ?? "Proyecto",
  };
}

/**
 * Loads recipient, client and copy from the interview itself. Callers pass an
 * id, never an address or a brand.
 */
export async function resolverAsignacionCorreo(
  entrevistaId: string,
  tipo: TipoCorreo,
  emailEsperado?: string | null
): Promise<ResultadoAsignacionCorreo> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("El servidor no puede leer la entrevista");
  }

  const { data: entrevista, error } = await admin
    .from("entrevista")
    .select(
      `id, stakeholder:stakeholder_id(email, nombre, apellido, proyecto_id), plantilla:plantilla_id(proyecto_id, fase:fase_id(id, nombre, ${COLUMNAS_FASE}))`
    )
    .eq("id", entrevistaId)
    .maybeSingle();
  if (error) {
    throw new Error("No se pudo leer la entrevista");
  }
  if (!entrevista) {
    return { motivo: "sin_entrevista", ok: false };
  }

  const stakeholder = primero(
    entrevista.stakeholder as unknown as
      | FilaStakeholder
      | FilaStakeholder[]
      | null
  );
  const plantilla = primero(
    entrevista.plantilla as unknown as FilaPlantilla | FilaPlantilla[] | null
  );
  const fase = primero(plantilla?.fase);
  const proyectoId = stakeholder?.proyecto_id ?? null;

  let proyecto: FilaProyectoCorreo | null = null;
  if (proyectoId) {
    const lectura = await admin
      .from("proyecto")
      .select(COLUMNAS_PROYECTO)
      .eq("id", proyectoId)
      .maybeSingle();
    if (lectura.error) {
      throw new Error("No se pudo leer el proyecto de la entrevista");
    }
    proyecto = lectura.data as FilaProyectoCorreo | null;
  }

  let faseConTextos: FilaFaseCorreo | null = fase;
  if (tipo === "invitacion" && proyecto) {
    const extra = await textosInvitacion(admin, proyecto.id, fase?.id ?? null);
    proyecto = { ...proyecto, ...extra.proyecto };
    faseConTextos = fase ? { ...fase, ...extra.fase } : null;
  }

  return evaluarAsignacionCorreo(
    {
      entrevistaId: entrevista.id,
      fase: faseConTextos,
      plantillaProyectoId: plantilla?.proyecto_id ?? null,
      proyecto,
      stakeholder,
    },
    {
      emailEsperado,
      permitirLocal: permitirOrigenLocal(),
      site: siteUrl(),
    }
  );
}
