"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { cambiarRolPortal, invitarAlPortal } from "@/lib/consultoria/auth";
import { parseDestinatarios } from "@/lib/consultoria/destinatarios";
import {
  construirArchivoTranscripcion,
  parseResumen,
  parseTranscripcion,
  preguntasDeSecciones,
  type ResumenEntrevista,
  type SeccionEntrevista,
  type TurnoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import {
  actualizarEventoEnProyecto,
  crearEventoEnProyecto,
  eliminarEventoDelProyecto,
  parseMinuta,
  parseParticipantes,
} from "@/lib/consultoria/eventos";
import {
  parseFechaOpcional,
  validarRangoFechas,
} from "@/lib/consultoria/fechas-rango";
import {
  impersonarStakeholder,
  restaurarSesionMajoriti,
} from "@/lib/consultoria/impersonar";
import { enviarInvitacionEntrevista } from "@/lib/consultoria/invitacion-entrevista";
import {
  enviarPlantillaALista,
  getPlantillaDelProyecto,
  mensajeResumenEnvio,
} from "@/lib/consultoria/plantillas";
import { landingPathForCurrentUser } from "@/lib/consultoria/portal";
import {
  actualizarFaseEnProyecto,
  crearEntrevistaConTarea,
  crearFaseEnProyecto,
  getFaseDelProyecto,
  preguntasDesdeTexto,
} from "@/lib/consultoria/provisioning";
import {
  expandirFechasRecurrentes,
  FRECUENCIAS_RECURRENCIA,
} from "@/lib/consultoria/recurrencia";
import { ROLES_PORTAL } from "@/lib/consultoria/roles";
import {
  actualizarStakeholderAdmin,
  crearStakeholderAdmin,
  getTranscripcionDescargable,
} from "@/lib/consultoria/stakeholders";
import {
  crearTareaEnFase,
  eliminarTareaDeFase,
} from "@/lib/consultoria/tareas";
import { createClient } from "@/lib/supabase/server";
import { generateUUID } from "@/lib/utils";

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

function revalidateProyecto(proyectoId: string, faseId?: string) {
  revalidatePath(`/admin/${proyectoId}`);
  revalidatePath("/portal");
  if (faseId) {
    revalidatePath(`/admin/${proyectoId}/fase/${faseId}`);
  }
}

function primerError(error: z.ZodError): ActionState {
  return {
    message: error.issues[0]?.message ?? "Datos inválidos",
    status: "error",
  };
}

const proyectoSchema = z.object({
  cliente: z.string().trim().min(1, "Cliente requerido"),
  nombre: z.string().trim().min(1, "Nombre requerido"),
});

export async function crearProyecto(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = proyectoSchema.safeParse({
    cliente: formData.get("cliente"),
    nombre: formData.get("nombre"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proyecto")
    .insert({ cliente: parsed.data.cliente, nombre: parsed.data.nombre })
    .select("id")
    .single();

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidatePath("/admin");
  // The project is empty, and the phases it needs live on its own page.
  redirect(`/admin/${data.id}`);
}

const faseSchema = z.object({
  fechaCierre: z.string().trim().optional(),
  fechaEstimada: z.string().trim().optional(),
  nombre: z.string().trim().min(1, "Nombre requerido"),
  proyectoId: z.string().uuid("Proyecto inválido"),
});

export async function crearFase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = faseSchema.safeParse({
    fechaCierre: formData.get("fechaCierre") || undefined,
    fechaEstimada: formData.get("fechaEstimada") || undefined,
    nombre: formData.get("nombre"),
    proyectoId: formData.get("proyectoId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const fechaEstimada = parseFechaOpcional(parsed.data.fechaEstimada);
  const fechaCierre = parseFechaOpcional(parsed.data.fechaCierre);
  const errorFechas = validarRangoFechas(fechaEstimada, fechaCierre);
  if (errorFechas) {
    return { message: errorFechas, status: "error" };
  }

  const resultado = await crearFaseEnProyecto({
    fechaCierre,
    fechaEstimada,
    nombre: parsed.data.nombre,
    proyectoId: parsed.data.proyectoId,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidateProyecto(parsed.data.proyectoId);
  return {
    message:
      resultado.estado === "en_progreso"
        ? "Fase creada y abierta."
        : "Fase creada. Queda bloqueada hasta que la abras.",
    status: "success",
  };
}

const actualizarFaseSchema = z.object({
  descripcion: z.string().optional(),
  faseId: z.string().uuid("Fase inválida"),
  fechaCierre: z.string().trim().optional(),
  fechaEstimada: z.string().trim().optional(),
  nombre: z.string().trim().min(1, "Nombre requerido"),
  proyectoId: z.string().uuid("Proyecto inválido"),
});

export async function actualizarFase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = actualizarFaseSchema.safeParse({
    descripcion: formData.get("descripcion") ?? "",
    faseId: formData.get("faseId"),
    fechaCierre: formData.get("fechaCierre") || undefined,
    fechaEstimada: formData.get("fechaEstimada") || undefined,
    nombre: formData.get("nombre"),
    proyectoId: formData.get("proyectoId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const fechaEstimada = parseFechaOpcional(parsed.data.fechaEstimada);
  const fechaCierre = parseFechaOpcional(parsed.data.fechaCierre);
  const errorFechas = validarRangoFechas(fechaEstimada, fechaCierre);
  if (errorFechas) {
    return { message: errorFechas, status: "error" };
  }

  const descripcion = parsed.data.descripcion?.trim() || null;
  const resultado = await actualizarFaseEnProyecto({
    descripcion,
    faseId: parsed.data.faseId,
    fechaCierre,
    fechaEstimada,
    nombre: parsed.data.nombre,
    proyectoId: parsed.data.proyectoId,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidateProyecto(parsed.data.proyectoId, parsed.data.faseId);
  return { message: "Fase actualizada.", status: "success" };
}

const tareaSchema = z.object({
  faseId: z.string().uuid("Fase inválida"),
  nombre: z.string().trim().min(1, "Nombre requerido"),
  proyectoId: z.string().uuid("Proyecto inválido"),
  stakeholderId: z.string().uuid("Elige a la persona responsable"),
});

export async function crearTarea(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = tareaSchema.safeParse({
    faseId: formData.get("faseId"),
    nombre: formData.get("nombre"),
    proyectoId: formData.get("proyectoId"),
    stakeholderId: formData.get("stakeholderId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const resultado = await crearTareaEnFase({
    faseId: parsed.data.faseId,
    nombre: parsed.data.nombre,
    proyectoId: parsed.data.proyectoId,
    stakeholderId: parsed.data.stakeholderId,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidateProyecto(parsed.data.proyectoId, parsed.data.faseId);
  return { message: "Tarea agregada.", status: "success" };
}

const eliminarTareaSchema = z.object({
  faseId: z.string().uuid("Fase inválida"),
  proyectoId: z.string().uuid("Proyecto inválido"),
  tareaId: z.string().uuid("Tarea inválida"),
});

export async function eliminarTarea(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = eliminarTareaSchema.safeParse({
    faseId: formData.get("faseId"),
    proyectoId: formData.get("proyectoId"),
    tareaId: formData.get("tareaId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const resultado = await eliminarTareaDeFase({
    faseId: parsed.data.faseId,
    proyectoId: parsed.data.proyectoId,
    tareaId: parsed.data.tareaId,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidateProyecto(parsed.data.proyectoId, parsed.data.faseId);
  return { message: "Tarea eliminada.", status: "success" };
}

const eventoSchema = z.object({
  fecha: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  fechaHasta: z.string().trim().optional(),
  participantes: z.string().optional(),
  proyectoId: z.string().uuid("Proyecto inválido"),
  recurrencia: z.enum(FRECUENCIAS_RECURRENCIA),
  titulo: z.string().trim().min(1, "Título requerido"),
});

export async function crearEvento(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = eventoSchema.safeParse({
    fecha: formData.get("fecha"),
    fechaHasta: formData.get("fechaHasta") ?? "",
    participantes: formData.get("participantes") ?? "",
    proyectoId: formData.get("proyectoId"),
    recurrencia: formData.get("recurrencia") ?? "ninguna",
    titulo: formData.get("titulo"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const hasta =
    parsed.data.recurrencia === "ninguna"
      ? null
      : parsed.data.fechaHasta || null;

  const serie = expandirFechasRecurrentes({
    frecuencia: parsed.data.recurrencia,
    hasta,
    inicio: parsed.data.fecha,
  });

  if (!serie.ok) {
    return { message: serie.message, status: "error" };
  }

  const resultado = await crearEventoEnProyecto({
    fechas: serie.fechas,
    participantes: parseParticipantes(parsed.data.participantes ?? ""),
    proyectoId: parsed.data.proyectoId,
    titulo: parsed.data.titulo,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidateProyecto(parsed.data.proyectoId);
  if (resultado.count === 1) {
    return { message: "Fecha agregada al calendario.", status: "success" };
  }

  return {
    message: `Se agregaron ${resultado.count} fechas al calendario.`,
    status: "success",
  };
}

const actualizarEventoSchema = z.object({
  eventoId: z.string().uuid("Evento inválido"),
  fecha: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  minuta: z.string().max(20_000, "La minuta es demasiado larga").optional(),
  participantes: z.string().optional(),
  proyectoId: z.string().uuid("Proyecto inválido"),
  titulo: z.string().trim().min(1, "Título requerido"),
});

export async function actualizarEvento(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = actualizarEventoSchema.safeParse({
    eventoId: formData.get("eventoId"),
    fecha: formData.get("fecha"),
    minuta: formData.get("minuta") ?? "",
    participantes: formData.get("participantes") ?? "",
    proyectoId: formData.get("proyectoId"),
    titulo: formData.get("titulo"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const resultado = await actualizarEventoEnProyecto({
    eventoId: parsed.data.eventoId,
    fecha: parsed.data.fecha,
    minuta: parseMinuta(parsed.data.minuta ?? ""),
    participantes: parseParticipantes(parsed.data.participantes ?? ""),
    proyectoId: parsed.data.proyectoId,
    titulo: parsed.data.titulo,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidateProyecto(parsed.data.proyectoId);
  return { message: "Fecha actualizada.", status: "success" };
}

const eliminarEventoSchema = z.object({
  eventoId: z.string().uuid("Evento inválido"),
  proyectoId: z.string().uuid("Proyecto inválido"),
});

export async function eliminarEvento(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = eliminarEventoSchema.safeParse({
    eventoId: formData.get("eventoId"),
    proyectoId: formData.get("proyectoId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const resultado = await eliminarEventoDelProyecto({
    eventoId: parsed.data.eventoId,
    proyectoId: parsed.data.proyectoId,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidateProyecto(parsed.data.proyectoId);
  return { message: "Fecha eliminada.", status: "success" };
}

const ESTADO_FASE_MENSAJE = {
  bloqueado: "Fase bloqueada.",
  completado: "Fase marcada como completada.",
  en_progreso: "Fase desbloqueada.",
} as const;

const estadoFaseSchema = z.object({
  estado: z.enum(["bloqueado", "en_progreso", "completado"]),
  faseId: z.string().uuid("Fase inválida"),
  proyectoId: z.string().uuid("Proyecto inválido"),
});

export async function cambiarEstadoFase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = estadoFaseSchema.safeParse({
    estado: formData.get("estado"),
    faseId: formData.get("faseId"),
    proyectoId: formData.get("proyectoId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("fase")
    .update({ estado: parsed.data.estado })
    .eq("id", parsed.data.faseId)
    .eq("proyecto_id", parsed.data.proyectoId);

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidateProyecto(parsed.data.proyectoId, parsed.data.faseId);
  return {
    message: ESTADO_FASE_MENSAJE[parsed.data.estado],
    status: "success",
  };
}

const plantillaSchema = z.object({
  faseId: z.string().uuid("Selecciona una fase"),
  nombre: z.string().trim().min(1, "Nombre requerido"),
  proyectoId: z.string().uuid("Proyecto inválido"),
  secciones: z.string(),
});

const seccionFormSchema = z.object({
  descripcion: z.string(),
  id: z.string().min(1),
  preguntas: z.array(z.string()),
  titulo: z.string().trim().min(1, "Cada sección necesita un título"),
});

function seccionesDesdeFormulario(
  raw: string
):
  | { ok: true; secciones: SeccionEntrevista[] }
  | { ok: false; message: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { message: "Las secciones no tienen un formato válido", ok: false };
  }

  const parsed = z.array(seccionFormSchema).min(1).safeParse(json);
  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Agrega al menos una sección",
      ok: false,
    };
  }

  const secciones = parsed.data.map((seccion) => ({
    descripcion: seccion.descripcion.trim(),
    id: seccion.id.startsWith("new-") ? generateUUID() : seccion.id,
    preguntas: preguntasDesdeTexto(seccion.preguntas.join("\n")),
    titulo: seccion.titulo,
  }));
  if (secciones.some((seccion) => seccion.preguntas.length === 0)) {
    return {
      message: "Cada sección necesita al menos una pregunta guía",
      ok: false,
    };
  }

  return { ok: true, secciones };
}

export async function crearPlantillaEntrevista(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = plantillaSchema.safeParse({
    faseId: formData.get("faseId"),
    nombre: formData.get("nombre"),
    proyectoId: formData.get("proyectoId"),
    secciones: formData.get("secciones") ?? "",
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const resultadoSecciones = seccionesDesdeFormulario(parsed.data.secciones);
  if (!resultadoSecciones.ok) {
    return { message: resultadoSecciones.message, status: "error" };
  }
  const { secciones } = resultadoSecciones;
  const preguntas = preguntasDeSecciones(secciones);

  const fase = await getFaseDelProyecto(
    parsed.data.proyectoId,
    parsed.data.faseId
  );

  if (!fase) {
    return { message: "Esa fase no es de este proyecto", status: "error" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("entrevista_plantilla").insert({
    fase_id: fase.id,
    nombre: parsed.data.nombre,
    preguntas,
    proyecto_id: parsed.data.proyectoId,
    secciones,
  });

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidateProyecto(parsed.data.proyectoId, parsed.data.faseId);
  return {
    message: `Entrevista agéntica lista en "${fase.nombre}". Ya puedes enviarla.`,
    status: "success",
  };
}

const preguntasPlantillaSchema = z.object({
  plantillaId: z.string().uuid("Entrevista inválida"),
  proyectoId: z.string().uuid("Proyecto inválido"),
  secciones: z.string(),
});

export async function guardarPreguntasPlantilla(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = preguntasPlantillaSchema.safeParse({
    plantillaId: formData.get("plantillaId"),
    proyectoId: formData.get("proyectoId"),
    secciones: formData.get("secciones") ?? "",
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const resultadoSecciones = seccionesDesdeFormulario(parsed.data.secciones);
  if (!resultadoSecciones.ok) {
    return { message: resultadoSecciones.message, status: "error" };
  }
  const { secciones } = resultadoSecciones;
  const preguntas = preguntasDeSecciones(secciones);

  const supabase = await createClient();
  const { data: plantilla, error } = await supabase
    .from("entrevista_plantilla")
    .update({ preguntas, secciones })
    .eq("id", parsed.data.plantillaId)
    .eq("proyecto_id", parsed.data.proyectoId)
    .select("fase_id")
    .maybeSingle();

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  if (plantilla?.fase_id) {
    revalidatePath(
      `/admin/${parsed.data.proyectoId}/fase/${plantilla.fase_id}`
    );
  }
  return {
    message: `${secciones.length} secciones guardadas. No cambia a quienes ya se la enviaste.`,
    status: "success",
  };
}

const enviarPlantillaSchema = z.object({
  destinatarios: z.string(),
  firmaDefault: z.string().trim().optional(),
  plantillaId: z.string().uuid("Elige una entrevista agéntica"),
  proyectoId: z.string().uuid("Proyecto inválido"),
  rol: z.enum(ROLES_PORTAL),
});

export async function enviarPlantillaEntrevista(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = enviarPlantillaSchema.safeParse({
    destinatarios: formData.get("destinatarios") ?? "",
    firmaDefault: formData.get("firmaDefault") || undefined,
    plantillaId: formData.get("plantillaId"),
    proyectoId: formData.get("proyectoId"),
    rol: formData.get("rol"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const firmaDefault = parsed.data.firmaDefault || null;
  const parsedDestinatarios = parseDestinatarios(
    parsed.data.destinatarios,
    firmaDefault
  );

  if (!parsedDestinatarios.ok) {
    return { message: parsedDestinatarios.message, status: "error" };
  }

  const resultado = await enviarPlantillaALista({
    destinatarios: parsedDestinatarios.destinatarios,
    plantillaId: parsed.data.plantillaId,
    proyectoId: parsed.data.proyectoId,
    rol: parsed.data.rol,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  revalidatePath("/portal");
  const plantilla = await getPlantillaDelProyecto(
    parsed.data.proyectoId,
    parsed.data.plantillaId
  );
  if (plantilla) {
    revalidatePath(`/admin/${parsed.data.proyectoId}/fase/${plantilla.faseId}`);
  }

  const { resumen } = resultado;
  const avisos = resumen.avisos.slice(0, 8).join(" ");
  const hechos = resumen.enviados + resumen.asignados;

  return {
    message: [mensajeResumenEnvio(resumen), avisos].filter(Boolean).join(" "),
    status: hechos === 0 && resumen.errores > 0 ? "error" : "success",
  };
}

const cambiarRolSchema = z.object({
  proyectoId: z.string().uuid("Proyecto inválido"),
  rol: z.enum(ROLES_PORTAL),
  stakeholderId: z.string().uuid("Persona inválida"),
});

export async function cambiarRolPortalStakeholder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = cambiarRolSchema.safeParse({
    proyectoId: formData.get("proyectoId"),
    rol: formData.get("rol"),
    stakeholderId: formData.get("stakeholderId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const supabase = await createClient();
  const { data: persona } = await supabase
    .from("stakeholder")
    .select("id, email, proyecto_id")
    .eq("id", parsed.data.stakeholderId)
    .maybeSingle();

  if (!persona || persona.proyecto_id !== parsed.data.proyectoId) {
    return {
      message: "No encontramos a esa persona en este proyecto",
      status: "error",
    };
  }

  const resultado = await cambiarRolPortal({
    email: persona.email,
    rol: parsed.data.rol,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidatePath(
    `/admin/${parsed.data.proyectoId}/stakeholder/${parsed.data.stakeholderId}`
  );
  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  revalidatePath("/portal");

  return {
    message:
      parsed.data.rol === "cliente"
        ? "Ahora entra al portal de fases."
        : "Ahora entra directo a su entrevista.",
    status: "success",
  };
}

const actualizarStakeholderSchema = z.object({
  apellido: z.string().trim().min(1, "Apellido requerido"),
  email: z.string().trim().email("Correo inválido"),
  firma: z.string().optional(),
  nombre: z.string().trim().min(1, "Nombre requerido"),
  proyectoId: z.string().uuid("Proyecto inválido"),
  stakeholderId: z.string().uuid("Persona inválida"),
});

export async function actualizarStakeholder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = actualizarStakeholderSchema.safeParse({
    apellido: formData.get("apellido"),
    email: formData.get("email"),
    firma: formData.get("firma") ?? "",
    nombre: formData.get("nombre"),
    proyectoId: formData.get("proyectoId"),
    stakeholderId: formData.get("stakeholderId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const resultado = await actualizarStakeholderAdmin({
    apellido: parsed.data.apellido,
    email: parsed.data.email,
    firma: parsed.data.firma?.trim() || null,
    nombre: parsed.data.nombre,
    proyectoId: parsed.data.proyectoId,
    stakeholderId: parsed.data.stakeholderId,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidatePath(
    `/admin/${parsed.data.proyectoId}/stakeholder/${parsed.data.stakeholderId}`
  );
  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  revalidatePath("/portal");

  return { message: "Datos actualizados.", status: "success" };
}

const crearStakeholderSchema = z.object({
  apellido: z.string().trim().min(1, "Apellido requerido"),
  email: z.string().trim().email("Correo inválido"),
  firma: z.string().optional(),
  nombre: z.string().trim().min(1, "Nombre requerido"),
  proyectoId: z.string().uuid("Proyecto inválido"),
  rol: z.enum(ROLES_PORTAL),
});

export async function crearStakeholder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = crearStakeholderSchema.safeParse({
    apellido: formData.get("apellido"),
    email: formData.get("email"),
    firma: formData.get("firma") ?? "",
    nombre: formData.get("nombre"),
    proyectoId: formData.get("proyectoId"),
    rol: formData.get("rol"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const resultado = await crearStakeholderAdmin({
    apellido: parsed.data.apellido,
    email: parsed.data.email,
    firma: parsed.data.firma?.trim() || null,
    nombre: parsed.data.nombre,
    proyectoId: parsed.data.proyectoId,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  const acceso = await invitarAlPortal({
    email: resultado.email,
    nombre: resultado.nombreCompleto,
    proyectoId: parsed.data.proyectoId,
    rol: parsed.data.rol,
  });

  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  revalidatePath("/portal");

  return {
    message: `${resultado.nombreCompleto} agregado. ${acceso.message}`,
    status: "success",
  };
}

const asignarEntrevistaSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido"),
  plantillaId: z.string().uuid("Elige una entrevista agéntica"),
  proyectoId: z.string().uuid("Proyecto inválido"),
  stakeholderId: z.string().uuid("Stakeholder inválido"),
});

/** Rescue path for someone already in the project without an interview. */
export async function asignarEntrevista(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = asignarEntrevistaSchema.safeParse({
    nombre: formData.get("nombre"),
    plantillaId: formData.get("plantillaId"),
    proyectoId: formData.get("proyectoId"),
    stakeholderId: formData.get("stakeholderId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const plantilla = await getPlantillaDelProyecto(
    parsed.data.proyectoId,
    parsed.data.plantillaId
  );

  if (!plantilla) {
    return {
      message: "Esa entrevista agéntica no es de este proyecto",
      status: "error",
    };
  }

  if (plantilla.preguntas.length === 0) {
    return {
      message: "La entrevista agéntica no tiene preguntas guía",
      status: "error",
    };
  }

  const resultado = await crearEntrevistaConTarea({
    fase: plantilla.fase,
    plantillaId: plantilla.id,
    preguntas: plantilla.preguntas,
    responsable: parsed.data.nombre,
    secciones: plantilla.secciones,
    stakeholderId: parsed.data.stakeholderId,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidatePath(
    `/admin/${parsed.data.proyectoId}/stakeholder/${parsed.data.stakeholderId}`
  );
  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  revalidatePath("/portal");
  return {
    message: `Entrevista creada en "${plantilla.fase.nombre}".`,
    status: "success",
  };
}

const invitarEntrevistaSchema = z.object({
  entrevistaId: z.string().uuid("Entrevista inválida"),
  proyectoId: z.string().uuid("Proyecto inválido"),
  stakeholderId: z.string().uuid("Stakeholder inválido"),
});

/** Mail the assignment URL. Does not create another interview or change role. */
export async function invitarEntrevistaAsignada(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = invitarEntrevistaSchema.safeParse({
    entrevistaId: formData.get("entrevistaId"),
    proyectoId: formData.get("proyectoId"),
    stakeholderId: formData.get("stakeholderId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const supabase = await createClient();
  const { data: entrevista } = await supabase
    .from("entrevista")
    .select("id, stakeholder:stakeholder_id ( id, proyecto_id )")
    .eq("id", parsed.data.entrevistaId)
    .maybeSingle();

  const stakeholder = entrevista?.stakeholder;
  const fila = Array.isArray(stakeholder) ? stakeholder.at(0) : stakeholder;

  if (
    !(
      entrevista &&
      fila?.id === parsed.data.stakeholderId &&
      fila.proyecto_id === parsed.data.proyectoId
    )
  ) {
    return {
      message: "Esa entrevista no pertenece a esta persona.",
      status: "error",
    };
  }

  let invitacion: Awaited<ReturnType<typeof enviarInvitacionEntrevista>>;
  try {
    invitacion = await enviarInvitacionEntrevista(parsed.data.entrevistaId);
  } catch {
    return {
      message: "No se pudo enviar la invitación. Inténtalo de nuevo.",
      status: "error",
    };
  }
  if (!invitacion.ok) {
    return { message: invitacion.message, status: "error" };
  }

  return {
    message: invitacion.creada
      ? "Invitación enviada. Le preparamos el acceso: entra al portal con su correo y un código."
      : "Invitación enviada. Entra al portal con su correo y un código.",
    status: "success",
  };
}

const preguntasSchema = z.object({
  entrevistaId: z.string().uuid("Entrevista inválida"),
  proyectoId: z.string().uuid("Proyecto inválido"),
  secciones: z.string(),
  stakeholderId: z.string().uuid("Stakeholder inválido"),
});

export async function guardarPreguntasEntrevista(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = preguntasSchema.safeParse({
    entrevistaId: formData.get("entrevistaId"),
    proyectoId: formData.get("proyectoId"),
    secciones: formData.get("secciones") ?? "",
    stakeholderId: formData.get("stakeholderId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const resultadoSecciones = seccionesDesdeFormulario(parsed.data.secciones);
  if (!resultadoSecciones.ok) {
    return { message: resultadoSecciones.message, status: "error" };
  }
  const { secciones } = resultadoSecciones;
  const preguntas = preguntasDeSecciones(secciones);

  const supabase = await createClient();
  const { data: entrevistaActual } = await supabase
    .from("entrevista")
    .select("consentimiento_en, estado, transcripcion")
    .eq("id", parsed.data.entrevistaId)
    .maybeSingle();
  if (
    entrevistaActual?.estado !== "abierta" ||
    entrevistaActual?.consentimiento_en ||
    parseTranscripcion(entrevistaActual?.transcripcion).length > 0
  ) {
    return {
      message: "No puedes cambiar las secciones de una entrevista iniciada.",
      status: "error",
    };
  }

  const { data: actualizada, error } = await supabase
    .from("entrevista")
    .update({ preguntas, secciones })
    .eq("id", parsed.data.entrevistaId)
    .eq("estado", "abierta")
    .is("consentimiento_en", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return { message: error.message, status: "error" };
  }
  if (!actualizada) {
    return {
      message:
        "La entrevista empezó mientras editabas. No se guardó el cambio.",
      status: "error",
    };
  }

  revalidatePath(
    `/admin/${parsed.data.proyectoId}/stakeholder/${parsed.data.stakeholderId}`
  );
  return {
    message: `${preguntas.length} preguntas guardadas`,
    status: "success",
  };
}

/** Swap into the stakeholder's Auth session and land on their portal. */
export async function entrarComoStakeholder(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const stakeholderId = String(formData.get("stakeholderId") ?? "");
  const parsed = z.string().uuid().safeParse(stakeholderId);

  if (!parsed.success) {
    return { message: "Stakeholder inválido", status: "error" };
  }

  const resultado = await impersonarStakeholder(parsed.data);

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  redirect(await landingPathForCurrentUser());
}

/** Restore the stashed Majoriti session after viewing a stakeholder portal. */
export async function volverAlAdmin() {
  const resultado = await restaurarSesionMajoriti();

  if (!resultado.ok) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?error=auth");
  }

  redirect("/admin");
}

export type DescargaTranscripcion =
  | { status: "success"; filename: string; content: string }
  | { status: "error"; message: string };

export async function descargarTranscripcion(
  stakeholderId: string
): Promise<DescargaTranscripcion> {
  await requireAdminUser();

  const datos = await getTranscripcionDescargable(stakeholderId);

  if (!datos) {
    return { message: "No encontramos al stakeholder", status: "error" };
  }

  if (datos.estadoEntrevista !== "completada") {
    return {
      message: "La entrevista todavía no está completada",
      status: "error",
    };
  }

  const archivo = construirArchivoTranscripcion({
    fecha: datos.fecha,
    firma: datos.firma,
    nombre: datos.nombre,
    proyecto: datos.proyectoNombre,
    turnos: datos.turnos,
  });

  return {
    content: archivo.content,
    filename: archivo.filename,
    status: "success",
  };
}

export async function guardarContenidoEntrevista(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const entrevistaId = String(formData.get("entrevistaId") ?? "");
  const stakeholderId = String(formData.get("stakeholderId") ?? "");
  const proyectoId = String(formData.get("proyectoId") ?? "");
  const transcripcionRaw = String(formData.get("transcripcion") ?? "");
  const resumenRaw = String(formData.get("resumen") ?? "");

  if (!entrevistaId || !stakeholderId) {
    return { message: "Falta la entrevista", status: "error" };
  }

  let transcripcion: TurnoEntrevista[];
  let resumen: ResumenEntrevista | null;

  try {
    transcripcion = parseTranscripcion(JSON.parse(transcripcionRaw || "[]"));
  } catch {
    return {
      message: "La transcripción no es JSON válido",
      status: "error",
    };
  }

  try {
    resumen =
      resumenRaw.trim().length === 0
        ? null
        : parseResumen(JSON.parse(resumenRaw));
    if (resumenRaw.trim().length > 0 && !resumen) {
      return { message: "El resumen no es JSON válido", status: "error" };
    }
  } catch {
    return { message: "El resumen no es JSON válido", status: "error" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("entrevista")
    .update({
      resumen,
      transcripcion,
    })
    .eq("id", entrevistaId);

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidatePath(`/admin/${proyectoId}/stakeholder/${stakeholderId}`);
  return { message: "Guardado", status: "success" };
}

export async function marcarFaseCompletada(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const faseId = String(formData.get("faseId") ?? "");
  const stakeholderId = String(formData.get("stakeholderId") ?? "");
  const proyectoId = String(formData.get("proyectoId") ?? "");

  if (!faseId) {
    return { message: "Selecciona una fase", status: "error" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("fase")
    .update({ estado: "completado" })
    .eq("id", faseId);

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidatePath(`/admin/${proyectoId}/stakeholder/${stakeholderId}`);
  revalidatePath("/portal");
  return { message: "Fase marcada como completada", status: "success" };
}

const documentoSchema = z.object({
  faseId: z.string().optional(),
  link: z.string().trim().optional(),
  nombre: z.string().trim().optional(),
  proyectoId: z.string().uuid(),
  stakeholderId: z.string().uuid(),
  tipo: z.string().trim().min(1, "Tipo requerido"),
});

export async function subirDocumento(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = documentoSchema.safeParse({
    faseId: formData.get("faseId") || "",
    link: formData.get("link") || "",
    nombre: formData.get("nombre") || undefined,
    proyectoId: formData.get("proyectoId"),
    stakeholderId: formData.get("stakeholderId"),
    tipo: formData.get("tipo"),
  });

  if (!parsed.success) {
    return {
      message: parsed.error.issues[0]?.message ?? "Datos inválidos",
      status: "error",
    };
  }

  const archivo = formData.get("archivo");
  const hasFile = archivo instanceof File && archivo.size > 0;
  const linkRaw = parsed.data.link?.trim() ?? "";
  const hasLink = linkRaw.length > 0;

  if (!(hasFile || hasLink)) {
    return {
      message: "Sube un archivo o pega un link",
      status: "error",
    };
  }

  if (hasLink) {
    const linkOk = z.string().url().safeParse(linkRaw);
    if (!linkOk.success) {
      return { message: "Link inválido", status: "error" };
    }
  }

  const faseIdRaw = parsed.data.faseId?.trim() ?? "";
  if (faseIdRaw.length > 0) {
    const faseOk = z.string().uuid().safeParse(faseIdRaw);
    if (!faseOk.success) {
      return { message: "Fase inválida", status: "error" };
    }
  }

  const supabase = await createClient();
  let link = linkRaw;
  let nombre = parsed.data.nombre || null;
  const faseId = faseIdRaw || null;

  if (hasFile && archivo instanceof File) {
    const safeName = archivo.name.replace(/[^\w.-]+/g, "_");
    const path = [
      parsed.data.proyectoId,
      faseId ?? "sin-fase",
      `${generateUUID()}-${safeName}`,
    ].join("/");

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(path, archivo, {
        contentType: archivo.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return { message: uploadError.message, status: "error" };
    }

    link = path;
    nombre = nombre ?? archivo.name;
  }

  const { error } = await supabase.from("documento").insert({
    fase_id: faseId,
    link,
    nombre,
    proyecto_id: parsed.data.proyectoId,
    tipo: parsed.data.tipo,
    visibilidad: "interno",
  });

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidatePath(
    `/admin/${parsed.data.proyectoId}/stakeholder/${parsed.data.stakeholderId}`
  );
  return { message: "Documento asociado", status: "success" };
}
