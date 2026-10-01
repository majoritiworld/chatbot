import "server-only";

import { Resend } from "resend";
import { asegurarEnlaceEntrevista } from "@/lib/consultoria/acceso-entrevista";
import { siteUrl } from "@/lib/consultoria/auth";
import { remitenteConNombre } from "@/lib/consultoria/comunicacion";
import {
  MENSAJES_BLOQUEO,
  type MotivoBloqueoCorreo,
} from "@/lib/consultoria/correos/asignacion";
import {
  permitirOrigenLocal,
  resolverAsignacionCorreo,
} from "@/lib/consultoria/correos/asignacion-servidor";
import {
  crearEnlaceAcceso,
  validarEnlaceAcceso,
} from "@/lib/consultoria/correos/enlace-acceso";
import { registrarIncidenciaCorreo } from "@/lib/consultoria/correos/incidencia";
import {
  type CorreoPreparado,
  correoConfirmacion,
  correoInvitacion,
} from "@/lib/consultoria/correos/variantes";
import { debeBloquearCorreoEntrevista } from "@/lib/consultoria/entrevista-piloto";
import {
  asuntoConPrefijoPrueba,
  debeRetenerCorreoColaboradores,
  esExcepcionEnvioPruebaColaboradores,
  excluirDeCampanaColaboradores,
} from "@/lib/consultoria/invitacion-colaboradores";
import { claveIdempotenciaConfirmacion } from "@/lib/consultoria/marca";
import { createAdminClient } from "@/lib/supabase/admin";

export class CorreoBloqueadoError extends Error {
  readonly motivo: MotivoBloqueoCorreo;

  constructor(motivo: MotivoBloqueoCorreo) {
    super(MENSAJES_BLOQUEO[motivo]);
    this.name = "CorreoBloqueadoError";
    this.motivo = motivo;
  }
}

const INVITACIONES_DESHABILITADAS =
  "El envío de invitaciones por correo no está habilitado";

/**
 * Invitations stay off until someone sets this explicitly. Checked again right
 * before Resend, so no caller can bypass it.
 */
export function invitacionesHabilitadas() {
  return process.env.HABILITAR_INVITACIONES_CORREO === "1";
}

function correoBloqueadoLocal() {
  return debeBloquearCorreoEntrevista({
    flag: process.env.BLOQUEAR_CORREO_ENTREVISTA,
    vercel: process.env.VERCEL,
  });
}

