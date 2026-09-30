"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { cambiarRolPortal, invitarAlPortal } from "@/lib/consultoria/auth";
import { urlHttps } from "@/lib/consultoria/comunicacion";
import {
  combinarDestinatarios,
  MAX_DESTINATARIOS,
  parseDestinatariosOpcional,
} from "@/lib/consultoria/destinatarios";
import {
  type ConduccionEntrevista,
  construirArchivoTranscripcion,
  parseResumen,
  parseTranscripcion,
  preguntasDeSecciones,
  type ResumenEntrevista,
  type SeccionEntrevista,
  seccionesConDescripcionInterna,
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
import {
  interpretarColor,
  mensajeSlugInvalido,
  slugNormalizado,
  slugValido,
} from "@/lib/consultoria/marca";
import { sincronizarTranscripcionNotion } from "@/lib/consultoria/notion-transcripcion";
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
  eliminarEntrevistaDeFase,
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
  destinatariosDePersonas,
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

function revalidateProyecto(
  proyectoId: string,
  faseId?: string,
  plantillaId?: string
) {
  revalidatePath(`/admin/${proyectoId}`);
  revalidatePath("/portal");
  if (faseId) {
    revalidatePath(`/admin/${proyectoId}/fase/${faseId}`);
  }
  if (faseId && plantillaId) {
    revalidatePath(
      `/admin/${proyectoId}/fase/${faseId}/plantilla/${plantillaId}`
    );
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
  descripcion: z.string().optional(),
  nombre: z.string().trim().min(1, "Nombre requerido"),
});

function descripcionOpcional(value: string | undefined) {
  const texto = value?.trim();
  return texto ? texto : null;
}

export async function crearProyecto(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = proyectoSchema.safeParse({
    cliente: formData.get("cliente"),
    descripcion: formData.get("descripcion") ?? "",
    nombre: formData.get("nombre"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proyecto")
    .insert({
      cliente: parsed.data.cliente,
      descripcion: descripcionOpcional(parsed.data.descripcion),
      nombre: parsed.data.nombre,
    })
    .select("id")
    .single();

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidatePath("/admin");
  // The project is empty, and the phases it needs live on its own page.
  redirect(`/admin/${data.id}`);
}

const actualizarProyectoSchema = z.object({
  descripcion: z.string().optional(),
  proyectoId: z.string().uuid("Proyecto inválido"),
});

export async function actualizarProyecto(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = actualizarProyectoSchema.safeParse({
    descripcion: formData.get("descripcion") ?? "",
    proyectoId: formData.get("proyectoId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("proyecto")
    .update({ descripcion: descripcionOpcional(parsed.data.descripcion) })
    .eq("id", parsed.data.proyectoId);

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidateProyecto(parsed.data.proyectoId);
  return { message: "Descripción guardada.", status: "success" };
}

const accesoDirectoSchema = z.object({
  accesoDirecto: z.boolean(),
  proyectoId: z.string().uuid("Proyecto inválido"),
});

export async function actualizarAccesoDirecto(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = accesoDirectoSchema.safeParse({
    accesoDirecto: formData.get("accesoDirecto") === "1",
    proyectoId: formData.get("proyectoId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("proyecto")
    .update({ acceso_directo: parsed.data.accesoDirecto })
    .eq("id", parsed.data.proyectoId);

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidateProyecto(parsed.data.proyectoId);
  return { message: "Entrada guardada.", status: "success" };
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
  avisoRespuestas: z.string().trim().max(2000),
  bloqueComercial: z.string().trim().max(2000),
  bloqueComercialEtiqueta: z.string().trim().max(80),
  bloqueComercialUrl: z.string().trim().max(500),
  correoAsunto: z.string().trim().max(200),
  correoCuerpo: z.string().trim().max(2000),
  correoFirma: z.string().trim().max(160),
  correoRemitente: z.string().trim().max(120),
  descripcion: z.string().optional(),
  faseId: z.string().uuid("Fase inválida"),
  fechaCierre: z.string().trim().optional(),
  fechaEstimada: z.string().trim().optional(),
  invitacionAsunto: z.string().trim().max(200),
  invitacionCuerpo: z.string().trim().max(2000),
  minutos: z.string().trim().max(3),
  nombre: z.string().trim().min(1, "Nombre requerido"),
  proyectoId: z.string().uuid("Proyecto inválido"),
  textoBienvenida: z.string().trim().max(2000),
});

export async function actualizarFase(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = actualizarFaseSchema.safeParse({
    avisoRespuestas: formData.get("avisoRespuestas") ?? "",
    bloqueComercial: formData.get("bloqueComercial") ?? "",
    bloqueComercialEtiqueta: formData.get("bloqueComercialEtiqueta") ?? "",
    bloqueComercialUrl: formData.get("bloqueComercialUrl") ?? "",
    correoAsunto: formData.get("correoAsunto") ?? "",
    correoCuerpo: formData.get("correoCuerpo") ?? "",
    correoFirma: formData.get("correoFirma") ?? "",
    correoRemitente: formData.get("correoRemitente") ?? "",
    descripcion: formData.get("descripcion") ?? "",
    faseId: formData.get("faseId"),
    fechaCierre: formData.get("fechaCierre") || undefined,
    fechaEstimada: formData.get("fechaEstimada") || undefined,
    invitacionAsunto: formData.get("invitacionAsunto") ?? "",
    invitacionCuerpo: formData.get("invitacionCuerpo") ?? "",
    minutos: formData.get("minutos") ?? "",
    nombre: formData.get("nombre"),
    proyectoId: formData.get("proyectoId"),
    textoBienvenida: formData.get("textoBienvenida") ?? "",
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
  const minutos = minutosDeFormulario(parsed.data.minutos);
  if (!minutos.ok) {
    return { message: minutos.message, status: "error" };
  }
  const bloqueUrl = vacioONull(parsed.data.bloqueComercialUrl);
  if (bloqueUrl && !urlHttps(bloqueUrl)) {
    return {
      message: "El enlace del bloque comercial tiene que empezar por https://.",
      status: "error",
    };
  }
  const resultado = await actualizarFaseEnProyecto({
    // Only sent when the form shows the setting, i.e. after the migration.
    accesoEnlacePersonal: formData.has("accesoEnlacePersonalEditable")
      ? formData.get("accesoEnlacePersonal") === "on"
      : undefined,
    descripcion,
    faseId: parsed.data.faseId,
    fechaCierre,
    fechaEstimada,
    nombre: parsed.data.nombre,
    proyectoId: parsed.data.proyectoId,
    textos: {
      avisoRespuestas: vacioONull(parsed.data.avisoRespuestas),
      bloqueComercial: vacioONull(parsed.data.bloqueComercial),
      bloqueComercialEtiqueta: vacioONull(parsed.data.bloqueComercialEtiqueta),
      bloqueComercialUrl: bloqueUrl,
      correoAsunto: vacioONull(parsed.data.correoAsunto),
      correoCuerpo: vacioONull(parsed.data.correoCuerpo),
      correoFirma: vacioONull(parsed.data.correoFirma),
      correoRemitente: vacioONull(parsed.data.correoRemitente),
      invitacionAsunto: vacioONull(parsed.data.invitacionAsunto),
      invitacionCuerpo: vacioONull(parsed.data.invitacionCuerpo),
      minutos: minutos.minutos,
      textoBienvenida: vacioONull(parsed.data.textoBienvenida),
    },
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

const eliminarEntrevistaSchema = z.object({
  entrevistaId: z.string().uuid("Entrevista inválida"),
  faseId: z.string().uuid("Fase inválida"),
  proyectoId: z.string().uuid("Proyecto inválido"),
});

export async function eliminarEntrevista(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = eliminarEntrevistaSchema.safeParse({
    entrevistaId: formData.get("entrevistaId"),
    faseId: formData.get("faseId"),
    proyectoId: formData.get("proyectoId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const resultado = await eliminarEntrevistaDeFase({
    entrevistaId: parsed.data.entrevistaId,
    faseId: parsed.data.faseId,
    proyectoId: parsed.data.proyectoId,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidateProyecto(parsed.data.proyectoId, parsed.data.faseId);
  revalidatePath(
    `/admin/${parsed.data.proyectoId}/stakeholder/${resultado.stakeholderId}`
  );
  return { message: "Entrevista eliminada.", status: "success" };
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
  instrucciones: z.string().optional(),
  preguntas: z.array(z.string()),
  seguimientos: z.array(z.string()).optional(),
  titulo: z.string().trim().min(1, "Cada sección necesita un título"),
});

const conduccionSchema = z.object({
  instruccionesAgente: z.string().trim().max(8000),
  trato: z.enum(["tu", "usted"]),
});

function conduccionDesdeFormulario(
  formData: FormData
):
  | { ok: true; conduccion: ConduccionEntrevista }
  | { ok: false; message: string } {
  const parsed = conduccionSchema.safeParse({
    instruccionesAgente: formData.get("instruccionesAgente") ?? "",
    trato: formData.get("trato") ?? "tu",
  });
  if (!parsed.success) {
    return {
      message: "El trato o las instrucciones no son válidos",
      ok: false,
    };
  }
  return { conduccion: parsed.data, ok: true };
}

function columnasConduccion(conduccion: ConduccionEntrevista) {
  return {
    instrucciones_agente: conduccion.instruccionesAgente,
    trato: conduccion.trato,
  };
}

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

  const secciones = parsed.data.map((seccion) => {
    const instrucciones = seccion.instrucciones?.trim() ?? "";
    const seguimientos = preguntasDesdeTexto(
      (seccion.seguimientos ?? []).join("\n")
    );
    return {
      descripcion: seccion.descripcion.trim(),
      id: seccion.id.startsWith("new-") ? generateUUID() : seccion.id,
      ...(instrucciones ? { instrucciones } : {}),
      preguntas: preguntasDesdeTexto(seccion.preguntas.join("\n")),
      ...(seguimientos.length > 0 ? { seguimientos } : {}),
      titulo: seccion.titulo,
    };
  });
  if (secciones.some((seccion) => seccion.preguntas.length === 0)) {
    return {
      message: "Cada sección necesita al menos una pregunta guía",
      ok: false,
    };
  }
  const conInstrucciones = seccionesConDescripcionInterna(secciones);
  if (conInstrucciones.length > 0) {
    return {
      message: `La descripción pública de «${conInstrucciones.map((seccion) => seccion.titulo).join("», «")}» parece contener instrucciones del agente o seguimientos. Muévelas a la parte que solo recibe el agente.`,
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
  const resultadoConduccion = conduccionDesdeFormulario(formData);
  if (!resultadoConduccion.ok) {
    return { message: resultadoConduccion.message, status: "error" };
  }

  const fase = await getFaseDelProyecto(
    parsed.data.proyectoId,
    parsed.data.faseId
  );

  if (!fase) {
    return { message: "Esa fase no es de este proyecto", status: "error" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("entrevista_plantilla").insert({
    ...columnasConduccion(resultadoConduccion.conduccion),
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
  const resultadoConduccion = conduccionDesdeFormulario(formData);
  if (!resultadoConduccion.ok) {
    return { message: resultadoConduccion.message, status: "error" };
  }

  const supabase = await createClient();
  const { data: plantilla, error } = await supabase
    .from("entrevista_plantilla")
    .update({
      ...columnasConduccion(resultadoConduccion.conduccion),
      preguntas,
      secciones,
    })
    .eq("id", parsed.data.plantillaId)
    .eq("proyecto_id", parsed.data.proyectoId)
    .select("fase_id")
    .maybeSingle();

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidateProyecto(
    parsed.data.proyectoId,
    plantilla?.fase_id ?? undefined,
    parsed.data.plantillaId
  );
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
  const parsedDestinatarios = parseDestinatariosOpcional(
    parsed.data.destinatarios,
    firmaDefault
  );

  if (!parsedDestinatarios.ok) {
    return { message: parsedDestinatarios.message, status: "error" };
  }

  const existentes = await destinatariosDePersonas(
    parsed.data.proyectoId,
    formData.getAll("personaId").map(String)
  );
  const destinatarios = combinarDestinatarios(
    existentes,
    parsedDestinatarios.destinatarios
  );

  if (destinatarios.length === 0) {
    return {
      message: "Elige a alguien del proyecto o pega al menos un correo",
      status: "error",
    };
  }

  if (destinatarios.length > MAX_DESTINATARIOS) {
    return {
      message: `Máximo ${MAX_DESTINATARIOS} destinatarios por envío`,
      status: "error",
    };
  }

  const resultado = await enviarPlantillaALista({
    destinatarios,
    plantillaId: parsed.data.plantillaId,
    proyectoId: parsed.data.proyectoId,
    rol: parsed.data.rol,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidatePath("/admin");
  const plantilla = await getPlantillaDelProyecto(
    parsed.data.proyectoId,
    parsed.data.plantillaId
  );
  if (plantilla) {
    revalidateProyecto(parsed.data.proyectoId, plantilla.faseId, plantilla.id);
  } else {
    revalidatePath(`/admin/${parsed.data.proyectoId}`);
    revalidatePath("/portal");
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
    conduccion: plantilla.conduccion,
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

const marcaSchema = z.object({
  avisoRespuestas: z.string().trim().max(2000),
  color: z.string().trim().max(16),
  contactoEmail: z.string().trim().max(200),
  contactoNombre: z.string().trim().max(120),
  correoAsunto: z.string().trim().max(200),
  correoCuerpo: z.string().trim().max(2000),
  correoFirma: z.string().trim().max(160),
  correoRemitente: z.string().trim().max(120),
  invitacionAsunto: z.string().trim().max(200),
  invitacionCuerpo: z.string().trim().max(2000),
  nombrePublico: z.string().trim().max(120),
  proyectoId: z.string().uuid("Proyecto inválido"),
  slug: z.string().trim().max(64),
  textoBienvenida: z.string().trim().max(2000),
  titulo: z.string().trim().max(160),
});

const TIPOS_LOGO = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const LOGO_MAX_BYTES = 2_000_000;

function vacioONull(value: string) {
  return value.length > 0 ? value : null;
}

function minutosDeFormulario(value: string) {
  if (!value) {
    return { minutos: null, ok: true as const };
  }
  const minutos = Number(value);
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > 240) {
    return {
      message: "La duración tiene que ser un número de minutos entre 1 y 240.",
      ok: false as const,
    };
  }
  return { minutos, ok: true as const };
}

export async function guardarMarca(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = marcaSchema.safeParse({
    avisoRespuestas: formData.get("avisoRespuestas") ?? "",
    color: formData.get("color") ?? "",
    contactoEmail: formData.get("contactoEmail") ?? "",
    contactoNombre: formData.get("contactoNombre") ?? "",
    correoAsunto: formData.get("correoAsunto") ?? "",
    correoCuerpo: formData.get("correoCuerpo") ?? "",
    correoFirma: formData.get("correoFirma") ?? "",
    correoRemitente: formData.get("correoRemitente") ?? "",
    invitacionAsunto: formData.get("invitacionAsunto") ?? "",
    invitacionCuerpo: formData.get("invitacionCuerpo") ?? "",
    nombrePublico: formData.get("nombrePublico") ?? "",
    proyectoId: formData.get("proyectoId"),
    slug: formData.get("slug") ?? "",
    textoBienvenida: formData.get("textoBienvenida") ?? "",
    titulo: formData.get("titulo") ?? "",
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const slugPedido = slugNormalizado(parsed.data.slug);
  const slug = slugPedido ? slugValido(slugPedido) : null;
  if (slugPedido && !slug) {
    return { message: mensajeSlugInvalido(slugPedido), status: "error" };
  }

  const color = interpretarColor(parsed.data.color);
  if (!color.ok) {
    return {
      message: "El color principal tiene que ser un hexadecimal, como #1f4b3a.",
      status: "error",
    };
  }

  if (
    parsed.data.contactoEmail &&
    !z.string().email().safeParse(parsed.data.contactoEmail).success
  ) {
    return { message: "El correo de contacto no es válido.", status: "error" };
  }

  const archivo = formData.get("logo");
  const tieneLogo = archivo instanceof File && archivo.size > 0;
  if (tieneLogo && archivo instanceof File) {
    if (!TIPOS_LOGO.has(archivo.type)) {
      return {
        message: "El logo tiene que ser PNG, JPEG, WebP o GIF.",
        status: "error",
      };
    }
    if (archivo.size > LOGO_MAX_BYTES) {
      return { message: "El logo supera 2 MB.", status: "error" };
    }
    if (!slug) {
      return {
        message: "Guarda un identificador de enlace antes de subir el logo.",
        status: "error",
      };
    }
  }

  const supabase = await createClient();
  let logoPath: string | undefined;
  if (tieneLogo && archivo instanceof File && slug) {
    const extension = archivo.type.split("/").at(1) ?? "png";
    const path = `${parsed.data.proyectoId}/logo.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("marcas")
      .upload(path, archivo, {
        contentType: archivo.type,
        upsert: true,
      });
    if (uploadError) {
      return { message: uploadError.message, status: "error" };
    }
    logoPath = path;
  }

  const { error } = await supabase
    .from("proyecto")
    .update({
      aviso_respuestas: vacioONull(parsed.data.avisoRespuestas),
      color_principal: color.color,
      contacto_email: vacioONull(parsed.data.contactoEmail.toLowerCase()),
      contacto_nombre: vacioONull(parsed.data.contactoNombre),
      correo_asunto: vacioONull(parsed.data.correoAsunto),
      correo_cuerpo: vacioONull(parsed.data.correoCuerpo),
      correo_firma: vacioONull(parsed.data.correoFirma),
      correo_remitente: vacioONull(parsed.data.correoRemitente),
      nombre_publico: vacioONull(parsed.data.nombrePublico),
      slug,
      texto_bienvenida: vacioONull(parsed.data.textoBienvenida),
      titulo_iniciativa: vacioONull(parsed.data.titulo),
      ...(logoPath ? { logo_path: logoPath } : {}),
    })
    .eq("id", parsed.data.proyectoId);

  if (error) {
    if (error.code === "23505") {
      return {
        message: "Ese identificador ya lo usa otro proyecto.",
        status: "error",
      };
    }
    return { message: error.message, status: "error" };
  }

  const invitacion = formData.has("invitacionAsunto")
    ? await supabase
        .from("proyecto")
        .update({
          invitacion_asunto: vacioONull(parsed.data.invitacionAsunto),
          invitacion_cuerpo: vacioONull(parsed.data.invitacionCuerpo),
        })
        .eq("id", parsed.data.proyectoId)
    : { error: null };

  revalidateProyecto(parsed.data.proyectoId);
  if (slug) {
    revalidatePath(`/${slug}`);
  }
  if (invitacion.error) {
    return {
      message:
        "Marca guardada. Los textos de invitación no se guardaron: falta aplicar la migración de correos.",
      status: "success",
    };
  }
  return { message: "Marca guardada.", status: "success" };
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
  const resultadoConduccion = conduccionDesdeFormulario(formData);
  if (!resultadoConduccion.ok) {
    return { message: resultadoConduccion.message, status: "error" };
  }

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
    .update({
      ...columnasConduccion(resultadoConduccion.conduccion),
      preguntas,
      secciones,
    })
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

export type PublicacionNotionTranscripcion =
  | { alreadyDone: boolean; status: "success"; url: string }
  | { status: "error"; message: string };

export async function publicarTranscripcionNotion(
  stakeholderId: string
): Promise<PublicacionNotionTranscripcion> {
  await requireAdminUser();

  const datos = await getTranscripcionDescargable(stakeholderId);

  if (!datos) {
    return { message: "No encontramos al stakeholder", status: "error" };
  }

  if (!(datos.entrevistaId && datos.estadoEntrevista === "completada")) {
    return {
      message: "La entrevista todavía no está completada",
      status: "error",
    };
  }

  try {
    const resultado = await sincronizarTranscripcionNotion(datos.entrevistaId);
    if (resultado.status === "skipped") {
      return {
        message:
          "Faltan NOTION_API_KEY o NOTION_TRANSCRIPCIONES_DATABASE_ID en el servidor",
        status: "error",
      };
    }

    if (datos.proyectoId) {
      revalidatePath(`/admin/${datos.proyectoId}`);
      revalidatePath(`/admin/${datos.proyectoId}/stakeholder/${stakeholderId}`);
    }
    return {
      alreadyDone: resultado.status === "alreadyDone",
      status: "success",
      url: resultado.url,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "No se pudo enviar la transcripción a Notion",
      status: "error",
    };
  }
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
