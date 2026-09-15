import "server-only";

import {
  consolidarRespuestasEntrevista,
  type FlujoEntrevista,
  haySeccionesPendientes,
  parsePreguntas,
  parseSecciones,
  parseSeccionesCompletadas,
  parseTranscripcion,
  preguntasDeSecciones,
  type RespuestaResumen,
  type ResumenEntrevista,
  type SeccionCompletada,
  type TurnoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import { createClient } from "@/lib/supabase/server";
import type { Entrevista, UserRole } from "@/lib/supabase/types";

const ENTREVISTA_SELECT = `
  id,
  stakeholder_id,
  preguntas,
  secciones,
  flujo_estado,
  seccion_actual,
  secciones_completadas,
  estado,
  fecha_completada,
  consentimiento_en,
  correo_agradecimiento_en,
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
  secciones: unknown;
  flujo_estado: string;
  seccion_actual: number;
  secciones_completadas: unknown;
  estado: string;
  fecha_completada: string | null;
  consentimiento_en: string | null;
  correo_agradecimiento_en: string | null;
  stakeholder?: StakeholderEmbed | StakeholderEmbed[];
};

function parseFlujoEstado(value: string): FlujoEntrevista {
  if (value === "presentacion" || value === "chat" || value === "revision") {
    return value;
  }
  return "bienvenida";
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function toEntrevista(row: EntrevistaRow): Entrevista {
  const stakeholder = asOne(row.stakeholder);
  const secciones = parseSecciones(row.secciones);
  const preguntas = parsePreguntas(row.preguntas);
  return {
    consentimiento_en: row.consentimiento_en,
    correo_agradecimiento_en: row.correo_agradecimiento_en,
    estado: row.estado,
    fecha_completada: row.fecha_completada,
    flujo_estado: parseFlujoEstado(row.flujo_estado),
    id: row.id,
    preguntas:
      secciones.length > 0 ? preguntasDeSecciones(secciones) : preguntas,
    seccion_actual: row.seccion_actual,
    secciones,
    secciones_completadas: parseSeccionesCompletadas(row.secciones_completadas),
    stakeholder_email: stakeholder?.email ?? null,
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

export async function avanzarFlujoEntrevista({
  entrevistaId,
  desde,
}: {
  entrevistaId: string;
  desde: "bienvenida" | "presentacion";
}) {
  const entrevista = await resolveEntrevista(entrevistaId);

  if (!entrevista || !(await canWriteEntrevista(entrevista))) {
    throw new Error("No puedes avanzar esta entrevista");
  }
  if (entrevista.estado !== "abierta" || entrevista.flujo_estado !== desde) {
    throw new Error("La entrevista cambió. Recarga para continuar.");
  }
  if (entrevista.secciones.length === 0) {
    throw new Error("La entrevista no tiene secciones configuradas");
  }

  const destino: FlujoEntrevista =
    desde === "bienvenida" ? "presentacion" : "chat";
  const supabase = await createClient();
  const { error } = await supabase.rpc("advance_interview_flow", {
    p_desde: desde,
    p_entrevista_id: entrevista.id,
  });

  if (error) {
    throw error;
  }

  return { flujoEstado: destino };
}

export async function completarSeccionEntrevista({
  entrevistaId,
  seccionId,
  modo,
  sintesis,
  hallazgos,
  respuestas,
  turnos = [],
}: {
  entrevistaId: string;
  seccionId: string;
  modo: "agente" | "manual";
  sintesis: string;
  hallazgos: string[];
  respuestas: RespuestaResumen[];
  turnos?: TurnoEntrevista[];
}) {
  const entrevista = await resolveEntrevista(entrevistaId);

  if (!entrevista || !(await canWriteEntrevista(entrevista))) {
    throw new Error("No puedes completar esta sección");
  }
  if (entrevista.estado !== "abierta" || entrevista.flujo_estado !== "chat") {
    throw new Error("La entrevista cambió. Recarga para continuar.");
  }

  const seccion = entrevista.secciones.at(entrevista.seccion_actual);
  if (!seccion || seccion.id !== seccionId) {
    throw new Error("Esta sección ya no está activa");
  }

  const ahora = new Date().toISOString();
  const completada: SeccionCompletada = {
    completadaEn: ahora,
    hallazgos,
    modo,
    respuestas,
    seccionId,
    sintesis,
  };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_interview_section", {
    p_completion: completada,
    p_entrevista_id: entrevista.id,
    p_seccion_id: seccion.id,
    p_transcripcion: turnos,
  });

  if (error) {
    throw error;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("La sección ya fue completada");
  }

  const avance = data as Record<string, unknown>;
  if (
    (avance.flujoEstado !== "bienvenida" &&
      avance.flujoEstado !== "presentacion" &&
      avance.flujoEstado !== "chat" &&
      avance.flujoEstado !== "revision") ||
    typeof avance.seccionActual !== "number" ||
    typeof avance.seccionId !== "string"
  ) {
    throw new Error("La sección no devolvió un avance válido");
  }

  return {
    flujoEstado: avance.flujoEstado,
    seccionActual: avance.seccionActual,
    seccionId: avance.seccionId,
  };
}

/**
 * Appends the turns of one exchange and stamps the activity clock. The admin
 * table reads `ultima_actividad` to flag stakeholders who went quiet.
 */
export async function registrarTurnosEntrevista({
  entrevistaId,
  estricto = false,
  turnos,
}: {
  entrevistaId: string;
  estricto?: boolean;
  turnos: TurnoEntrevista[];
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("append_interview_turns", {
    p_entrevista_id: entrevistaId,
    p_turnos: turnos,
  });

  if (error) {
    if (estricto) {
      throw error;
    }
    // Losing a transcript write must not break the interview in progress.
    console.error("No se pudo guardar la transcripción", error);
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
  const { data, error } = await supabase.rpc("submit_interview", {
    p_entrevista_id: entrevistaId,
    p_respuestas: respuestas,
    p_resumen: resumen,
  });

  if (error) {
    throw error;
  }

  const result =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  return { alreadyDone: result?.alreadyDone === true };
}

/**
 * User paused mid-interview: flush the latest turns and leave the row abierta
 * so they can pick it up another day.
 */
export async function guardarProgresoEntrevista({
  entrevistaId,
  seccionId,
  turnos,
}: {
  entrevistaId: string;
  seccionId: string;
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

  const seccion = entrevista.secciones.at(entrevista.seccion_actual);
  if (
    entrevista.estado !== "abierta" ||
    entrevista.flujo_estado !== "chat" ||
    seccion?.id !== seccionId
  ) {
    throw new Error("La entrevista no se puede guardar");
  }

  await registrarTurnosEntrevista({
    entrevistaId,
    estricto: true,
    turnos,
  });
  return { alreadyDone: false as const };
}

export async function enviarEntrevista(entrevistaId: string) {
  const entrevista = await resolveEntrevista(entrevistaId);

  if (!entrevista) {
    throw new Error("Entrevista no encontrada");
  }

  if (!(await canWriteEntrevista(entrevista))) {
    throw new Error("No puedes enviar esta entrevista");
  }

  if (entrevista.estado === "completada") {
    return {
      alreadyDone: true as const,
      correoEnviado: Boolean(entrevista.correo_agradecimiento_en),
      email: entrevista.stakeholder_email,
      nombre: entrevista.stakeholder_nombre,
    };
  }

  if (
    entrevista.estado !== "abierta" ||
    entrevista.flujo_estado !== "revision"
  ) {
    throw new Error("Completa todas las secciones antes de enviar");
  }

  if (
    haySeccionesPendientes(
      entrevista.secciones,
      entrevista.secciones_completadas
    )
  ) {
    throw new Error("Todavía hay secciones pendientes");
  }

  const resumen = consolidarRespuestasEntrevista(
    entrevista.secciones,
    entrevista.secciones_completadas
  );
  const { respuestas } = resumen;

  const guardado = await guardarRespuestasEntrevista({
    entrevistaId,
    respuestas,
    resumen,
  });

  return {
    alreadyDone: guardado.alreadyDone,
    correoEnviado: false,
    email: entrevista.stakeholder_email,
    nombre: entrevista.stakeholder_nombre,
  };
}

export async function marcarCorreoAgradecimientoEnviado(entrevistaId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_interview_thank_you_sent", {
    p_entrevista_id: entrevistaId,
  });

  if (error) {
    throw error;
  }
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
