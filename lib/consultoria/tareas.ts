import "server-only";

import { nombreCompleto } from "@/lib/consultoria/nombre";
import { getFaseDelProyecto } from "@/lib/consultoria/provisioning";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esUuid(value: string) {
  return UUID.test(value);
}

export type PersonaDelProyecto = {
  id: string;
  nombre: string;
  apellido: string | null;
  nombreCompleto: string;
};

export type TareaDeFaseAdmin = {
  id: string;
  nombre: string;
  estado: string;
  stakeholderId: string | null;
  stakeholderNombre: string;
};

type AsignadoEmbed = {
  id: string;
  nombre: string;
  apellido: string | null;
} | null;

type TareaAdminRow = {
  id: string;
  nombre: string | null;
  estado: string;
  responsable: string | null;
  stakeholder_id: string | null;
  asignado: AsignadoEmbed | AsignadoEmbed[] | null;
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function nombreResponsable(row: TareaAdminRow) {
  const asignado = asOne(row.asignado);
  return (
    nombreCompleto(asignado?.nombre, asignado?.apellido) ||
    row.responsable ||
    "Sin asignar"
  );
}

export async function listPersonasDelProyecto(
  proyectoId: string
): Promise<PersonaDelProyecto[]> {
  if (!esUuid(proyectoId)) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stakeholder")
    .select("id, nombre, apellido")
    .eq("proyecto_id", proyectoId)
    .order("nombre")
    .order("apellido");

  if (error) {
    throw error;
  }

  return (data ?? []).map((persona) => ({
    apellido: persona.apellido,
    id: persona.id,
    nombre: persona.nombre,
    nombreCompleto: nombreCompleto(persona.nombre, persona.apellido),
  }));
}

export async function listTareasDeFaseAdmin(
  faseId: string
): Promise<TareaDeFaseAdmin[]> {
  if (!esUuid(faseId)) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tarea")
    .select(
      `
      id,
      nombre,
      estado,
      responsable,
      stakeholder_id,
      asignado:stakeholder_id ( id, nombre, apellido )
    `
    )
    .eq("fase_id", faseId)
    .eq("tipo", "general")
    .order("created_at");

  if (error) {
    throw error;
  }

  const tareas: TareaDeFaseAdmin[] = [];

  for (const row of (data ?? []) as TareaAdminRow[]) {
    const nombre = row.nombre?.trim();
    if (!nombre) {
      continue;
    }

    tareas.push({
      estado: row.estado,
      id: row.id,
      nombre,
      stakeholderId: asOne(row.asignado)?.id ?? row.stakeholder_id,
      stakeholderNombre: nombreResponsable(row),
    });
  }

  return tareas;
}

export async function crearTareaEnFase({
  proyectoId,
  faseId,
  nombre,
  stakeholderId,
}: {
  proyectoId: string;
  faseId: string;
  nombre: string;
  stakeholderId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const fase = await getFaseDelProyecto(proyectoId, faseId);
  if (!fase) {
    return { message: "Esa fase no es de este proyecto", ok: false };
  }

  const supabase = await createClient();
  const { data: persona } = await supabase
    .from("stakeholder")
    .select("id, nombre, apellido, proyecto_id")
    .eq("id", stakeholderId)
    .maybeSingle();

  if (!persona || persona.proyecto_id !== proyectoId) {
    return {
      message: "Elige a alguien que ya esté en este proyecto",
      ok: false,
    };
  }

  const { error } = await supabase.from("tarea").insert({
    estado: "pendiente",
    fase_id: faseId,
    nombre,
    responsable: nombreCompleto(persona.nombre, persona.apellido),
    stakeholder_id: persona.id,
    tipo: "general",
  });

  if (error) {
    return { message: error.message, ok: false };
  }

  return { ok: true };
}

export async function eliminarTareaDeFase({
  proyectoId,
  faseId,
  tareaId,
}: {
  proyectoId: string;
  faseId: string;
  tareaId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const fase = await getFaseDelProyecto(proyectoId, faseId);
  if (!fase) {
    return { message: "Esa fase no es de este proyecto", ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tarea")
    .delete()
    .eq("id", tareaId)
    .eq("fase_id", faseId)
    .eq("tipo", "general");

  if (error) {
    return { message: error.message, ok: false };
  }

  return { ok: true };
}

type FaseEmbed = {
  estado: string;
  proyecto_id: string;
} | null;

type TareaMarcaRow = {
  id: string;
  fase: FaseEmbed | FaseEmbed[] | null;
};

export async function marcarTareaDelPortal({
  proyectoId,
  tareaId,
  completada,
}: {
  proyectoId: string | null;
  tareaId: string;
  completada: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!proyectoId) {
    return { message: "No encontramos tu proyecto", ok: false };
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("tarea")
    .select("id, fase:fase_id ( estado, proyecto_id )")
    .eq("id", tareaId)
    .eq("tipo", "general")
    .maybeSingle();

  const tarea = data as TareaMarcaRow | null;
  const fase = asOne(tarea?.fase);

  if (!(tarea && fase) || fase.proyecto_id !== proyectoId) {
    return { message: "No encontramos esa tarea", ok: false };
  }

  if (fase.estado === "bloqueado") {
    return { message: "Esta fase todavía está bloqueada", ok: false };
  }

  const { data: actualizada, error } = await supabase
    .from("tarea")
    .update({ estado: completada ? "completada" : "pendiente" })
    .eq("id", tareaId)
    .eq("tipo", "general")
    .select("id")
    .maybeSingle();

  if (error) {
    return { message: error.message, ok: false };
  }

  if (!actualizada) {
    return { message: "No se pudo actualizar la tarea", ok: false };
  }

  return { ok: true };
}
