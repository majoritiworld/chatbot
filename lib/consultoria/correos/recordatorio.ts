import {
  evaluarAsignacionCorreo,
  type FilasAsignacionCorreo,
} from "@/lib/consultoria/correos/asignacion";
import { crearEnlaceAcceso } from "@/lib/consultoria/correos/enlace-acceso";
import {
  type CorreoPreparado,
  correoConfirmacion,
  correoInvitacion,
} from "@/lib/consultoria/correos/variantes";
import {
  ASUNTO_RECORDATORIO_ETM,
  CUERPO_RECORDATORIO_ETM,
} from "@/lib/consultoria/guiones/etm-tuesday";

export type FilaRecordatorio = {
  estado: "completada" | "en_curso" | "pendiente";
};

/** Reminder audience: anyone who has not finished. Completed rows stay out. */
export function destinatariosRecordatorio<T extends FilaRecordatorio>(
  filas: T[]
) {
  return filas.filter((fila) => fila.estado !== "completada");
}

/**
 * Preview only. Uses the invitation renderer and is not called from any send
 * path. The link is the same personal link; nothing here talks to Resend.
 */
export function correoRecordatorio({
  filasAsignacion,
  permitirLocal,
  site,
  token,
}: {
  filasAsignacion: FilasAsignacionCorreo;
  permitirLocal: boolean;
  site: string;
  token: string;
}): CorreoPreparado | { error: string } {
  const resultado = evaluarAsignacionCorreo(filasAsignacion, {
    permitirLocal,
    site,
  });
  if (!resultado.ok) {
    return { error: resultado.motivo };
  }
  const { asignacion } = resultado;
  const enlace = crearEnlaceAcceso({
    entrevistaId: asignacion.entrevistaId,
    permitirLocal,
    site,
    slug: asignacion.slug,
    token,
  });
  if (!enlace) {
    return { error: "origen_no_autorizado" };
  }
  return correoInvitacion({
    destinatario: asignacion.destinatario,
    enlace,
    identidad: asignacion.identidad,
    minutos: asignacion.minutos,
    textos: {
      asunto: ASUNTO_RECORDATORIO_ETM,
      cuerpo: CUERPO_RECORDATORIO_ETM,
      firma: asignacion.textos.invitacion.firma,
      remitente: asignacion.textos.invitacion.remitente,
    },
  });
}

export function correoAgradecimientoPreview({
  filasAsignacion,
  permitirLocal,
  site,
}: {
  filasAsignacion: FilasAsignacionCorreo;
  permitirLocal: boolean;
  site: string;
}): CorreoPreparado | { error: string } {
  const resultado = evaluarAsignacionCorreo(filasAsignacion, {
    permitirLocal,
    site,
  });
  if (!resultado.ok) {
    return { error: resultado.motivo };
  }
  const { asignacion } = resultado;
  return correoConfirmacion({
    destinatario: asignacion.destinatario,
    identidad: asignacion.identidad,
    siguientePaso: asignacion.textos.siguientePaso,
    textos: asignacion.textos.confirmacion,
  });
}
