import "server-only";

import { getUsuarioPerfil } from "@/lib/consultoria/entrevistas";
import { type FaseEstado, normalizarEstado } from "@/lib/consultoria/fase-estado";
import { createClient } from "@/lib/supabase/server";

export type EntrevistaDelPortal = {
  id: string;
  /** "pendiente" | "en_curso" | "completada" (and any other stakeholder estado). */
  estado: string;
  stakeholderId: string;
  stakeholderNombre: string;
  esPropia: boolean;
  /** Whether the current user may open/respond to this interview. */
  puedeResponder: boolean;
};

export type FaseDelPortal = {
  id: string;
  nombre: string;
  orden: number;
  estado: FaseEstado;
  fechaEstimada: string | null;
  /** First interview id (compat); prefer `entrevistas` for multi-interview phases. */
  entrevistaId: string | null;
  entrevistas: EntrevistaDelPortal[];
};

type StakeholderEmbed = {
  id: string;
  nombre: string;
  email: string;
  estado_entrevista: string;
} | null;

type EntrevistaEmbed = {
  id: string;
  estado: string;
  ultima_actividad: string | null;
  stakeholder_id: string;
  stakeholder: StakeholderEmbed | StakeholderEmbed[];
} | null;

type TareaRow = {
  tipo: string;
  entrevista_id: string | null;
  entrevista: EntrevistaEmbed | EntrevistaEmbed[];
};

type FaseRow = {
  id: string;
  nombre: string;
  orden: number;
  estado: string;
  fecha_estimada: string | null;
  tarea: TareaRow[] | null;
};

const FASE_SELECT = `
  id,
  nombre,
  orden,
  estado,
  fecha_estimada,
  tarea(
    tipo,
    entrevista_id,
    entrevista:entrevista_id (
      id,
      estado,
      ultima_actividad,
      stakeholder_id,
      stakeholder:stakeholder_id ( id, nombre, email, estado_entrevista )
    )
  )
`;

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function estadoVisible(
  entrevistaEstado: string,
  stakeholderEstado: string,
  ultimaActividad: string | null
) {
  if (entrevistaEstado === "completada" || stakeholderEstado === "completada") {
    return "completada";
  }
  if (stakeholderEstado === "en_curso" || ultimaActividad) {
    return "en_curso";
  }
  return stakeholderEstado || "pendiente";
}

function toFaseDelPortal(
  row: FaseRow,
  viewerEmail: string | null
): FaseDelPortal {
  const email = viewerEmail?.toLowerCase() ?? null;
  const entrevistas: EntrevistaDelPortal[] = [];

  for (const tarea of row.tarea ?? []) {
    if (tarea.tipo !== "entrevista" || !tarea.entrevista_id) {
      continue;
    }

    const entrevista = asOne(tarea.entrevista);
    if (!entrevista) {
      continue;
    }

    const stakeholder = asOne(entrevista.stakeholder);
    if (!stakeholder) {
      continue;
    }

    const esPropia = Boolean(
      email && stakeholder.email.toLowerCase() === email
    );

    entrevistas.push({
      esPropia,
      estado: estadoVisible(
        entrevista.estado,
        stakeholder.estado_entrevista,
        entrevista.ultima_actividad
      ),
      id: entrevista.id,
      puedeResponder: esPropia,
      stakeholderId: stakeholder.id,
      stakeholderNombre: stakeholder.nombre,
    });
  }

  entrevistas.sort((a, b) =>
    a.stakeholderNombre.localeCompare(b.stakeholderNombre, "es")
  );

  const propia = entrevistas.find((item) => item.esPropia);

  return {
    entrevistaId: propia?.id ?? entrevistas.at(0)?.id ?? null,
    entrevistas,
    estado: normalizarEstado(row.estado),
    fechaEstimada: row.fecha_estimada,
    id: row.id,
    nombre: row.nombre,
    orden: row.orden,
  };
}

async function viewerContext() {
  const context = await getUsuarioPerfil();
  return {
    email: context?.user.email ?? null,
  };
}

export async function getProyecto(proyectoId: string | null) {
  if (!proyectoId) {
    return null;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("proyecto")
    .select("id, nombre, cliente, fecha_comite")
    .eq("id", proyectoId)
    .maybeSingle();

  return data;
}

export async function getFasesDelProyecto(
  proyectoId: string | null
): Promise<FaseDelPortal[]> {
  if (!proyectoId) {
    return [];
  }

  const [{ email }, supabase] = await Promise.all([
    viewerContext(),
    createClient(),
  ]);

  const { data, error } = await supabase
    .from("fase")
    .select(FASE_SELECT)
    .eq("proyecto_id", proyectoId)
    .order("orden");

  if (error) {
    throw error;
  }

  return ((data ?? []) as FaseRow[]).map((row) => toFaseDelPortal(row, email));
}

export async function getFase(
  proyectoId: string | null,
  faseId: string
): Promise<FaseDelPortal | null> {
  if (!proyectoId) {
    return null;
  }

  const [{ email }, supabase] = await Promise.all([
    viewerContext(),
    createClient(),
  ]);

  const { data, error } = await supabase
    .from("fase")
    .select(FASE_SELECT)
    .eq("proyecto_id", proyectoId)
    .eq("id", faseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toFaseDelPortal(data as FaseRow, email) : null;
}
