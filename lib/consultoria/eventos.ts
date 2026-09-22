import "server-only";

import type { EventoDelProyecto } from "@/lib/consultoria/fechas-relevantes";
import { createClient } from "@/lib/supabase/server";

type EventoRow = {
  id: string;
  titulo: string;
  fecha: string;
  participantes: string[] | null;
  minuta: string | null;
  google_event_id: string | null;
};

function toEvento(row: EventoRow): EventoDelProyecto {
  return {
    fecha: row.fecha,
    googleEventId: row.google_event_id,
    id: row.id,
    minuta: row.minuta?.trim() || null,
    participantes: row.participantes ?? [],
    titulo: row.titulo,
  };
}

export function parseParticipantes(raw: string): string[] {
  const vistos = new Set<string>();
  const nombres: string[] = [];

  for (const parte of raw.split(/[,;\n]/)) {
    const nombre = parte.trim();
    if (!nombre || vistos.has(nombre)) {
      continue;
    }
    vistos.add(nombre);
    nombres.push(nombre);
  }

  return nombres;
}

export function parseMinuta(raw: string): string | null {
  const minuta = raw.trim();
  if (!minuta) {
    return null;
  }
  return minuta;
}

export async function getEventosDelProyecto(
  proyectoId: string | null
): Promise<EventoDelProyecto[]> {
  if (!proyectoId) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("evento")
    .select("id, titulo, fecha, participantes, minuta, google_event_id")
    .eq("proyecto_id", proyectoId)
    .order("fecha")
    .order("titulo");

  if (error) {
    throw error;
  }

  return ((data ?? []) as EventoRow[]).map(toEvento);
}

export async function crearEventoEnProyecto({
  proyectoId,
  titulo,
  fechas,
  participantes,
}: {
  proyectoId: string;
  titulo: string;
  fechas: string[];
  participantes: string[];
}): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  if (fechas.length === 0) {
    return { message: "Indica al menos una fecha.", ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("evento").insert(
    fechas.map((fecha) => ({
      fecha,
      participantes,
      proyecto_id: proyectoId,
      titulo,
    }))
  );

  if (error) {
    return { message: error.message, ok: false };
  }

  return { count: fechas.length, ok: true };
}

export async function actualizarEventoEnProyecto({
  proyectoId,
  eventoId,
  titulo,
  fecha,
  participantes,
  minuta,
}: {
  proyectoId: string;
  eventoId: string;
  titulo: string;
  fecha: string;
  participantes: string[];
  minuta: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("evento")
    .update({
      fecha,
      minuta,
      participantes,
      titulo,
    })
    .eq("id", eventoId)
    .eq("proyecto_id", proyectoId);

  if (error) {
    return { message: error.message, ok: false };
  }

  return { ok: true };
}

export async function eliminarEventoDelProyecto({
  proyectoId,
  eventoId,
}: {
  proyectoId: string;
  eventoId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("evento")
    .delete()
    .eq("id", eventoId)
    .eq("proyecto_id", proyectoId);

  if (error) {
    return { message: error.message, ok: false };
  }

  return { ok: true };
}

export type EventoGoogleParaPortal = {
  fecha: string;
  googleEventId: string;
  participantes: string[];
  titulo: string;
};

export async function agregarEventosDeGoogle({
  proyectoId,
  eventos,
}: {
  proyectoId: string;
  eventos: EventoGoogleParaPortal[];
}): Promise<{ message: string; ok: true } | { message: string; ok: false }> {
  if (eventos.length === 0) {
    return { message: "No hay reuniones para agregar.", ok: false };
  }

  const supabase = await createClient();
  const ids = eventos.map((evento) => evento.googleEventId);
  const { data: existentes, error: errorLectura } = await supabase
    .from("evento")
    .select("google_event_id, proyecto_id")
    .in("google_event_id", ids);

  if (errorLectura) {
    return { message: errorLectura.message, ok: false };
  }

  const porId = new Map<string, string>();
  for (const fila of (existentes ?? []) as Array<{
    google_event_id: string;
    proyecto_id: string;
  }>) {
    porId.set(fila.google_event_id, fila.proyecto_id);
  }

  const nuevos = eventos.filter((evento) => !porId.has(evento.googleEventId));
  const enOtroPortal = eventos.filter((evento) => {
    const proyecto = porId.get(evento.googleEventId);
    return proyecto !== undefined && proyecto !== proyectoId;
  }).length;

  if (nuevos.length === 0) {
    if (enOtroPortal > 0) {
      return {
        message: "Esas reuniones ya están en otro portal.",
        ok: false,
      };
    }
    return { message: "Esas reuniones ya están en el calendario.", ok: true };
  }

  const { error } = await supabase.from("evento").insert(
    nuevos.map((evento) => ({
      fecha: evento.fecha,
      google_event_id: evento.googleEventId,
      participantes: evento.participantes,
      proyecto_id: proyectoId,
      titulo: evento.titulo,
    }))
  );

  if (error) {
    return { message: error.message, ok: false };
  }

  if (enOtroPortal > 0) {
    return {
      message: `Se agregaron ${nuevos.length}. ${enOtroPortal} ya estaban en otro portal.`,
      ok: true,
    };
  }

  if (nuevos.length === 1) {
    return { message: "Reunión agregada al calendario.", ok: true };
  }

  return {
    message: `Se agregaron ${nuevos.length} reuniones al calendario.`,
    ok: true,
  };
}
