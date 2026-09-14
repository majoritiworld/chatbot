import "server-only";

import {
  fusionarTurnos,
  parsePreguntas,
  parseTranscripcion,
  type ResumenEntrevista,
  type TurnoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import { createClient } from "@/lib/supabase/server";
import type { Entrevista, UserRole } from "@/lib/supabase/types";

const ENTREVISTA_SELECT = `
  id,
  stakeholder_id,
  preguntas,
  estado,
  fecha_completada,
  consentimiento_en,
  stakeholder:stakeholder_id ( id, nombre, firma, email )
`;

type StakeholderEmbed = {
  id: string;
  nombre: string;
  firma: string | null;
  email: string;
} | null;

type EntrevistaRow = {
  id: string;
  stakeholder_id: string;
  preguntas: unknown;
  estado: string;
  fecha_completada: string | null;
  consentimiento_en: string | null;
  stakeholder?: StakeholderEmbed | StakeholderEmbed[];
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function toEntrevista(row: EntrevistaRow): Entrevista {
  const stakeholder = asOne(row.stakeholder);
  return {
    consentimiento_en: row.consentimiento_en,
    estado: row.estado,
    fecha_completada: row.fecha_completada,
    id: row.id,
    preguntas: parsePreguntas(row.preguntas),
    stakeholder_firma: stakeholder?.firma ?? null,
    stakeholder_id: row.stakeholder_id,
    stakeholder_nombre: stakeholder?.nombre ?? null,
  };
}

export async function getUsuarioPerfil() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: perfil } = await supabase
    .from("usuario")
    .select("id, nombre, email, rol, proyecto_id")
    .eq("id", user.id)
    .maybeSingle();

  // No profile row means no role: assuming one would hand out portal access to
  // an account nobody invited.
  return {
    perfil,
    rol: (perfil?.rol ?? null) as UserRole | null,
    user,
  };
}

