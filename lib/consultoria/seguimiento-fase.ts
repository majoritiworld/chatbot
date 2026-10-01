import "server-only";

import { estadoVisibleEntrevistaPortal } from "@/lib/consultoria/entrevista-piloto";
import { esParticipantePruebaColaboradores } from "@/lib/consultoria/invitacion-colaboradores";
import { nombreCompleto } from "@/lib/consultoria/nombre";
import {
  type FilaSeguimiento,
  type FilaSeguimientoCruda,
  type FiltroSeguimiento,
  paginarSeguimiento,
} from "@/lib/consultoria/seguimiento-pagina";
import { createClient } from "@/lib/supabase/server";

export type {
  FilaSeguimiento,
  FiltroSeguimiento,
  PaginaSeguimiento,
} from "@/lib/consultoria/seguimiento-pagina";
export {
  filtroDesdeParametros,
  paginarSeguimiento,
  TAMANOS_PAGINA,
} from "@/lib/consultoria/seguimiento-pagina";

function estadoDe(valor: string): FilaSeguimiento["estado"] {
  if (valor === "completada" || valor === "en_curso") {
    return valor;
  }
  return "pendiente";
}

export async function listarSeguimientoFase(
  faseId: string,
  filtro: FiltroSeguimiento
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tarea")
    .select(
      `
      entrevista:entrevista_id (
        id,
        estado,
        flujo_estado,
        consentimiento_en,
        ultima_actividad,
        stakeholder:stakeholder_id (
          nombre,
          apellido,
          email,
          firma,
          pais,
          cargo,
          estado_entrevista
        )
      )
    `
    )
    .eq("fase_id", faseId)
    .eq("tipo", "entrevista");

  if (error) {
    throw error;
  }

  const filas: FilaSeguimientoCruda[] = [];
  for (const tarea of data ?? []) {
    const entrevista = Array.isArray(tarea.entrevista)
      ? tarea.entrevista[0]
      : tarea.entrevista;
    if (!entrevista) {
      continue;
    }
    const stakeholder = Array.isArray(entrevista.stakeholder)
      ? entrevista.stakeholder[0]
      : entrevista.stakeholder;
    if (!stakeholder) {
      continue;
    }
    filas.push({
      actividad: entrevista.ultima_actividad,
      cargo: stakeholder.cargo,
      correo: stakeholder.email,
      empresa: stakeholder.firma,
      entrevistaId: entrevista.id,
      estado: estadoDe(
        estadoVisibleEntrevistaPortal({
          consentimientoEn: entrevista.consentimiento_en,
          entrevistaEstado: entrevista.estado,
          flujoEstado: entrevista.flujo_estado,
          stakeholderEstado: stakeholder.estado_entrevista,
        })
      ),
      nombre:
        nombreCompleto(stakeholder.nombre, stakeholder.apellido) ||
        stakeholder.email,
      pais: stakeholder.pais,
    });
  }

  const visibles = filas.filter(
    (fila) =>
      !esParticipantePruebaColaboradores({
        correo: fila.correo,
        empresa: fila.empresa,
      })
  );
  const ids = visibles.map((fila) => fila.entrevistaId);
  const invitaciones = new Map<string, "enviado" | "error">();
  if (ids.length > 0) {
    const { data: envios } = await supabase
      .from("invitacion_envio")
      .select("entrevista_id, estado, enviado_en")
      .in("entrevista_id", ids)
      .order("enviado_en", { ascending: false });
    for (const envio of envios ?? []) {
      if (invitaciones.has(envio.entrevista_id)) {
        continue;
      }
      if (envio.estado === "enviado" || envio.estado === "error") {
        invitaciones.set(envio.entrevista_id, envio.estado);
      }
    }
  }

  return paginarSeguimiento(visibles, invitaciones, filtro);
}
