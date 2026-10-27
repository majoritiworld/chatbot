import "server-only";

import { patronEmail } from "@/lib/consultoria/auth";
import {
  type DatosEnlaceAbierto,
  LIMITE_DIARIO_ENLACE_ABIERTO,
  seccionesParaNuevaEntrevista,
} from "@/lib/consultoria/enlace-abierto-reglas";
import { slugValido } from "@/lib/consultoria/marca";
import { hashTokenEnlace } from "@/lib/consultoria/sesion-entrevista";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

export type FaseEnlaceAbierto = {
  faseId: string;
  proyectoId: string;
};

type FilaFase = {
  acceso_enlace_personal: boolean | null;
  id: string;
  proyecto: { slug: string | null } | { slug: string | null }[] | null;
  proyecto_id: string;
};

/** The phase behind an open link, only under its own project's address. */
export async function faseDeEnlaceAbierto(
  slugCrudo: string,
  token: string
): Promise<FaseEnlaceAbierto | null> {
  const admin = createAdminClient();
  const slug = slugValido(slugCrudo);
  const limpio = token.trim();
  if (!(admin && slug && limpio)) {
    return null;
  }
  const { data, error } = await admin
    .from("fase")
    .select(
      "id, proyecto_id, acceso_enlace_personal, proyecto:proyecto_id ( slug )"
    )
    .eq("enlace_abierto_hash", hashTokenEnlace(limpio))
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const fila = data as unknown as FilaFase;
  const proyecto = Array.isArray(fila.proyecto)
    ? fila.proyecto.at(0)
    : fila.proyecto;
  if (
    fila.acceso_enlace_personal !== true ||
    slugValido(proyecto?.slug ?? null) !== slug
  ) {
    return null;
  }
  return { faseId: fila.id, proyectoId: fila.proyecto_id };
}

async function limiteAlcanzado(admin: Admin, faseId: string) {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("tarea")
    .select("id", { count: "exact", head: true })
    .eq("fase_id", faseId)
    .eq("tipo", "entrevista")
    .gte("created_at", desde);
  return Boolean(error) || (count ?? 0) >= LIMITE_DIARIO_ENLACE_ABIERTO;
}

async function plantillaDeFase(admin: Admin, fase: FaseEnlaceAbierto) {
  const { data, error } = await admin
    .from("entrevista_plantilla")
    .select(
      "id, preguntas, secciones, instrucciones_agente, trato, formato_resumen, contexto_entrevista"
    )
    .eq("fase_id", fase.faseId)
    .eq("proyecto_id", fase.proyectoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data;
}

/** Reuses the person when the email is already in the project. */
async function personaDelProyecto(
  admin: Admin,
  proyectoId: string,
  datos: DatosEnlaceAbierto
) {
  const { data: existentes, error } = await admin
    .from("stakeholder")
    .select("id")
    .eq("proyecto_id", proyectoId)
    .ilike("email", patronEmail(datos.email))
    .order("id")
    .limit(1);
  if (error) {
    return null;
  }
  const existente = existentes?.at(0);
  if (existente) {
    return { creada: false, id: existente.id as string };
  }
  const { data: creada, error: errorCreada } = await admin
    .from("stakeholder")
    .insert({
      email: datos.email,
      estado_entrevista: "pendiente",
      firma: datos.empresa,
      nombre: datos.nombre,
      proyecto_id: proyectoId,
    })
    .select("id")
    .single();
  if (errorCreada || !creada) {
    return null;
  }
  return { creada: true, id: creada.id as string };
}

export type ResultadoEnlaceAbierto =
  | { ok: true; entrevistaId: string }
  | { ok: false; motivo: "limite" | "error" };

/**
 * A new interview from the phase template, every time. The same email may
 * end up with more than one interview in the phase: that is intended.
 */
export async function crearEntrevistaDeEnlaceAbierto(
  fase: FaseEnlaceAbierto,
  datos: DatosEnlaceAbierto
): Promise<ResultadoEnlaceAbierto> {
  const admin = createAdminClient();
  if (!admin) {
    return { motivo: "error", ok: false };
  }
  if (await limiteAlcanzado(admin, fase.faseId)) {
    return { motivo: "limite", ok: false };
  }
  const plantilla = await plantillaDeFase(admin, fase);
  const secciones = seccionesParaNuevaEntrevista(plantilla?.secciones, () =>
    crypto.randomUUID()
  );
  if (!plantilla || secciones.length === 0) {
    return { motivo: "error", ok: false };
  }
  const persona = await personaDelProyecto(admin, fase.proyectoId, datos);
  if (!persona) {
    return { motivo: "error", ok: false };
  }

  const deshacerPersona = async () => {
    if (persona.creada) {
      await admin.from("stakeholder").delete().eq("id", persona.id);
    }
  };

  const { data: entrevista, error: errorEntrevista } = await admin
    .from("entrevista")
    .insert({
      contexto_entrevista: plantilla.contexto_entrevista,
      estado: "abierta",
      formato_resumen: plantilla.formato_resumen,
      instrucciones_agente: plantilla.instrucciones_agente,
      origen: "enlace_abierto",
      plantilla_id: plantilla.id,
      preguntas: plantilla.preguntas,
      secciones,
      stakeholder_id: persona.id,
      trato: plantilla.trato,
    })
    .select("id")
    .single();
  if (errorEntrevista || !entrevista) {
    await deshacerPersona();
    return { motivo: "error", ok: false };
  }

  const { error: errorTarea } = await admin.from("tarea").insert({
    entrevista_id: entrevista.id,
    fase_id: fase.faseId,
    responsable: datos.nombre,
    tipo: "entrevista",
  });
  if (errorTarea) {
    await admin.from("entrevista").delete().eq("id", entrevista.id);
    await deshacerPersona();
    return { motivo: "error", ok: false };
  }

  return { entrevistaId: entrevista.id as string, ok: true };
}
