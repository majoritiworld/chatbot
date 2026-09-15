import "server-only";

import { patronEmail } from "@/lib/consultoria/auth";
import {
  clonarSecciones,
  type SeccionEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import { normalizarEstado } from "@/lib/consultoria/fase-estado";
import { createClient } from "@/lib/supabase/server";
import { generateUUID } from "@/lib/utils";

/** People paste numbered or bulleted lists; the prompt numbers them again. */
const VINETA = /^\s*(?:[-*•]|\d+[.)])\s*/;

/** One question per line, so the admin can paste a list as it comes. */
export function preguntasDesdeTexto(raw: string): string[] {
  return raw
    .split("\n")
    .map((linea) => linea.replace(VINETA, "").trim())
    .filter((linea) => linea.length > 0);
}

export type FaseObjetivo = {
  id: string;
  nombre: string;
  estado: string;
};

/** Ids arrive from a form, so the phase has to be confirmed inside the project. */
export async function getFaseDelProyecto(
  proyectoId: string,
  faseId: string
): Promise<FaseObjetivo | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fase")
    .select("id, nombre, estado")
    .eq("id", faseId)
    .eq("proyecto_id", proyectoId)
    .maybeSingle();

  return data ?? null;
}

/**
 * A blocked phase renders locked in the portal, so assigning an interview to
 * one has to open it. A completed phase is left alone: it is not a regression
 * of the timeline, and the admin can reopen it from the phase list.
 */
async function abrirFase(fase: FaseObjetivo) {
  if (normalizarEstado(fase.estado) !== "bloqueado") {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("fase")
    .update({ estado: "en_progreso" })
    .eq("id", fase.id);

  if (error) {
    // The phase list shows the real state and offers "Desbloquear", so this is
    // recoverable without losing the interview we just created.
    console.error("No se pudo abrir la fase", error.message);
  }
}

export type StakeholderExistente = {
  id: string;
  nombre: string;
  firma: string | null;
};

export async function buscarStakeholderEnProyecto(
  proyectoId: string,
  email: string
): Promise<StakeholderExistente | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stakeholder")
    .select("id, nombre, firma")
    .eq("proyecto_id", proyectoId)
    .ilike("email", patronEmail(email))
    .maybeSingle();

  return data ?? null;
}

async function stakeholderTieneEntrevista(stakeholderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entrevista")
    .select("id")
    .eq("stakeholder_id", stakeholderId)
    .limit(1)
    .maybeSingle();

  return data !== null;
}

export type ResultadoEntrevista =
  | { ok: true; entrevistaId: string }
  | { ok: false; message: string };

/**
 * The portal reaches an interview through `fase → tarea → entrevista`. Both
 * rows have to land, or the stakeholder signs in to a phase that says it has
 * no interview assigned.
 */
export async function crearEntrevistaConTarea({
  stakeholderId,
  responsable,
  fase,
  preguntas,
  secciones,
  plantillaId,
}: {
  stakeholderId: string;
  responsable: string;
  fase: FaseObjetivo;
  preguntas: string[];
  secciones?: SeccionEntrevista[];
  plantillaId?: string | null;
}): Promise<ResultadoEntrevista> {
  const supabase = await createClient();
  const seccionesAsignadas = clonarSecciones(
    secciones && secciones.length > 0
      ? secciones
      : [
          {
            descripcion: "",
            id: generateUUID(),
            preguntas,
            titulo: "Entrevista",
          },
        ]
  );

  const { data: entrevista, error: entrevistaError } = await supabase
    .from("entrevista")
    .insert({
      estado: "abierta",
      plantilla_id: plantillaId ?? null,
      preguntas,
      secciones: seccionesAsignadas,
      stakeholder_id: stakeholderId,
    })
    .select("id")
    .single();

  if (entrevistaError || !entrevista) {
    return {
      message: entrevistaError?.message ?? "No se pudo crear la entrevista",
      ok: false,
    };
  }

  const { error: tareaError } = await supabase.from("tarea").insert({
    entrevista_id: entrevista.id,
    fase_id: fase.id,
    responsable,
    tipo: "entrevista",
  });

  if (tareaError) {
    // An interview with no tarea is unreachable from the portal and hides the
    // "Asignar entrevista" form in admin: roll it back so a retry is possible.
    await supabase.from("entrevista").delete().eq("id", entrevista.id);
    return { message: tareaError.message, ok: false };
  }

  await abrirFase(fase);
  return { entrevistaId: entrevista.id, ok: true };
}