/** The team copy applies to confirmations only, never to access links. */
async function enviarCorreoPreparado({
  correo,
  idempotencyKey,
  copiarEquipo = true,
}: {
  correo: CorreoPreparado;
  idempotencyKey: string;
  copiarEquipo?: boolean;
}) {
  if (correo.tipo === "invitacion" && !invitacionesHabilitadas()) {
    throw new Error(INVITACIONES_DESHABILITADAS);
  }
  if (correoBloqueadoLocal()) {
    throw new Error("Correo bloqueado en el servidor local de prueba");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INTERVIEW_EMAIL_FROM;
  if (!(apiKey && from)) {
    throw new Error("El correo de la entrevista no está configurado");
  }

  const copiaEquipo =
    process.env.INTERVIEW_EMAIL_BCC?.trim() || "hello@majoriti.world";
  const copiar =
    copiarEquipo &&
    correo.tipo === "confirmacion" &&
    correo.destinatario.toLowerCase() !== copiaEquipo.toLowerCase();

  const baseUrl = process.env.RESEND_BASE_URL?.trim();
  const resend = baseUrl ? new Resend(apiKey, { baseUrl }) : new Resend(apiKey);
  const { data, error } = await resend.emails.send(
    {
      from: remitenteConNombre(from, correo.remitenteVisible),
      html: correo.html,
      replyTo: correo.replyTo,
      subject: correo.subject,
      text: correo.text,
      to: [correo.destinatario],
      ...(copiar && { bcc: [copiaEquipo] }),
    },
    { idempotencyKey }
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Recipient, brand and copy come from the interview on the server.
 * `emailEsperado` is the address the caller already authorized; a mismatch
 * blocks the send.
 */
export async function enviarCorreoAgradecimiento({
  emailEsperado,
  entrevistaId,
}: {
  emailEsperado?: string | null;
  entrevistaId: string;
}) {
  const resultado = await resolverAsignacionCorreo(
    entrevistaId,
    "confirmacion",
    emailEsperado
  );
  if (!resultado.ok) {
    if (!correoBloqueadoLocal()) {
      await registrarIncidenciaCorreo(
        entrevistaId,
        MENSAJES_BLOQUEO[resultado.motivo]
      );
    }
    throw new CorreoBloqueadoError(resultado.motivo);
  }

  const { asignacion } = resultado;
  const excepcion = esExcepcionEnvioPruebaColaboradores({
    email: asignacion.destinatario.email,
    entrevistaId,
    faseNombre: asignacion.faseNombre,
  });
  if (
    debeRetenerCorreoColaboradores(asignacion.faseNombre, {
      email: asignacion.destinatario.email,
      entrevistaId,
    })
  ) {
    throw new Error("El correo de esta fase sigue pendiente de confirmación.");
  }
  const correo = correoConfirmacion({
    destinatario: asignacion.destinatario,
    identidad: asignacion.identidad,
    siguientePaso: asignacion.textos.siguientePaso,
    textos: asignacion.textos.confirmacion,
  });

  try {
    const data = await enviarCorreoPreparado({
      copiarEquipo: !excepcion,
      correo,
      idempotencyKey: claveIdempotenciaConfirmacion(entrevistaId),
    });
    await registrarIncidenciaCorreo(entrevistaId, null);
    return data;
  } catch (error) {
    if (!correoBloqueadoLocal()) {
      const detalle = error instanceof Error ? error.message : "error";
      await registrarIncidenciaCorreo(
        entrevistaId,
        `No se pudo enviar el correo de confirmación: ${detalle}`
      );
    }
    throw error;
  }
}

export function claveIdempotenciaInvitacion(entrevistaId: string) {
  return `entrevista-${entrevistaId}-invitacion`;
}

/**
 * Not wired to any action. Refuses before reading anything while invitations
 * are disabled. The link is always built here from the assignment.
 */
export async function enviarCorreoInvitacion(entrevistaId: string) {
  if (!invitacionesHabilitadas()) {
    throw new Error(INVITACIONES_DESHABILITADAS);
  }

  const resultado = await resolverAsignacionCorreo(entrevistaId, "invitacion");
  if (!resultado.ok) {
    throw new CorreoBloqueadoError(resultado.motivo);
  }

  const { asignacion } = resultado;
  const excepcion = esExcepcionEnvioPruebaColaboradores({
    email: asignacion.destinatario.email,
    entrevistaId,
    faseNombre: asignacion.faseNombre,
  });
  if (
    debeRetenerCorreoColaboradores(asignacion.faseNombre, {
      email: asignacion.destinatario.email,
      entrevistaId,
    })
  ) {
    throw new Error(
      "El envío de invitaciones de esta fase sigue pendiente de confirmación."
    );
  }
  const contexto = {
    entrevistaId,
    permitirLocal: permitirOrigenLocal(),
    site: siteUrl(),
    slug: asignacion.slug,
  };
  const token = asignacion.accesoEnlacePersonal
    ? await asegurarEnlaceEntrevista(entrevistaId)
    : null;
  if (asignacion.accesoEnlacePersonal && !token) {
    throw new Error("No se pudo preparar el enlace personal de la entrevista");
  }
  const enlace = crearEnlaceAcceso({ ...contexto, token });
  if (!(enlace && validarEnlaceAcceso(enlace, { ...contexto, token }))) {
    throw new Error(
      "El enlace de acceso no corresponde al dominio autorizado de Majoriti"
    );
  }

  const textos = excepcion
    ? {
        ...asignacion.textos.invitacion,
        asunto: asuntoConPrefijoPrueba(
          asignacion.textos.invitacion.asunto ??
            `${asignacion.identidad.cliente} le invita a una entrevista`
        ),
      }
    : asignacion.textos.invitacion;
  const correo = correoInvitacion({
    destinatario: asignacion.destinatario,
    enlace,
    identidad: asignacion.identidad,
    minutos: asignacion.minutos,
    textos,
  });
  return await enviarCorreoPreparado({
    correo,
    idempotencyKey: claveIdempotenciaInvitacion(entrevistaId),
  });
}

export type ResultadoInvitacionesFase = {
  bloqueado?: string;
  enviados: number;
  errores: number;
  omitidos: number;
};

const SIN_ENVIOS = { enviados: 0, errores: 0, omitidos: 0 };

async function enviarEnOrden(
  pendientes: string[],
  registrar: (fila: {
    correo: string;
    detalle?: string;
    entrevistaId: string;
    estado: "enviado" | "error";
  }) => Promise<void>
): Promise<ResultadoInvitacionesFase> {
  const [entrevistaId, ...resto] = pendientes;
  if (!entrevistaId) {
    return { ...SIN_ENVIOS };
  }
  const destino = await resolverAsignacionCorreo(entrevistaId, "invitacion");
  const correo = destino.ok ? destino.asignacion.destinatario.email : "";
  let enviado = true;
  try {
    await enviarCorreoInvitacion(entrevistaId);
    await registrar({ correo, entrevistaId, estado: "enviado" });
  } catch (error) {
    enviado = false;
    await registrar({
      correo,
      detalle: error instanceof Error ? error.message : "Error de envío",
      entrevistaId,
      estado: "error",
    });
  }
  const siguiente = await enviarEnOrden(resto, registrar);
  return enviado
    ? { ...siguiente, enviados: siguiente.enviados + 1 }
    : { ...siguiente, errores: siguiente.errores + 1 };
}

/**
 * Every interview of one phase, through the common template. Refuses before
 * reading anything while invitations are off or the phase is held, and skips
 * interviews that already have a sent invitation.
 */
export async function enviarInvitacionesDeFase(
  faseId: string
): Promise<ResultadoInvitacionesFase> {
  if (!invitacionesHabilitadas()) {
    return { ...SIN_ENVIOS, bloqueado: INVITACIONES_DESHABILITADAS };
  }
  const admin = createAdminClient();
  if (!admin) {
    return { ...SIN_ENVIOS, bloqueado: "El servidor no puede leer la fase" };
  }
  const { data: fase } = await admin
    .from("fase")
    .select("nombre, acceso_solo_correo")
    .eq("id", faseId)
    .maybeSingle();
  if (fase?.acceso_solo_correo) {
    return {
      ...SIN_ENVIOS,
      bloqueado:
        "Esta fase entra solo con el correo y no envía invitaciones desde el portal.",
    };
  }
  if (!fase || debeRetenerCorreoColaboradores(fase.nombre)) {
    return {
      ...SIN_ENVIOS,
      bloqueado:
        "El envío de invitaciones de esta fase sigue pendiente de confirmación.",
    };
  }
  const { data: tareas } = await admin
    .from("tarea")
    .select("entrevista_id")
    .eq("fase_id", faseId)
    .eq("tipo", "entrevista")
    .not("entrevista_id", "is", null);
  const ids = (tareas ?? []).map((fila) => String(fila.entrevista_id));
  const { data: previos } = ids.length
    ? await admin
        .from("invitacion_envio")
        .select("entrevista_id")
        .eq("estado", "enviado")
        .in("entrevista_id", ids)
    : { data: [] };
  const { data: marcas } = ids.length
    ? await admin
        .from("entrevista")
        .select("id, stakeholder:stakeholder_id(email, firma)")
        .in("id", ids)
    : { data: [] };
  const yaEnviadas = new Set(
    (previos ?? []).map((fila) => String(fila.entrevista_id))
  );
  const pruebas = new Set<string>();
  for (const fila of marcas ?? []) {
    const stakeholder = Array.isArray(fila.stakeholder)
      ? fila.stakeholder[0]
      : fila.stakeholder;
    if (
      excluirDeCampanaColaboradores(fase.nombre, {
        correo: stakeholder?.email,
        empresa: stakeholder?.firma,
      })
    ) {
      pruebas.add(String(fila.id));
    }
  }
  const omitir = new Set([...yaEnviadas, ...pruebas]);
  const pendientes = ids.filter((id) => !omitir.has(id));
  const resultado = await enviarEnOrden(pendientes, async (fila) => {
    await admin.from("invitacion_envio").insert({
      correo: fila.correo,
      detalle: fila.detalle ?? null,
      entrevista_id: fila.entrevistaId,
      estado: fila.estado,
    });
  });
  return { ...resultado, omitidos: resultado.omitidos + omitir.size };
}
