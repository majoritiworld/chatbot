import "server-only";

import { asegurarAccesoPortal } from "@/lib/consultoria/auth";
import type { DestinatarioPlantilla } from "@/lib/consultoria/destinatarios";
import {
  parsePreguntas,
  parseSecciones,
  preguntasDeSecciones,
  type SeccionEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import {
  NOMBRE_PLANTILLA_CL_CORTO,
  seccionesDeGuionClCorto,
} from "@/lib/consultoria/guiones/compliance-latam-corto";
import {
  NOMBRE_PLANTILLA_CL_FASE_1,
  seccionesDeGuionClFase1,
} from "@/lib/consultoria/guiones/compliance-latam-fase-1";
import { enviarInvitacionEntrevista } from "@/lib/consultoria/invitacion-entrevista";
import { nombreCompleto } from "@/lib/consultoria/nombre";
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
  proyectoId: string,
  faseId?: string
): Promise<PlantillaAdmin[]> {
  const supabase = await createClient();
  let query = supabase
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

  if (faseId) {
    query = query.eq("fase_id", faseId);
  }

  const { data, error } = await query;

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

type ClienteSupabase = Awaited<ReturnType<typeof createClient>>;

type PlantillaGuionCl = {
  id: string;
  secciones: unknown;
};

function seccionesConIdsEstables(
  actuales: unknown,
  deseadas: SeccionEntrevista[]
): SeccionEntrevista[] {
  const idsPorTitulo = new Map(
    parseSecciones(actuales).map((seccion) => [seccion.titulo, seccion.id])
  );

  return deseadas.map((seccion) => {
    const idActual = idsPorTitulo.get(seccion.titulo);
    if (!idActual) {
      return seccion;
    }

    return {
      descripcion: seccion.descripcion,
      id: idActual,
      preguntas: seccion.preguntas,
      titulo: seccion.titulo,
    };
  });
}

async function getPlantillaGuionPorNombre(
  supabase: ClienteSupabase,
  proyectoId: string,
  faseId: string,
  nombre: string
): Promise<PlantillaGuionCl | null> {
  const { data, error } = await supabase
    .from("entrevista_plantilla")
    .select("id, secciones")
    .eq("proyecto_id", proyectoId)
    .eq("fase_id", faseId)
    .eq("nombre", nombre)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function borrarPlantillasGuionDuplicadas(
  supabase: ClienteSupabase,
  proyectoId: string,
  faseId: string,
  nombre: string,
  keeperId: string
) {
  const { error } = await supabase
    .from("entrevista_plantilla")
    .delete()
    .eq("proyecto_id", proyectoId)
    .eq("fase_id", faseId)
    .eq("nombre", nombre)
    .neq("id", keeperId);

  if (error) {
    throw error;
  }
}

async function asegurarPlantillaGuion({
  proyectoId,
  faseId,
  nombre,
  seccionesDeseadas,
}: {
  proyectoId: string;
  faseId: string;
  nombre: string;
  seccionesDeseadas: SeccionEntrevista[];
}) {
  const supabase = await createClient();
  const existente = await getPlantillaGuionPorNombre(
    supabase,
    proyectoId,
    faseId,
    nombre
  );
  let secciones = seccionesDeseadas;
  if (existente) {
    secciones = seccionesConIdsEstables(existente.secciones, seccionesDeseadas);
  }
  const preguntas = preguntasDeSecciones(secciones);

  if (existente) {
    const { error } = await supabase
      .from("entrevista_plantilla")
      .update({ preguntas, secciones })
      .eq("id", existente.id);

    if (error) {
      throw error;
    }

    await borrarPlantillasGuionDuplicadas(
      supabase,
      proyectoId,
      faseId,
      nombre,
      existente.id
    );
    return existente.id;
  }

  const { data, error } = await supabase
    .from("entrevista_plantilla")
    .insert({
      fase_id: faseId,
      nombre,
      preguntas,
      proyecto_id: proyectoId,
      secciones,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code !== "23505") {
      throw error;
    }

    const deNuevo = await getPlantillaGuionPorNombre(
      supabase,
      proyectoId,
      faseId,
      nombre
    );
    if (!deNuevo) {
      throw error;
    }

    await borrarPlantillasGuionDuplicadas(
      supabase,
      proyectoId,
      faseId,
      nombre,
      deNuevo.id
    );
    return deNuevo.id;
  }

  if (data?.id) {
    await borrarPlantillasGuionDuplicadas(
      supabase,
      proyectoId,
      faseId,
      nombre,
      data.id
    );
  }

  return data?.id ?? null;
}

export async function asegurarPlantillaGuionClFase1({
  proyectoId,
  faseId,
}: {
  proyectoId: string;
  faseId: string;
}) {
  return asegurarPlantillaGuion({
    faseId,
    nombre: NOMBRE_PLANTILLA_CL_FASE_1,
    proyectoId,
    seccionesDeseadas: seccionesDeGuionClFase1(),
  });
}

export async function asegurarPlantillaGuionClCorto({
  proyectoId,
  faseId,
}: {
  proyectoId: string;
  faseId: string;
}) {
  return asegurarPlantillaGuion({
    faseId,
    nombre: NOMBRE_PLANTILLA_CL_CORTO,
    proyectoId,
    seccionesDeseadas: seccionesDeGuionClCorto(),
  });
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
    apellido: destinatario.apellido,
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

  const nombreVisible = nombreCompleto(
    destinatario.nombre,
    destinatario.apellido
  );
  const acceso = await asegurarAccesoPortal({
    email: destinatario.email,
    nombre: nombreVisible,
    proyectoId,
    rol: destinatario.rol ?? rol,
  });

  if (!acceso.ok) {
    return {
      correoEnviado: false,
      detalle: `${nombreVisible} <${destinatario.email}>: ${acceso.message}`,
      status: resultado.status,
    };
  }

  const invitacion = await enviarInvitacionEntrevista(resultado.entrevistaId);

  return {
    correoEnviado: invitacion.ok,
    detalle: invitacion.ok
      ? `${nombreVisible} <${destinatario.email}>: Invitado a la entrevista.`
      : `${nombreVisible} <${destinatario.email}>: ${invitacion.message}`,
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
  const hechos = resumen.enviados + resumen.asignados;
  const sinCorreo = Math.max(0, hechos - resumen.correosEnviados);
  const partes = [
    resumen.enviados > 0 ? `${resumen.enviados} invitados` : null,
    resumen.asignados > 0
      ? `${resumen.asignados} con entrevista asignada`
      : null,
    resumen.correosEnviados > 0
      ? `${resumen.correosEnviados} correos de acceso al portal salieron`
      : null,
    sinCorreo > 0
      ? `${sinCorreo} no recibieron correo nuevo (ya tenían cuenta o el invite falló): avísales que entren al portal`
      : null,
    resumen.omitidos > 0 ? `${resumen.omitidos} omitidos` : null,
    resumen.errores > 0 ? `${resumen.errores} con error` : null,
  ].filter(Boolean);

  if (partes.length === 0) {
    return "No se envió a nadie.";
  }

  return `${partes.join(". ")}.`;
}
