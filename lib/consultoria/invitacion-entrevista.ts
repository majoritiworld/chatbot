import "server-only";

import { requireAdminUser } from "@/lib/consultoria/admin";
import { ensureAuthUser, siteUrl } from "@/lib/consultoria/auth";
import {
  type AsignacionInvitacion,
  ejecutarInvitacionEntrevista,
  enlacePortal,
  type ResultadoInvitacionEntrevista,
} from "@/lib/consultoria/destino-entrevista";
import { enviarCorreoInvitacionEntrevista } from "@/lib/consultoria/email-entrevista";
import { nombreCompleto } from "@/lib/consultoria/nombre";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** List metadata only; choosing an invitation must not use an arbitrary row. */
export async function listarEntrevistasInvitables(
  proyectoId: string,
  stakeholderId: string
) {
  await requireAdminUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entrevista")
    .select(
      "id, estado, plantilla:plantilla_id (nombre), stakeholder:stakeholder_id!inner(proyecto_id)"
    )
    .eq("stakeholder_id", stakeholderId)
    .eq("stakeholder.proyecto_id", proyectoId)
    .order("id");
  if (error) {
    throw new Error("No se pudieron cargar las entrevistas para invitar.");
  }
  return (data ?? []).map((fila) => {
    const plantilla = Array.isArray(fila.plantilla)
      ? fila.plantilla.at(0)
      : fila.plantilla;
    return {
      estado: fila.estado,
      id: fila.id,
      nombre: plantilla?.nombre ?? "Entrevista",
    };
  });
}

async function cargarAsignacionInvitacion(
  entrevistaId: string
): Promise<AsignacionInvitacion | null> {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }

  const { data } = await admin
    .from("entrevista")
    .select("id, stakeholder:stakeholder_id (email, nombre, apellido)")
    .eq("id", entrevistaId)
    .maybeSingle();

  const stakeholder = data?.stakeholder;
  const fila = Array.isArray(stakeholder) ? stakeholder.at(0) : stakeholder;
  const email = fila?.email?.trim();
  if (!(data && fila && email)) {
    return null;
  }

  return {
    email,
    entrevistaId: data.id,
    nombre: nombreCompleto(fila.nombre, fila.apellido) || null,
  };
}

export async function enviarInvitacionEntrevista(
  entrevistaId: string
): Promise<ResultadoInvitacionEntrevista> {
  return await ejecutarInvitacionEntrevista({
    asegurarCuenta: async ({ email, nombre }) => {
      const cuenta = await ensureAuthUser({ email, nombre });
      if (!cuenta.ok) {
        return { ok: false };
      }

      return { creada: cuenta.creada, ok: true };
    },
    cargarAsignacion: cargarAsignacionInvitacion,
    entrevistaId,
    enviarCorreo: async ({ email, nombre }) => {
      await enviarCorreoInvitacionEntrevista({
        email,
        nombre,
        portal: enlacePortal(siteUrl()),
      });
    },
  });
}
