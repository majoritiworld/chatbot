import "server-only";

import { asegurarAccesoPortal } from "@/lib/consultoria/auth";
import type { DestinatarioPlantilla } from "@/lib/consultoria/destinatarios";
import {
  type ConduccionEntrevista,
  parsePreguntas,
  parseSecciones,
  parseTrato,
  preguntasDeSecciones,
  type SeccionEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import { accionAlAbrirPlantillaGuion } from "@/lib/consultoria/guion-apertura";
import {
  INSTRUCCIONES_AGENTE_CL_COLABORADORES,
  NOMBRE_PLANTILLA_CL_COLABORADORES,
  seccionesDeGuionClColaboradores,
  TRATO_CL_COLABORADORES,
} from "@/lib/consultoria/guiones/compliance-latam-colaboradores";
import {
  NOMBRE_PLANTILLA_CL_CORTO,
  seccionesDeGuionClCorto,
} from "@/lib/consultoria/guiones/compliance-latam-corto";
import {
  NOMBRE_PLANTILLA_CL_FASE_1,
  seccionesDeGuionClFase1,
} from "@/lib/consultoria/guiones/compliance-latam-fase-1";
import {
  INSTRUCCIONES_AGENTE_CL_FASE_2,
  NOMBRE_PLANTILLA_CL_FASE_2,
  seccionesDeGuionClFase2,
  TRATO_CL_FASE_2,
} from "@/lib/consultoria/guiones/compliance-latam-fase-2";
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
  conduccion: ConduccionEntrevista;
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
  instrucciones_agente?: string | null;
  trato?: string | null;
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
    conduccion: {
      instruccionesAgente: row.instrucciones_agente?.trim() ?? "",
      trato: parseTrato(row.trato),
    },
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
      instrucciones_agente,
      trato,
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
      instrucciones_agente,
      trato,
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
  conduccion,
}: {
  proyectoId: string;
  faseId: string;
  nombre: string;
  seccionesDeseadas: SeccionEntrevista[];
  conduccion?: ConduccionEntrevista;
}) {
  const supabase = await createClient();
  const existente = await getPlantillaGuionPorNombre(
    supabase,
    proyectoId,
    faseId,
    nombre
  );
  if (accionAlAbrirPlantillaGuion(existente !== null) === "conservar") {
    return existente?.id ?? null;
  }
  const secciones = seccionesDeseadas;
  const preguntas = preguntasDeSecciones(secciones);

  const { data, error } = await supabase
    .from("entrevista_plantilla")
    .insert({
      fase_id: faseId,
      nombre,
      preguntas,
      proyecto_id: proyectoId,
      secciones,
      ...(conduccion
        ? {
            instrucciones_agente: conduccion.instruccionesAgente,
            trato: conduccion.trato,
          }
        : {}),
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
  return await asegurarPlantillaGuion({
    faseId,
    nombre: NOMBRE_PLANTILLA_CL_FASE_1,
    proyectoId,
    seccionesDeseadas: seccionesDeGuionClFase1(),
  });
}

export async function asegurarPlantillaGuionClFase2({
  proyectoId,
  faseId,
}: {
  proyectoId: string;
  faseId: string;
}) {
  return await asegurarPlantillaGuion({
    conduccion: {
      instruccionesAgente: INSTRUCCIONES_AGENTE_CL_FASE_2,
      trato: TRATO_CL_FASE_2,
    },
    faseId,
    nombre: NOMBRE_PLANTILLA_CL_FASE_2,
    proyectoId,
    seccionesDeseadas: seccionesDeGuionClFase2(),
  });
}

export async function asegurarPlantillaGuionClColaboradores({
  proyectoId,
  faseId,
}: {
  proyectoId: string;
  faseId: string;
}) {
  return await asegurarPlantillaGuion({
    conduccion: {
      instruccionesAgente: INSTRUCCIONES_AGENTE_CL_COLABORADORES,
      trato: TRATO_CL_COLABORADORES,
    },
    faseId,
    nombre: NOMBRE_PLANTILLA_CL_COLABORADORES,
    proyectoId,
    seccionesDeseadas: seccionesDeGuionClColaboradores(),
  });
}

export async function asegurarPlantillaGuionClCorto({
  proyectoId,
  faseId,
}: {
  proyectoId: string;
  faseId: string;
}) {
  return await asegurarPlantillaGuion({
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
  conduccion,
  destinatario,
  proyectoId,
  fase,
  preguntas,
  secciones,
  plantillaId,
  rol,
}: {
  conduccion: ConduccionEntrevista;
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
    conduccion,
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

  return {
    correoEnviado: false,
    detalle: `${nombreVisible} <${destinatario.email}>: Acceso preparado. Comparte el enlace del proyecto; no enviamos invitación.`,
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
      conduccion: plantilla.conduccion,
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
  const partes = [
    resumen.enviados > 0 ? `${resumen.enviados} personas preparadas` : null,
    resumen.asignados > 0
      ? `${resumen.asignados} con entrevista asignada`
      : null,
    hechos > 0
      ? "sin correo de invitación: comparte el enlace del proyecto"
      : null,
    resumen.omitidos > 0 ? `${resumen.omitidos} omitidos` : null,
    resumen.errores > 0 ? `${resumen.errores} con error` : null,
  ].filter(Boolean);

  if (partes.length === 0) {
    return "No se preparó a nadie.";
  }

  return `${partes.join(". ")}.`;
}
