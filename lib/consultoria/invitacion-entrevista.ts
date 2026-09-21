import "server-only";

import { z } from "zod";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { ensureAuthUser, siteUrl } from "@/lib/consultoria/auth";
import {
  type AsignacionInvitacion,
  ejecutarInvitacionEntrevista,
  emailRedirectToAuth,
  enlaceCallbackEntrevista,
  enlaceLoginEntrevista,
  pathEntrevista,
  type ResultadoInvitacionEntrevista,
  rutaEntrevistaPermitida,
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

const generateLinkProperties = z.object({
  hashed_token: z.string().min(1).optional(),
  hashedToken: z.string().min(1).optional(),
  verification_type: z.string().optional(),
  verificationType: z.string().optional(),
});

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

async function generarEnlaceInvitacionEntrevista({
  email,
  entrevistaId,
}: {
  email: string;
  entrevistaId: string;
}) {
  const destino = rutaEntrevistaPermitida(pathEntrevista(entrevistaId));
  const fallback = enlaceLoginEntrevista(siteUrl(), entrevistaId);
  if (!destino) {
    return fallback;
  }

  const admin = createAdminClient();
  if (!admin) {
    return fallback;
  }

  const { data, error } = await admin.auth.admin.generateLink({
    email,
    options: {
      redirectTo: emailRedirectToAuth(siteUrl(), destino),
    },
    type: "magiclink",
  });

  const properties = generateLinkProperties.safeParse(data?.properties);
  const hashedToken = properties.success
    ? (properties.data.hashed_token ?? properties.data.hashedToken)
    : undefined;
  const type =
    (properties.success
      ? (properties.data.verification_type ?? properties.data.verificationType)
      : undefined) ?? "magiclink";

  if (error || !hashedToken) {
    return fallback;
  }

  return enlaceCallbackEntrevista({
    entrevistaId,
    hashedToken,
    site: siteUrl(),
    type,
  });
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
    enviarCorreo: async ({ email, enlace, nombre }) => {
      await enviarCorreoInvitacionEntrevista({ email, enlace, nombre });
    },
    generarEnlace: generarEnlaceInvitacionEntrevista,
  });
}
