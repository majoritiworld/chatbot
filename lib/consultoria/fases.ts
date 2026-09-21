import "server-only";

import { estadoVisibleEntrevistaPortal } from "@/lib/consultoria/entrevista-piloto";
import { getUsuarioPerfil } from "@/lib/consultoria/entrevistas";
import {
  type FaseEstado,
  normalizarEstado,
} from "@/lib/consultoria/fase-estado";
import { nombreCompleto } from "@/lib/consultoria/nombre";
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

export type TareaDelPortal = {
  id: string;
  nombre: string;
  completada: boolean;
  esPropia: boolean;
  responsableNombre: string;
  createdAt: string;
};

export type FaseDelPortal = {
  id: string;
  nombre: string;
  orden: number;
  estado: FaseEstado;
  fechaEstimada: string | null;
  fechaCierre: string | null;
  descripcion: string | null;
  /** First interview id (compat); prefer `entrevistas` for multi-interview phases. */
  entrevistaId: string | null;
  entrevistas: EntrevistaDelPortal[];
  tareas: TareaDelPortal[];
};

type StakeholderEmbed = {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string;
  estado_entrevista: string;
} | null;

type EntrevistaEmbed = {
  id: string;
  consentimiento_en: string | null;
  estado: string;
  flujo_estado: string;
  stakeholder_id: string;
  stakeholder: StakeholderEmbed | StakeholderEmbed[];
} | null;

type AsignadoEmbed = {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
} | null;

type TareaRow = {
  id: string;
  tipo: string;
  nombre: string | null;
  estado: string;
  responsable: string | null;
  created_at: string;
  entrevista_id: string | null;
  entrevista: EntrevistaEmbed | EntrevistaEmbed[];
  asignado: AsignadoEmbed | AsignadoEmbed[] | null;
};

type FaseRow = {
  id: string;
  nombre: string;
  orden: number;
  estado: string;
  fecha_estimada: string | null;
  fecha_cierre: string | null;
  descripcion: string | null;
  tarea: TareaRow[] | null;
};

const FASE_SELECT = `
  id,
  nombre,
  orden,
  estado,
  fecha_estimada,
  fecha_cierre,
  descripcion,
  tarea(
    id,
    tipo,
    nombre,
    estado,
    responsable,
    created_at,
    entrevista_id,
    entrevista:entrevista_id (
      id,
      consentimiento_en,
      estado,
      flujo_estado,
      stakeholder_id,
      stakeholder:stakeholder_id ( id, nombre, apellido, email, estado_entrevista )
    ),
    asignado:stakeholder_id ( id, nombre, apellido, email )
  )
`;

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function nombreDelResponsable(
  asignado: AsignadoEmbed,
  responsable: string | null
) {
  return (
    nombreCompleto(asignado?.nombre, asignado?.apellido) ||
    responsable ||
    "Sin asignar"
  );
}


function toFaseDelPortal(
  row: FaseRow,
  viewerEmail: string | null
): FaseDelPortal {
  const email = viewerEmail?.toLowerCase() ?? null;
  const entrevistas: EntrevistaDelPortal[] = [];
  const tareas: TareaDelPortal[] = [];

  for (const tarea of row.tarea ?? []) {
    if (tarea.tipo === "general") {
      const nombre = tarea.nombre?.trim();
      if (!nombre) {
        continue;
      }

      const asignado = asOne(tarea.asignado);
      const emailAsignado = asignado?.email?.toLowerCase() ?? null;
      tareas.push({
        completada: tarea.estado === "completada",
        createdAt: tarea.created_at,
        esPropia: emailAsignado === null || emailAsignado === email,
        id: tarea.id,
        nombre,
        responsableNombre: nombreDelResponsable(asignado, tarea.responsable),
      });
      continue;
    }

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
      estado: estadoVisibleEntrevistaPortal({
        consentimientoEn: entrevista.consentimiento_en,
        entrevistaEstado: entrevista.estado,
        flujoEstado: entrevista.flujo_estado,
        stakeholderEstado: stakeholder.estado_entrevista,
      }),
      id: entrevista.id,
      puedeResponder: esPropia,
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
  tareas.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const propia = entrevistas.find((item) => item.esPropia);

  return {
    descripcion: row.descripcion,
    entrevistaId: propia?.id ?? entrevistas.at(0)?.id ?? null,
    entrevistas,
    estado: normalizarEstado(row.estado),
    fechaCierre: row.fecha_cierre,
    fechaEstimada: row.fecha_estimada,
    id: row.id,
    nombre: row.nombre,
    orden: row.orden,
    tareas,
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
  faseId: string,
  viewerEmail?: string | null
): Promise<FaseDelPortal | null> {
  if (!proyectoId) {
    return null;
  }

  const supabase = await createClient();
  const email =
    viewerEmail === undefined ? (await viewerContext()).email : viewerEmail;

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
