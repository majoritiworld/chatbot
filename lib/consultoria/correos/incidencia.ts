import "server-only";

import { nombreCompleto } from "@/lib/consultoria/nombre";
import { createAdminClient } from "@/lib/supabase/admin";

/** Postgres and PostgREST codes for a table the migration has not added yet. */
const TABLA_AUSENTE = new Set(["42P01", "PGRST205"]);

/**
 * Admin-facing note on why an interview mail was not sent; null clears it.
 * Best effort: a missing table or a failed write never affects the interview.
 */
export async function registrarIncidenciaCorreo(
  entrevistaId: string,
  mensaje: string | null
) {
  const admin = createAdminClient();
  if (!admin) {
    return;
  }
  const tabla = admin.from("entrevista_correo_incidencia");
  const { error } = mensaje
    ? await tabla.upsert({
        en: new Date().toISOString(),
        entrevista_id: entrevistaId,
        mensaje,
      })
    : await tabla.delete().eq("entrevista_id", entrevistaId);
  if (error && !TABLA_AUSENTE.has(error.code)) {
    console.error("No se pudo registrar la incidencia del correo", {
      entrevistaId,
      mensaje,
    });
  }
}

export type IncidenciaCorreo = {
  en: string;
  entrevistaId: string;
  mensaje: string;
  persona: string;
};

type FilaIncidencia = {
  en: string;
  entrevista: {
    stakeholder: {
      apellido: string | null;
      email: string | null;
      nombre: string | null;
    } | null;
  } | null;
  entrevista_id: string;
  mensaje: string;
};

/** Null when the table is not there yet or the server cannot read it. */
export async function listarIncidenciasCorreo(
  proyectoId: string
): Promise<IncidenciaCorreo[] | null> {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }
  const { data, error } = await admin
    .from("entrevista_correo_incidencia")
    .select(
      "entrevista_id, mensaje, en, entrevista:entrevista_id!inner(stakeholder:stakeholder_id!inner(nombre, apellido, email, proyecto_id))"
    )
    .eq("entrevista.stakeholder.proyecto_id", proyectoId)
    .order("en", { ascending: false });
  if (error) {
    return null;
  }
  return ((data ?? []) as unknown as FilaIncidencia[]).map((fila) => {
    const stakeholder = fila.entrevista?.stakeholder;
    return {
      en: fila.en,
      entrevistaId: fila.entrevista_id,
      mensaje: fila.mensaje,
      persona:
        nombreCompleto(stakeholder?.nombre, stakeholder?.apellido) ||
        stakeholder?.email ||
        "Sin nombre",
    };
  });
}