/** Stakeholder row matching the signed-in email, if any. */
export async function getOwnStakeholderId(email: string | null | undefined) {
  if (!email) {
    return null;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("stakeholder")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * True when the current user is the interviewed stakeholder. Clients see
 * progress in the portal; they do not answer on someone else's behalf.
 * Majoriti uses impersonation to enter as that stakeholder.
 */
export async function canWriteEntrevista(entrevista: Entrevista) {
  const context = await getUsuarioPerfil();
  if (!context) {
    return false;
  }

  const ownId = await getOwnStakeholderId(context.user.email);
  return ownId !== null && entrevista.stakeholder_id === ownId;
}

export async function resolveEntrevista(
  entrevistaId?: string | null
): Promise<Entrevista | null> {
  const supabase = await createClient();
  const context = await getUsuarioPerfil();

  if (!context) {
    return null;
  }

  const { user } = context;

  // RLS decides whether this id is actually reachable for the caller.
  if (entrevistaId) {
    const { data } = await supabase
      .from("entrevista")
      .select(ENTREVISTA_SELECT)
      .eq("id", entrevistaId)
      .maybeSingle();

    if (data) {
      return toEntrevista(data as EntrevistaRow);
    }
  }

  const ownId = await getOwnStakeholderId(user.email);
  if (!ownId) {
    return null;
  }

  const { data } = await supabase
    .from("entrevista")
    .select(ENTREVISTA_SELECT)
    .eq("stakeholder_id", ownId)
    .order("id")
    .limit(1)
    .maybeSingle();

  return data ? toEntrevista(data as EntrevistaRow) : null;
}

/** Turns stored so far, used to rehydrate the chat on reload. */
export async function getTranscripcionEntrevista(
  entrevistaId: string
): Promise<TurnoEntrevista[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("entrevista")
    .select("transcripcion")
    .eq("id", entrevistaId)
    .maybeSingle();

  return parseTranscripcion(data?.transcripcion);
}

/**
 * Appends the turns of one exchange and stamps the activity clock. The admin
 * table reads `ultima_actividad` to flag stakeholders who went quiet.
 */
export async function registrarTurnosEntrevista({
  entrevistaId,
  turnos,
}: {
  entrevistaId: string;
  turnos: TurnoEntrevista[];
}) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("entrevista")
    .select("transcripcion, stakeholder_id")
    .eq("id", entrevistaId)
    .maybeSingle();

  const transcripcion = fusionarTurnos(
    parseTranscripcion(data?.transcripcion),
    turnos
  );

  const { error } = await supabase
    .from("entrevista")
    .update({
      transcripcion,
      ultima_actividad: new Date().toISOString(),
    })
    .eq("id", entrevistaId);

  if (error) {
    // Losing a transcript write must not break the interview in progress.
    console.error("No se pudo guardar la transcripción", error);
    return;
  }

  if (data?.stakeholder_id) {
    await marcarEntrevistaEnCurso(data.stakeholder_id);
  }
}

/**
 * Pendiente → en_curso so the portal shows "Continuar" instead of a
 * still-untouched interview. Completada is left alone.
 */
async function marcarEntrevistaEnCurso(stakeholderId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("stakeholder")
    .update({ estado_entrevista: "en_curso" })
    .eq("id", stakeholderId)
    .eq("estado_entrevista", "pendiente");

  if (error) {
    console.error("No se pudo marcar la entrevista en curso", error);
  }
}

export async function guardarRespuestasEntrevista({
  entrevistaId,
  respuestas,
  resumen,
}: {
  entrevistaId: string;
  respuestas: Array<{ pregunta: string; respuesta_texto: string }>;
  resumen: ResumenEntrevista;
}) {
  const supabase = await createClient();

  if (respuestas.length > 0) {
    const { error: insertError } = await supabase.from("respuesta").insert(
      respuestas.map((item) => ({
        entrevista_id: entrevistaId,
        pregunta: item.pregunta,
        respuesta_texto: item.respuesta_texto,
      }))
    );

    if (insertError) {
      throw insertError;
    }
  }

  // Kept as a row for auditability; `entrevista.resumen` holds the full object.
  const { error: resumenError } = await supabase.from("respuesta").insert({
    entrevista_id: entrevistaId,
    pregunta: "__resumen__",
    respuesta_texto: resumen.sintesis,
  });

  if (resumenError) {
    throw resumenError;
  }

  const ahora = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("entrevista")
    .update({
      estado: "completada",
      fecha_completada: ahora,
      resumen,
      ultima_actividad: ahora,
    })
    .eq("id", entrevistaId);

  if (updateError) {
    throw updateError;
  }

  const { data: entrevista } = await supabase
    .from("entrevista")
    .select("stakeholder_id")
    .eq("id", entrevistaId)
    .maybeSingle();

  if (entrevista?.stakeholder_id) {
    await supabase
      .from("stakeholder")
      .update({ estado_entrevista: "completada" })
      .eq("id", entrevista.stakeholder_id);
  }
}

/**
 * User paused mid-interview: flush the latest turns and leave the row abierta
 * so they can pick it up another day.
 */
export async function guardarProgresoEntrevista({
  entrevistaId,
  turnos,
}: {
  entrevistaId: string;
  turnos: TurnoEntrevista[];
}) {
  const entrevista = await resolveEntrevista(entrevistaId);

  if (!entrevista) {
    throw new Error("Entrevista no encontrada");
  }

  if (!(await canWriteEntrevista(entrevista))) {
    throw new Error("No puedes guardar esta entrevista");
  }

  if (entrevista.estado === "completada") {
    return { alreadyDone: true as const };
  }

  if (entrevista.estado !== "abierta") {
    throw new Error("La entrevista no se puede guardar");
  }

  if (turnos.length > 0) {
    await registrarTurnosEntrevista({ entrevistaId, turnos });
    return { alreadyDone: false as const };
  }

  const supabase = await createClient();
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("entrevista")
    .update({ ultima_actividad: ahora })
    .eq("id", entrevistaId);

  if (error) {
    throw error;
  }

  await marcarEntrevistaEnCurso(entrevista.stakeholder_id);
  return { alreadyDone: false as const };
}

/**
 * User-initiated close: flush the latest turns into `transcripcion`, then mark
 * the interview (and stakeholder) as completada so portal + admin both show done.
 */
export async function finalizarEntrevistaManual({
  entrevistaId,
  turnos,
}: {
  entrevistaId: string;
  turnos: TurnoEntrevista[];
}) {
  const entrevista = await resolveEntrevista(entrevistaId);

  if (!entrevista) {
    throw new Error("Entrevista no encontrada");
  }

  if (!(await canWriteEntrevista(entrevista))) {
    throw new Error("No puedes finalizar esta entrevista");
  }

  if (entrevista.estado === "completada") {
    return { alreadyDone: true as const };
  }

  if (entrevista.estado !== "abierta") {
    throw new Error("La entrevista no se puede finalizar");
  }

  if (turnos.length > 0) {
    await registrarTurnosEntrevista({ entrevistaId, turnos });
  }

  const respuestas =
    entrevista.preguntas.length > 0
      ? entrevista.preguntas.map((pregunta) => ({
          pregunta,
          respuesta_texto: "Ver transcripción completa.",
        }))
      : [
          {
            pregunta: "Entrevista",
            respuesta_texto: "Ver transcripción completa.",
          },
        ];

  const resumen: ResumenEntrevista = {
    hallazgos: [],
    respuestas,
    sintesis:
      "Entrevista finalizada por el entrevistado. Revisar la transcripción completa.",
  };

  await guardarRespuestasEntrevista({
    entrevistaId,
    respuestas,
    resumen,
  });

  return { alreadyDone: false as const };
}

/**
 * First visit of an empty interview: stamp consentimiento_en so onboarding
 * does not show again, and the chat API will accept the kickoff.
 */
export async function aceptarConsentimientoEntrevista(entrevistaId: string) {
  const entrevista = await resolveEntrevista(entrevistaId);

  if (!entrevista) {
    throw new Error("Entrevista no encontrada");
  }

  if (!(await canWriteEntrevista(entrevista))) {
    throw new Error("No puedes empezar esta entrevista");
  }

  if (entrevista.estado === "completada") {
    return { alreadyDone: true as const };
  }

  if (entrevista.consentimiento_en) {
    return { alreadyDone: true as const };
  }

  const supabase = await createClient();
  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("entrevista")
    .update({ consentimiento_en: ahora })
    .eq("id", entrevistaId);

  if (error) {
    throw error;
  }

  return { alreadyDone: false as const };
}
