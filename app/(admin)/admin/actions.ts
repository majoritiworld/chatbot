"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { parseDestinatarios } from "@/lib/consultoria/destinatarios";
import {
  construirArchivoTranscripcion,
  parseResumen,
  parseTranscripcion,
  type ResumenEntrevista,
  type TurnoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import {
  impersonarStakeholder,
  restaurarSesionMajoriti,
} from "@/lib/consultoria/impersonar";
import {
  enviarPlantillaALista,
  getPlantillaDelProyecto,
  mensajeResumenEnvio,
} from "@/lib/consultoria/plantillas";
import { landingPathForCurrentUser } from "@/lib/consultoria/portal";
import {
  crearEntrevistaConTarea,
  crearFaseEnProyecto,
  getFaseDelProyecto,
  preguntasDesdeTexto,
} from "@/lib/consultoria/provisioning";
import { ROLES_PORTAL } from "@/lib/consultoria/roles";
import { getTranscripcionDescargable } from "@/lib/consultoria/stakeholders";
import { createClient } from "@/lib/supabase/server";
import { generateUUID } from "@/lib/utils";

export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

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
    fechaEstimada: formData.get("fechaEstimada") || undefined,
    nombre: formData.get("nombre"),
    proyectoId: formData.get("proyectoId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const resultado = await crearFaseEnProyecto({
    fechaEstimada: parsed.data.fechaEstimada || null,
    nombre: parsed.data.nombre,
    proyectoId: parsed.data.proyectoId,
  });

  if (!resultado.ok) {
    return { message: resultado.message, status: "error" };
  }

  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  revalidatePath("/portal");
  return {
    message:
      resultado.estado === "en_progreso"
        ? "Fase creada y abierta."
        : "Fase creada. Queda bloqueada hasta que la abras.",
    status: "success",
  };
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

  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  revalidatePath("/portal");
  return {
    message: ESTADO_FASE_MENSAJE[parsed.data.estado],
    status: "success",
  };
}

const plantillaSchema = z.object({
  faseId: z.string().uuid("Selecciona una fase"),
  nombre: z.string().trim().min(1, "Nombre requerido"),
  preguntas: z.string(),
  proyectoId: z.string().uuid("Proyecto inválido"),
});

export async function crearPlantillaEntrevista(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = plantillaSchema.safeParse({
    faseId: formData.get("faseId"),
    nombre: formData.get("nombre"),
    preguntas: formData.get("preguntas") ?? "",
    proyectoId: formData.get("proyectoId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const preguntas = preguntasDesdeTexto(parsed.data.preguntas);

  if (preguntas.length === 0) {
    return { message: "Escribe al menos una pregunta guía", status: "error" };
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
    fase_id: fase.id,
    nombre: parsed.data.nombre,
    preguntas,
    proyecto_id: parsed.data.proyectoId,
  });

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  return {
    message: `Entrevista agéntica lista en "${fase.nombre}". Ya puedes enviarla.`,
    status: "success",
  };
}

const preguntasPlantillaSchema = z.object({
  plantillaId: z.string().uuid("Entrevista inválida"),
  preguntas: z.string(),
  proyectoId: z.string().uuid("Proyecto inválido"),
});

export async function guardarPreguntasPlantilla(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = preguntasPlantillaSchema.safeParse({
    plantillaId: formData.get("plantillaId"),
    preguntas: formData.get("preguntas") ?? "",
    proyectoId: formData.get("proyectoId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const preguntas = preguntasDesdeTexto(parsed.data.preguntas);

  if (preguntas.length === 0) {
    return { message: "Escribe al menos una pregunta guía", status: "error" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("entrevista_plantilla")
    .update({ preguntas })
    .eq("id", parsed.data.plantillaId)
    .eq("proyecto_id", parsed.data.proyectoId);

  if (error) {
    return { message: error.message, status: "error" };
  }

  revalidatePath(`/admin/${parsed.data.proyectoId}`);
  return {
    message: `${preguntas.length} preguntas guardadas. No cambia a quienes ya se la enviaste.`,
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

  const { resumen } = resultado;
  const avisos = resumen.avisos.slice(0, 8).join(" ");
  const hechos = resumen.enviados + resumen.asignados;

  return {
    message: [mensajeResumenEnvio(resumen), avisos].filter(Boolean).join(" "),
    status: hechos === 0 && resumen.errores > 0 ? "error" : "success",
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

const preguntasSchema = z.object({
  entrevistaId: z.string().uuid("Entrevista inválida"),
  preguntas: z.string(),
  proyectoId: z.string().uuid("Proyecto inválido"),
  stakeholderId: z.string().uuid("Stakeholder inválido"),
});

export async function guardarPreguntasEntrevista(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdminUser();

  const parsed = preguntasSchema.safeParse({
    entrevistaId: formData.get("entrevistaId"),
    preguntas: formData.get("preguntas") ?? "",
    proyectoId: formData.get("proyectoId"),
    stakeholderId: formData.get("stakeholderId"),
  });

  if (!parsed.success) {
    return primerError(parsed.error);
  }

  const preguntas = preguntasDesdeTexto(parsed.data.preguntas);

  if (preguntas.length === 0) {
    return { message: "Escribe al menos una pregunta guía", status: "error" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("entrevista")
    .update({ preguntas })
    .eq("id", parsed.data.entrevistaId);

  if (error) {
    return { message: error.message, status: "error" };
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
