import "server-only";

import { invitarAlPortal } from "@/lib/consultoria/auth";
import type { DestinatarioPlantilla } from "@/lib/consultoria/destinatarios";
import {
  parsePreguntas,
  parseSecciones,
  preguntasDeSecciones,
  type SeccionEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import {
  type FaseObjetivo,
  getFaseDelProyecto,
  provisionarDestinatarioPlantilla,
} from "@/lib/consultoria/provisioning";
import type { RolPortal } from "@/lib/consultoria/roles";
import { createClient } from "@/lib/supabase/server";

const LOTE_INVITES = 5;

export type PlantillaAdmin = {
  id: string;
  nombre: string;
  proyectoId: string;
  faseId: string;
  faseNombre: string;
  faseOrden: number;
  preguntas: string[];
  secciones: SeccionEntrevista[];
  enviadas: number;
};

type FaseEmbed = {
  id: string;
  nombre: string;
  orden: number;
} | null;

type PlantillaRow = {
  id: string;
  nombre: string;
  proyecto_id: string;
  fase_id: string;
  preguntas: unknown;
  secciones: unknown;
  fase?: FaseEmbed | FaseEmbed[];
  entrevista?: Array<{ id: string }> | null;
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value.at(0) ?? null;
  }
  return value ?? null;
}

function toPlantillaAdmin(row: PlantillaRow): PlantillaAdmin | null {
  const fase = asOne(row.fase);
  if (!fase) {
    return null;
  }
  const secciones = parseSecciones(row.secciones);
  const preguntas = parsePreguntas(row.preguntas);

  return {
    enviadas: row.entrevista?.length ?? 0,
    faseId: fase.id,
    faseNombre: fase.nombre,
    faseOrden: fase.orden,
    id: row.id,
    nombre: row.nombre,
    preguntas:
      secciones.length > 0 ? preguntasDeSecciones(secciones) : preguntas,
    proyectoId: row.proyecto_id,
    secciones,
  };
}

export async function listPlantillasAdmin(
  proyectoId: string
): Promise<PlantillaAdmin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entrevista_plantilla")
    .select(
      `
      id,
      nombre,
      proyecto_id,
      fase_id,
      preguntas,
      secciones,
      fase:fase_id ( id, nombre, orden ),
      entrevista ( id )
    `
    )
    .eq("proyecto_id", proyectoId)
    .order("created_at");

  if (error) {
    throw error;
  }

  return ((data ?? []) as PlantillaRow[])
    .map(toPlantillaAdmin)
    .filter((item): item is PlantillaAdmin => item !== null);
}

export async function getPlantillaDelProyecto(
  proyectoId: string,
  plantillaId: string
): Promise<(PlantillaAdmin & { fase: FaseObjetivo }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entrevista_plantilla")
    .select(
      `
      id,
      nombre,
      proyecto_id,
      fase_id,
      preguntas,
      secciones,
      fase:fase_id ( id, nombre, orden ),
      entrevista ( id )
    `
    )
    .eq("id", plantillaId)
    .eq("proyecto_id", proyectoId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const plantilla = toPlantillaAdmin(data as PlantillaRow);
  if (!plantilla) {
    return null;
  }

  const fase = await getFaseDelProyecto(proyectoId, plantilla.faseId);
  if (!fase) {
    return null;
  }

  return { ...plantilla, fase };
}

async function mapLotes<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const hechos: R[] = await Promise.all(items.slice(0, size).map(fn));
  const resto: R[] = await mapLotes(items.slice(size), size, fn);
  return [...hechos, ...resto];
}

export type ResultadoEnvioPlantilla = {
  enviados: number;
  asignados: number;
  omitidos: number;
  errores: number;
  correosEnviados: number;
  avisos: string[];
};

async function enviarADestinatario({
  destinatario,
  proyectoId,
  fase,
  preguntas,
  secciones,
  plantillaId,
  rol,
}: {
  destinatario: DestinatarioPlantilla;
  proyectoId: string;
  fase: FaseObjetivo;
  preguntas: string[];
  secciones: SeccionEntrevista[];
  plantillaId: string;
  rol: RolPortal;
}): Promise<{
  status: "creado" | "asignado" | "omitido" | "error";
  correoEnviado: boolean;
  detalle: string;
}> {
  const resultado = await provisionarDestinatarioPlantilla({
    email: destinatario.email,
    fase,
    firma: destinatario.firma,
    nombre: destinatario.nombre,
    plantillaId,
    preguntas,
    proyectoId,
    secciones,
  });

  if (!resultado.ok) {
    return {
      correoEnviado: false,
      detalle: `${destinatario.email}: ${resultado.message}`,
      status: resultado.status,
    };
  }

  const acceso = await invitarAlPortal({
    email: destinatario.email,
    nombre: destinatario.nombre,
    proyectoId,
    rol,
  });

  return {
    correoEnviado: acceso.enviado,
    detalle: `${destinatario.nombre} <${destinatario.email}>: ${acceso.message}`,
    status: resultado.status,
  };
}

export async function enviarPlantillaALista({
  plantillaId,
  proyectoId,
  destinatarios,
  rol,
}: {
  plantillaId: string;
  proyectoId: string;
  destinatarios: DestinatarioPlantilla[];
  rol: RolPortal;
}): Promise<
  | { ok: true; resumen: ResultadoEnvioPlantilla }
  | { ok: false; message: string }
> {
  const plantilla = await getPlantillaDelProyecto(proyectoId, plantillaId);

  if (!plantilla) {
    return {
      message: "Esa entrevista agéntica no es de este proyecto",
      ok: false,
    };
  }

  if (plantilla.preguntas.length === 0) {
    return {
      message: "La entrevista agéntica no tiene preguntas guía",
      ok: false,
    };
  }

  const filas = await mapLotes(destinatarios, LOTE_INVITES, (destinatario) =>
    enviarADestinatario({
      destinatario,
      fase: plantilla.fase,
      plantillaId: plantilla.id,
      preguntas: plantilla.preguntas,
      proyectoId,
      rol,
      secciones: plantilla.secciones,
    })
  );

  const resumen: ResultadoEnvioPlantilla = {
    asignados: filas.filter((fila) => fila.status === "asignado").length,
    avisos: filas
      .filter((fila) => fila.status === "omitido" || fila.status === "error")
      .map((fila) => fila.detalle),
    correosEnviados: filas.filter((fila) => fila.correoEnviado).length,
    enviados: filas.filter((fila) => fila.status === "creado").length,
    errores: filas.filter((fila) => fila.status === "error").length,
    omitidos: filas.filter((fila) => fila.status === "omitido").length,
  };

  return { ok: true, resumen };
}

export function mensajeResumenEnvio(resumen: ResultadoEnvioPlantilla) {
  const partes = [
    resumen.enviados > 0 ? `${resumen.enviados} invitados` : null,
    resumen.asignados > 0
      ? `${resumen.asignados} con entrevista asignada`
      : null,
    resumen.correosEnviados > 0
      ? `${resumen.correosEnviados} correos salieron`
      : null,
    resumen.omitidos > 0 ? `${resumen.omitidos} omitidos` : null,
    resumen.errores > 0 ? `${resumen.errores} con error` : null,
  ].filter(Boolean);

  if (partes.length === 0) {
    return "No se envió a nadie.";
  }

  return `${partes.join(". ")}.`;
}
