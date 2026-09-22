import "server-only";

import {
  construirArchivoTranscripcion,
  parseTranscripcion,
  tituloTranscripcion,
} from "@/lib/consultoria/entrevista-contenido";
import { nombreCompleto } from "@/lib/consultoria/nombre";
import {
  configuracionNotionTranscripcion,
  urlPaginaNotion,
} from "@/lib/consultoria/notion-transcripcion-contenido";
import { publicarPaginaTranscripcionNotion } from "@/lib/consultoria/notion-transcripcion-publicar";
import { createClient } from "@/lib/supabase/server";

type NotionFetch = typeof fetch;

export type ResultadoNotionTranscripcion =
  | { status: "skipped" }
  | { pageId: string; status: "alreadyDone"; url: string }
  | { pageId: string; status: "created"; url: string };

type ProyectoEmbed = { cliente?: string | null; nombre: string } | null;
type StakeholderEmbed = {
  apellido: string | null;
  email?: string | null;
  firma: string | null;
  nombre: string;
  proyecto: ProyectoEmbed | ProyectoEmbed[] | null;
} | null;

type EntrevistaNotionRow = {
  estado: string;
  fecha_completada: string | null;
  id: string;
  notion_transcripcion_id: string | null;
  stakeholder: StakeholderEmbed | StakeholderEmbed[];
  transcripcion: unknown;
  ultima_actividad: string | null;
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export async function sincronizarTranscripcionNotion(
  entrevistaId: string,
  fetchImpl: NotionFetch = fetch
): Promise<ResultadoNotionTranscripcion> {
  const config = configuracionNotionTranscripcion({
    databaseId: process.env.NOTION_TRANSCRIPCIONES_DATABASE_ID,
    token: process.env.NOTION_API_KEY,
  });
  if (!config) {
    return { status: "skipped" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entrevista")
    .select(
      `
      id,
      estado,
      notion_transcripcion_id,
      fecha_completada,
      ultima_actividad,
      transcripcion,
      stakeholder:stakeholder_id (
        nombre,
        apellido,
        firma,
        email,
        proyecto:proyecto_id ( nombre, cliente )
      )
    `
    )
    .eq("id", entrevistaId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("No encontramos la entrevista");
  }

  const row = data as EntrevistaNotionRow;
  if (row.estado !== "completada") {
    throw new Error("La entrevista todavía no está completada");
  }

  if (row.notion_transcripcion_id) {
    return {
      pageId: row.notion_transcripcion_id,
      status: "alreadyDone",
      url: urlPaginaNotion(row.notion_transcripcion_id),
    };
  }

  const stakeholder = asOne(row.stakeholder);
  const proyecto = asOne(stakeholder?.proyecto);
  const nombre =
    nombreCompleto(stakeholder?.nombre, stakeholder?.apellido) || "Entrevista";
  const archivo = construirArchivoTranscripcion({
    fecha: row.fecha_completada ?? row.ultima_actividad,
    firma: stakeholder?.firma ?? null,
    nombre,
    proyecto: proyecto?.nombre ?? null,
    turnos: parseTranscripcion(row.transcripcion),
  });
  const titulo = tituloTranscripcion(nombre);
  const publicado = await publicarPaginaTranscripcionNotion({
    config,
    datos: {
      email: stakeholder?.email ?? null,
      estado: row.estado,
      fecha: row.fecha_completada ?? row.ultima_actividad,
      firma: stakeholder?.firma ?? null,
      markdown: archivo.content,
      nombre,
      proyectoCliente: proyecto?.cliente ?? null,
      proyectoNombre: proyecto?.nombre ?? null,
      titulo,
    },
    fetchImpl,
  });

  await marcarNotionSincronizado(entrevistaId, publicado.pageId);
  return {
    pageId: publicado.pageId,
    status: publicado.status,
    url: urlPaginaNotion(publicado.pageId),
  };
}

async function marcarNotionSincronizado(entrevistaId: string, pageId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_interview_notion_synced", {
    p_entrevista_id: entrevistaId,
    p_page_id: pageId,
  });
  if (error) {
    throw error;
  }
}
