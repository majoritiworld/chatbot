import "server-only";

import { leerSesionEntrevista } from "@/lib/consultoria/acceso-entrevista";
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
import { createAdminClient } from "@/lib/supabase/admin";
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
  plantilla?: {
    fase?: { nombre?: string | null } | { nombre?: string | null }[] | null;
  } | null;
  stakeholder: StakeholderEmbed | StakeholderEmbed[];
  transcripcion: unknown;
  ultima_actividad: string | null;
};

const SELECT_ENTREVISTA = `
      id,
      estado,
      notion_transcripcion_id,
      fecha_completada,
      ultima_actividad,
      transcripcion,
      plantilla:plantilla_id ( fase:fase_id ( nombre ) ),
      stakeholder:stakeholder_id (
        nombre,
        apellido,
        firma,
        email,
        proyecto:proyecto_id ( nombre, cliente )
      )
    `;

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

  const data = await leerEntrevistaParaNotion(entrevistaId);

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
  const plantilla = asOne(row.plantilla);
  const fase = asOne(plantilla?.fase);
  const archivo = construirArchivoTranscripcion({
    fase: fase?.nombre ?? null,
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

async function leerEntrevistaParaNotion(entrevistaId: string) {
  const supabase = await createClient();
  const propia = await supabase
    .from("entrevista")
    .select(SELECT_ENTREVISTA)
    .eq("id", entrevistaId)
    .maybeSingle();
  if (propia.data) {
    return propia.data as EntrevistaNotionRow;
  }
  const sesion = await leerSesionEntrevista();
  if (sesion?.entrevistaId !== entrevistaId) {
    if (propia.error) {
      throw propia.error;
    }
    throw new Error("No encontramos la entrevista");
  }
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("No encontramos la entrevista");
  }
  const ajena = await admin
    .from("entrevista")
    .select(SELECT_ENTREVISTA)
    .eq("id", entrevistaId)
    .maybeSingle();
  if (ajena.error) {
    throw ajena.error;
  }
  if (!ajena.data) {
    throw new Error("No encontramos la entrevista");
  }
  return ajena.data as EntrevistaNotionRow;
}

async function marcarNotionSincronizado(entrevistaId: string, pageId: string) {
  const sesion = await leerSesionEntrevista();
  if (sesion?.entrevistaId === entrevistaId) {
    const admin = createAdminClient();
    if (!admin) {
      throw new Error("No se pudo guardar la página de Notion");
    }
    const { error } = await admin.rpc("mark_interview_notion_synced_enlace", {
      p_email: sesion.email,
      p_entrevista_id: entrevistaId,
      p_page_id: pageId,
    });
    if (error) {
      throw error;
    }
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_interview_notion_synced", {
    p_entrevista_id: entrevistaId,
    p_page_id: pageId,
  });
  if (error) {
    throw error;
  }
}
