import "server-only";

import { patronEmail } from "@/lib/consultoria/auth";
import {
  parsePreguntas,
  parseResumen,
  parseSecciones,
  parseTranscripcion,
  type ResumenEntrevista,
  type SeccionEntrevista,
  type TurnoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import { isPortalRole, type RolPortal } from "@/lib/consultoria/roles";
import { createClient } from "@/lib/supabase/server";

const DIAS_INACTIVIDAD_ALERTA = 5;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids come from the URL, and Postgres rejects a malformed uuid with a 400. */
function esUuid(value: string) {
  return UUID.test(value);
}

export type AlertaActividad = "ok" | "sin_actividad" | "inactivo";

export type StakeholderAdmin = {
  id: string;
  nombre: string;
  firma: string | null;
  email: string;
  estadoEntrevista: string;
  proyectoId: string;
  proyectoNombre: string;
  proyectoCliente: string;
  entrevistaId: string | null;
  entrevistaEstado: string | null;
  ultimaActividad: string | null;
  alerta: AlertaActividad;
  /** Portal access; null until they have a `usuario` row. */
  rolPortal: RolPortal | null;
};

export type FaseAdmin = {
  id: string;
  nombre: string;
  orden: number;
  estado: string;
  fechaEstimada: string | null;
};

export type DocumentoAdmin = {
  id: string;
  tipo: string;
  link: string;
  nombre: string | null;
  faseId: string | null;
  visibilidad: string;
  createdAt: string;
};

export type StakeholderDetalle = StakeholderAdmin & {
  preguntas: string[];
  secciones: SeccionEntrevista[];
  transcripcion: TurnoEntrevista[];
  resumen: ResumenEntrevista | null;
  fases: FaseAdmin[];
  faseVinculadaId: string | null;
  documentos: DocumentoAdmin[];
};

type ProyectoEmbed = {
  id: string;
  nombre: string;
  cliente: string;
} | null;

type EntrevistaEmbed = {
  id: string;
  estado: string;
  ultima_actividad: string | null;
  fecha_completada: string | null;
  preguntas?: unknown;
  secciones?: unknown;
  transcripcion?: unknown;
  resumen?: unknown;
} | null;

type StakeholderRow = {
  id: string;
  nombre: string;
  firma: string | null;
  email: string;
  estado_entrevista: string;
  proyecto_id: string;
  proyecto: ProyectoEmbed | ProyectoEmbed[];
  entrevista: EntrevistaEmbed | EntrevistaEmbed[];
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export function alertaActividad(
  estadoEntrevista: string,
  ultimaActividad: string | null
): AlertaActividad {
  if (estadoEntrevista === "completada") {
    return "ok";
  }

  if (!ultimaActividad) {
    return "sin_actividad";
  }

  const ageMs = Date.now() - new Date(ultimaActividad).getTime();
  if (Number.isNaN(ageMs) || ageMs > DIAS_INACTIVIDAD_ALERTA * MS_POR_DIA) {
    return "inactivo";
  }

  return "ok";
}

function toStakeholderAdmin(row: StakeholderRow): StakeholderAdmin {
  const proyecto = asOne(row.proyecto);
  const entrevista = asOne(row.entrevista);

  return {
    alerta: alertaActividad(
      row.estado_entrevista,
      entrevista?.ultima_actividad ?? null
    ),
    email: row.email,
    entrevistaEstado: entrevista?.estado ?? null,
    entrevistaId: entrevista?.id ?? null,
    estadoEntrevista: row.estado_entrevista,
    firma: row.firma,
    id: row.id,
    nombre: row.nombre,
    proyectoCliente: proyecto?.cliente ?? "",
    proyectoId: proyecto?.id ?? row.proyecto_id,
    proyectoNombre: proyecto?.nombre ?? "Sin proyecto",
    rolPortal: null,
    ultimaActividad: entrevista?.ultima_actividad ?? null,
  };
}

type PerfilRolRow = {
  email: string;
  rol: string;
};

function rolPortalDePerfil(rol: string): RolPortal | null {
  return isPortalRole(rol) ? rol : null;
}

async function rolesPortalPorEmails(emails: string[]) {
  const mapa = new Map<string, RolPortal>();
  const unicos = [
    ...new Set(
      emails.map((email) => email.trim().toLowerCase()).filter(Boolean)
    ),
  ];

  if (unicos.length === 0) {
    return mapa;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("usuario")
    .select("email, rol")
    .in("email", unicos);

  for (const row of (data ?? []) as PerfilRolRow[]) {
    const rol = rolPortalDePerfil(row.rol);
    if (rol) {
      mapa.set(row.email.toLowerCase(), rol);
    }
  }

  return mapa;
}

export async function listStakeholdersAdmin(
  proyectoId: string
): Promise<StakeholderAdmin[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stakeholder")
    .select(
      `
      id,
      nombre,
      firma,
      email,
      estado_entrevista,
      proyecto_id,
      proyecto:proyecto_id ( id, nombre, cliente ),
      entrevista ( id, estado, ultima_actividad, fecha_completada )
    `
    )
    .eq("proyecto_id", proyectoId)
    .order("nombre");

  if (error) {
    throw error;
  }

  const filas = ((data ?? []) as StakeholderRow[]).map(toStakeholderAdmin);
  const roles = await rolesPortalPorEmails(filas.map((fila) => fila.email));

  return filas.map((fila) => ({
    ...fila,
    rolPortal: roles.get(fila.email.toLowerCase()) ?? null,
  }));
}

export type ProyectoConProgreso = {
  id: string;
  nombre: string;
  cliente: string;
  entrevistasCompletadas: number;
  entrevistasTotal: number;
};

type ProyectoProgresoRow = {
  id: string;
  nombre: string;
  cliente: string;
  stakeholder: Array<{ id: string; estado_entrevista: string }> | null;
};

export async function listProyectosConProgresoAdmin(): Promise<
  ProyectoConProgreso[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proyecto")
    .select("id, nombre, cliente, stakeholder ( id, estado_entrevista )")
    .order("cliente")
    .order("nombre");

  if (error) {
    throw error;
  }

  return ((data ?? []) as ProyectoProgresoRow[]).map((row) => {
    const stakeholders = row.stakeholder ?? [];

    return {
      cliente: row.cliente,
      entrevistasCompletadas: stakeholders.filter(
        (item) => item.estado_entrevista === "completada"
      ).length,
      entrevistasTotal: stakeholders.length,
      id: row.id,
      nombre: row.nombre,
    };
  });
}

export async function getProyectoAdmin(proyectoId: string) {
  if (!esUuid(proyectoId)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proyecto")
    .select("id, nombre, cliente")
    .eq("id", proyectoId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

type FaseRow = {
  id: string;
  nombre: string;
  orden: number;
  estado: string;
  fecha_estimada: string | null;
};

function toFaseAdmin(row: FaseRow): FaseAdmin {
  return {
    estado: row.estado,
    fechaEstimada: row.fecha_estimada,
    id: row.id,
    nombre: row.nombre,
    orden: row.orden,
  };
}

export async function listFasesAdmin(proyectoId: string): Promise<FaseAdmin[]> {
  if (!esUuid(proyectoId)) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fase")
    .select("id, nombre, orden, estado, fecha_estimada")
    .eq("proyecto_id", proyectoId)
    .order("orden");

  if (error) {
    throw error;
  }

  return (data ?? []).map(toFaseAdmin);
}

export async function getStakeholderDetalle(
  stakeholderId: string
): Promise<StakeholderDetalle | null> {
  if (!esUuid(stakeholderId)) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stakeholder")
    .select(
      `
      id,
      nombre,
      firma,
      email,
      estado_entrevista,
      proyecto_id,
      proyecto:proyecto_id ( id, nombre, cliente ),
      entrevista (
        id,
        estado,
        ultima_actividad,
        fecha_completada,
        preguntas,
        secciones,
        transcripcion,
        resumen
      )
    `
    )
    .eq("id", stakeholderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as StakeholderRow;
  const base = toStakeholderAdmin(row);
  const entrevista = asOne(row.entrevista);

  const [
    { data: fases },
    { data: tareas },
    { data: documentos },
    { data: perfil },
  ] = await Promise.all([
    supabase
      .from("fase")
      .select("id, nombre, orden, estado, fecha_estimada")
      .eq("proyecto_id", base.proyectoId)
      .order("orden"),
    base.entrevistaId
      ? supabase
          .from("tarea")
          .select("fase_id")
          .eq("entrevista_id", base.entrevistaId)
          .eq("tipo", "entrevista")
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("documento")
      .select("id, tipo, link, nombre, fase_id, visibilidad, created_at")
      .eq("proyecto_id", base.proyectoId)
      .order("created_at", { ascending: false }),
    supabase
      .from("usuario")
      .select("rol")
      .ilike("email", patronEmail(base.email))
      .maybeSingle(),
  ]);

  return {
    ...base,
    documentos: (documentos ?? []).map((doc) => ({
      createdAt: doc.created_at,
      faseId: doc.fase_id,
      id: doc.id,
      link: doc.link,
      nombre: doc.nombre,
      tipo: doc.tipo,
      visibilidad: doc.visibilidad,
    })),
    fases: (fases ?? []).map(toFaseAdmin),
    faseVinculadaId: tareas?.fase_id ?? null,
    preguntas: parsePreguntas(entrevista?.preguntas),
    resumen: parseResumen(entrevista?.resumen),
    rolPortal: rolPortalDePerfil(perfil?.rol ?? ""),
    secciones: parseSecciones(entrevista?.secciones),
    transcripcion: parseTranscripcion(entrevista?.transcripcion),
  };
}

export type TranscripcionDescargable = {
  nombre: string;
  firma: string | null;
  proyectoNombre: string | null;
  estadoEntrevista: string;
  fecha: string | null;
  turnos: TurnoEntrevista[];
};

type TranscripcionRow = {
  nombre: string;
  firma: string | null;
  estado_entrevista: string;
  proyecto: { nombre: string } | Array<{ nombre: string }> | null;
  entrevista: EntrevistaEmbed | EntrevistaEmbed[];
};

export async function getTranscripcionDescargable(
  stakeholderId: string
): Promise<TranscripcionDescargable | null> {
  if (!esUuid(stakeholderId)) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stakeholder")
    .select(
      `
      nombre,
      firma,
      estado_entrevista,
      proyecto:proyecto_id ( nombre ),
      entrevista ( transcripcion, fecha_completada, ultima_actividad )
    `
    )
    .eq("id", stakeholderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as TranscripcionRow;
  const entrevista = asOne(row.entrevista);

  return {
    estadoEntrevista: row.estado_entrevista,
    fecha: entrevista?.fecha_completada ?? entrevista?.ultima_actividad ?? null,
    firma: row.firma,
    nombre: row.nombre,
    proyectoNombre: asOne(row.proyecto)?.nombre ?? null,
    turnos: parseTranscripcion(entrevista?.transcripcion),
  };
}