export type ResultadoProvisionPlantilla =
  | { ok: true; status: "creado" | "asignado"; stakeholderId: string }
  | { ok: false; status: "omitido" | "error"; message: string };

/**
 * Creates the person if needed, then clones the template into their own
 * interview. People who already have one are skipped: the portal still shows
 * a single entrevista per stakeholder.
 */
export async function provisionarDestinatarioPlantilla({
  proyectoId,
  email,
  nombre,
  firma,
  fase,
  preguntas,
  secciones,
  plantillaId,
}: {
  proyectoId: string;
  email: string;
  nombre: string;
  firma: string | null;
  fase: FaseObjetivo;
  preguntas: string[];
  secciones: SeccionEntrevista[];
  plantillaId: string;
}): Promise<ResultadoProvisionPlantilla> {
  const existente = await buscarStakeholderEnProyecto(proyectoId, email);

  if (existente) {
    if (await stakeholderTieneEntrevista(existente.id)) {
      return {
        message: "Ya tiene una entrevista en este proyecto",
        ok: false,
        status: "omitido",
      };
    }

    if (firma && !existente.firma) {
      const supabase = await createClient();
      await supabase
        .from("stakeholder")
        .update({ firma })
        .eq("id", existente.id);
    }

    const entrevista = await crearEntrevistaConTarea({
      fase,
      plantillaId,
      preguntas,
      responsable: existente.nombre,
      secciones,
      stakeholderId: existente.id,
    });

    if (!entrevista.ok) {
      return { message: entrevista.message, ok: false, status: "error" };
    }

    return {
      ok: true,
      stakeholderId: existente.id,
      status: "asignado",
    };
  }

  const supabase = await createClient();
  const { data: stakeholder, error } = await supabase
    .from("stakeholder")
    .insert({
      email,
      estado_entrevista: "pendiente",
      firma,
      nombre,
      proyecto_id: proyectoId,
    })
    .select("id")
    .single();

  if (error || !stakeholder) {
    return {
      message: error?.message ?? "No se pudo crear el stakeholder",
      ok: false,
      status: "error",
    };
  }

  const entrevista = await crearEntrevistaConTarea({
    fase,
    plantillaId,
    preguntas,
    responsable: nombre,
    secciones,
    stakeholderId: stakeholder.id,
  });

  if (!entrevista.ok) {
    return { message: entrevista.message, ok: false, status: "error" };
  }

  return { ok: true, stakeholderId: stakeholder.id, status: "creado" };
}

export type ResultadoFase =
  | { ok: true; estado: string }
  | { ok: false; message: string };

export async function crearFaseEnProyecto({
  proyectoId,
  nombre,
  fechaEstimada,
}: {
  proyectoId: string;
  nombre: string;
  fechaEstimada: string | null;
}): Promise<ResultadoFase> {
  const supabase = await createClient();

  const { data: ultima } = await supabase
    .from("fase")
    .select("orden")
    .eq("proyecto_id", proyectoId)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  // The first phase opens on creation: a project whose only phase is blocked
  // leaves the client with nothing to do.
  const estado = ultima ? "bloqueado" : "en_progreso";

  const { error } = await supabase.from("fase").insert({
    estado,
    fecha_estimada: fechaEstimada,
    nombre,
    orden: (ultima?.orden ?? 0) + 1,
    proyecto_id: proyectoId,
  });

  if (error) {
    return { message: error.message, ok: false };
  }

  return { estado, ok: true };
}
