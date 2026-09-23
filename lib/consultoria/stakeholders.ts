import "server-only";

import {
  actualizarCuentaPortal,
  normalizarEmail,
  patronEmail,
} from "@/lib/consultoria/auth";
import type { DestinatarioPlantilla } from "@/lib/consultoria/destinatarios";
import {
  parsePreguntas,
  parseResumen,
  parseSecciones,
  parseTranscripcion,
  type ResumenEntrevista,
  type SeccionEntrevista,
  type TurnoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import { nombreCompleto } from "@/lib/consultoria/nombre";
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
  apellido: string | null;
  nombreCompleto: string;
  firma: string | null;
  email: string;
  estadoEntrevista: string;
  proyectoId: string;
  proyectoNombre: string;
  proyectoCliente: string;
  entrevistaId: string | null;
  entrevistaEstado: string | null;
  notionTranscripcionId: string | null;
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
  fechaCierre: string | null;
  descripcion: string | null;
};

export type EntrevistaDeFaseAdmin = {
  id: string;
  estado: string;
  stakeholderId: string;
  stakeholderNombre: string;
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
  notion_transcripcion_id?: string | null;
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
  apellido: string | null;
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
    apellido: row.apellido,
    email: row.email,
    entrevistaEstado: entrevista?.estado ?? null,
    entrevistaId: entrevista?.id ?? null,
    estadoEntrevista: row.estado_entrevista,
    firma: row.firma,
    id: row.id,
    nombre: row.nombre,
    nombreCompleto: nombreCompleto(row.nombre, row.apellido),
    notionTranscripcionId: entrevista?.notion_transcripcion_id ?? null,
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
      apellido,
      firma,
      email,
      estado_entrevista,
      proyecto_id,
      proyecto:proyecto_id ( id, nombre, cliente ),
      entrevista ( id, estado, notion_transcripcion_id, ultima_actividad, fecha_completada )
    `
    )
    .eq("proyecto_id", proyectoId)
    .order("nombre")
    .order("apellido");

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

/** Turns checked people into send-list rows, scoped to this project. */
export async function destinatariosDePersonas(
  proyectoId: string,
  ids: string[]
): Promise<DestinatarioPlantilla[]> {
  const pedidos = new Set(ids.filter((id) => esUuid(id)));
  if (pedidos.size === 0) {
    return [];
  }

  const personas = await listStakeholdersAdmin(proyectoId);
  const destinatarios: DestinatarioPlantilla[] = [];

  for (const persona of personas) {
    if (!pedidos.has(persona.id)) {
      continue;
    }

    destinatarios.push({
      apellido: persona.apellido,
      email: persona.email,
      firma: persona.firma,
      nombre: persona.nombre,
      rol: persona.rolPortal ?? undefined,
    });
  }

  return destinatarios;
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

export type ProyectoAdmin = {
  id: string;
  nombre: string;
  cliente: string;
  descripcion: string | null;
};

export async function getProyectoAdmin(
  proyectoId: string
): Promise<ProyectoAdmin | null> {
  if (!esUuid(proyectoId)) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proyecto")
    .select("id, nombre, cliente, descripcion")
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
  fecha_cierre: string | null;
  descripcion: string | null;
};

function toFaseAdmin(row: FaseRow): FaseAdmin {
  return {
    descripcion: row.descripcion,
    estado: row.estado,
    fechaCierre: row.fecha_cierre,
    fechaEstimada: row.fecha_estimada,
    id: row.id,
    nombre: row.nombre,
    orden: row.orden,
  };
}

const FASE_ADMIN_SELECT =
  "id, nombre, orden, estado, fecha_estimada, fecha_cierre, descripcion";

export async function listFasesAdmin(proyectoId: string): Promise<FaseAdmin[]> {
  if (!esUuid(proyectoId)) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fase")
    .select(FASE_ADMIN_SELECT)
    .eq("proyecto_id", proyectoId)
    .order("orden");

  if (error) {
    throw error;
  }

  return (data ?? []).map(toFaseAdmin);
}

export async function getFaseAdmin(
  proyectoId: string,
  faseId: string
): Promise<FaseAdmin | null> {
  if (!(esUuid(proyectoId) && esUuid(faseId))) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fase")
    .select(FASE_ADMIN_SELECT)
    .eq("proyecto_id", proyectoId)
    .eq("id", faseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toFaseAdmin(data) : null;
}

type EntrevistaFaseEmbed = {
  id: string;
  estado: string;
  stakeholder_id: string;
  stakeholder:
    | {
        id: string;
        nombre: string;
        apellido: string | null;
        estado_entrevista: string;
      }
    | Array<{
        id: string;
        nombre: string;
        apellido: string | null;
        estado_entrevista: string;
      }>
    | null;
} | null;

type TareaFaseRow = {
  entrevista: EntrevistaFaseEmbed | EntrevistaFaseEmbed[] | null;
};

export async function listEntrevistasDeFaseAdmin(
  faseId: string
): Promise<EntrevistaDeFaseAdmin[]> {
  if (!esUuid(faseId)) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tarea")
    .select(
      `
      entrevista:entrevista_id (
        id,
        estado,
        stakeholder_id,
        stakeholder:stakeholder_id ( id, nombre, apellido, estado_entrevista )
      )
    `
    )
    .eq("fase_id", faseId)
    .eq("tipo", "entrevista");

  if (error) {
    throw error;
  }

  const entrevistas: EntrevistaDeFaseAdmin[] = [];

  for (const row of (data ?? []) as TareaFaseRow[]) {
    const entrevista = asOne(row.entrevista);
    if (!entrevista) {
      continue;
    }

    const stakeholder = asOne(entrevista.stakeholder);
    if (!stakeholder) {
      continue;
    }

    entrevistas.push({
      estado:
        entrevista.estado === "completada" ||
        stakeholder.estado_entrevista === "completada"
          ? "completada"
          : stakeholder.estado_entrevista || entrevista.estado || "pendiente",
      id: entrevista.id,
      stakeholderId: stakeholder.id,
      stakeholderNombre: nombreCompleto(
        stakeholder.nombre,
        stakeholder.apellido
      ),
    });
  }

  entrevistas.sort((a, b) =>
    a.stakeholderNombre.localeCompare(b.stakeholderNombre, "es")
  );

  return entrevistas;
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
      apellido,
      firma,
      email,
      estado_entrevista,
      proyecto_id,
      proyecto:proyecto_id ( id, nombre, cliente ),
      entrevista (
        id,
        estado,
        notion_transcripcion_id,
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
      .select(FASE_ADMIN_SELECT)
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

export async function actualizarStakeholderAdmin({
  stakeholderId,
  proyectoId,
  nombre,
  apellido,
  email: emailCrudo,
  firma,
}: {
  stakeholderId: string;
  proyectoId: string;
  nombre: string;
  apellido: string | null;
  email: string;
  firma: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const email = normalizarEmail(emailCrudo);
  const nombreVisible = nombreCompleto(nombre, apellido);
  const supabase = await createClient();
  const { data: persona } = await supabase
    .from("stakeholder")
    .select("id, email, nombre, apellido, proyecto_id")
    .eq("id", stakeholderId)
    .maybeSingle();

  if (!persona || persona.proyecto_id !== proyectoId) {
    return {
      message: "No encontramos a esa persona en este proyecto",
      ok: false,
    };
  }

  const emailActual = normalizarEmail(persona.email);
  if (email !== emailActual) {
    const [{ data: ocupado }, { data: cuentaExistente }] = await Promise.all([
      supabase
        .from("stakeholder")
        .select("id")
        .ilike("email", patronEmail(email))
        .neq("id", stakeholderId)
        .maybeSingle(),
      supabase
        .from("usuario")
        .select("email")
        .ilike("email", patronEmail(email))
        .maybeSingle(),
    ]);

    if (ocupado) {
      return { message: "Ya hay otra persona con ese correo", ok: false };
    }

    if (
      cuentaExistente &&
      normalizarEmail(cuentaExistente.email) !== emailActual
    ) {
      return { message: "Ya hay una cuenta con ese correo", ok: false };
    }
  }

  const cuenta = await actualizarCuentaPortal({
    email,
    emailActual,
    nombre: nombreVisible,
  });

  if (!cuenta.ok) {
    return cuenta;
  }

  const { error } = await supabase
    .from("stakeholder")
    .update({ apellido, email, firma, nombre })
    .eq("id", stakeholderId)
    .eq("proyecto_id", proyectoId);

  if (!error) {
    return { ok: true };
  }

  if (email !== emailActual) {
    await actualizarCuentaPortal({
      email: emailActual,
      emailActual: email,
      nombre: nombreCompleto(persona.nombre, persona.apellido),
    });
  }

  if (error.code === "23505") {
    return { message: "Ya hay otra persona con ese correo", ok: false };
  }

  return { message: error.message, ok: false };
}

export type TranscripcionDescargable = {
  entrevistaId: string | null;
  nombre: string;
  firma: string | null;
  proyectoId: string | null;
  proyectoNombre: string | null;
  estadoEntrevista: string;
  fecha: string | null;
  turnos: TurnoEntrevista[];
};

type TranscripcionRow = {
  nombre: string;
  apellido: string | null;
  firma: string | null;
  estado_entrevista: string;
  proyecto_id: string;
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
      apellido,
      firma,
      estado_entrevista,
      proyecto_id,
      proyecto:proyecto_id ( nombre ),
      entrevista ( id, transcripcion, fecha_completada, ultima_actividad )
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
    entrevistaId: entrevista?.id ?? null,
    estadoEntrevista: row.estado_entrevista,
    fecha: entrevista?.fecha_completada ?? entrevista?.ultima_actividad ?? null,
    firma: row.firma,
    nombre: nombreCompleto(row.nombre, row.apellido),
    proyectoId: row.proyecto_id,
    proyectoNombre: asOne(row.proyecto)?.nombre ?? null,
    turnos: parseTranscripcion(entrevista?.transcripcion),
  };
}

export async function crearStakeholderAdmin({
  proyectoId,
  nombre,
  apellido,
  email: emailCrudo,
  firma,
}: {
  proyectoId: string;
  nombre: string;
  apellido: string | null;
  email: string;
  firma: string | null;
}): Promise<
  | { ok: true; email: string; nombreCompleto: string }
  | { ok: false; message: string }
> {
  const email = normalizarEmail(emailCrudo);
  const supabase = await createClient();
  const { data: proyecto } = await supabase
    .from("proyecto")
    .select("id")
    .eq("id", proyectoId)
    .maybeSingle();

  if (!proyecto) {
    return { message: "No encontramos ese proyecto", ok: false };
  }

  const [{ data: ocupado }, { data: cuenta }] = await Promise.all([
    supabase
      .from("stakeholder")
      .select("id")
      .ilike("email", patronEmail(email))
      .maybeSingle(),
    supabase
      .from("usuario")
      .select("rol")
      .ilike("email", patronEmail(email))
      .maybeSingle(),
  ]);

  if (ocupado) {
    return { message: "Ya hay otra persona con ese correo", ok: false };
  }

  if (cuenta?.rol === "majoriti" || cuenta?.rol === "comite") {
    return { message: "Esa cuenta no se puede agregar desde aquí", ok: false };
  }

  const { error } = await supabase.from("stakeholder").insert({
    apellido,
    email,
    estado_entrevista: "pendiente",
    firma,
    nombre,
    proyecto_id: proyectoId,
  });

  if (!error) {
    return {
      email,
      nombreCompleto: nombreCompleto(nombre, apellido),
      ok: true,
    };
  }

  if (error.code === "23505") {
    return { message: "Ya hay otra persona con ese correo", ok: false };
  }

  return { message: error.message, ok: false };
}
