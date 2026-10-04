import "server-only";

import { Resend } from "resend";
import { asegurarEnlaceEntrevista } from "@/lib/consultoria/acceso-entrevista";
import { siteUrl } from "@/lib/consultoria/auth";
import { remitenteConNombre } from "@/lib/consultoria/comunicacion";
import {
  type AsignacionCorreo,
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
  ASUNTO_INVITACION_MENTOREADO_CORTO,
  cuerpoInvitacionMentoreadoCorto,
  NOMBRE_FASE_MENTOREADOS,
} from "@/lib/consultoria/guiones/etm-tuesday";
import { nombrePropioCorto } from "@/lib/consultoria/inicio-en-chat";
import {
  asuntoConPrefijoPrueba,
  confirmacionSinCopia,
  debeRetenerCorreoColaboradores,
  esExcepcionEnvioPruebaColaboradores,
  excluirDeCampanaColaboradores,
  pendientesDeLote,
  tratoDeInvitacion,
} from "@/lib/consultoria/invitacion-colaboradores";
import {
  copiaOcultaEtm,
  debeRetenerCorreoEtm,
  esFaseEtm,
  esPruebaSebaEtm,
} from "@/lib/consultoria/invitacion-etm";
import { claveIdempotenciaConfirmacion } from "@/lib/consultoria/marca";
import {
  detalleEnvioAceptado,
  dormirMs,
  ErrorEnvioCorreo,
  ejecutarEnvioConReintentos,
  leerRetryAfterMs,
  ritmoInvitacionDesdeEntorno,
} from "@/lib/consultoria/ritmo-invitacion";
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

function retenidoEtm(faseNombre: string | null, email: string) {
  return debeRetenerCorreoEtm(faseNombre, {
    email,
    resendBaseUrl: process.env.RESEND_BASE_URL,
  });
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
  copiaOculta = null,
}: {
  correo: CorreoPreparado;
  idempotencyKey: string;
  copiarEquipo?: boolean;
  /** Explicit hidden copy for this one mail, any type. */
  copiaOculta?: string | null;
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
  let resultado: Awaited<ReturnType<typeof resend.emails.send>>;
  try {
    resultado = await resend.emails.send(
      {
        from: remitenteConNombre(from, correo.remitenteVisible),
        html: correo.html,
        replyTo: correo.replyTo,
        subject: correo.subject,
        text: correo.text,
        to: [correo.destinatario],
        ...(copiar && { bcc: [copiaEquipo] }),
        ...(copiaOculta && { bcc: [copiaOculta] }),
      },
      { idempotencyKey }
    );
  } catch (error) {
    throw new ErrorEnvioCorreo(
      {
        codigo: "network",
        message:
          error instanceof Error
            ? error.message
            : "No hubo respuesta del proveedor",
        retryAfterMs: null,
        statusCode: null,
      },
      { cause: error }
    );
  }

  if (resultado.error) {
    throw new ErrorEnvioCorreo({
      codigo: resultado.error.name,
      message: resultado.error.message,
      retryAfterMs: leerRetryAfterMs(resultado.headers),
      statusCode: resultado.error.statusCode,
    });
  }

  return resultado.data;
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
    }) ||
    retenidoEtm(asignacion.faseNombre, asignacion.destinatario.email)
  ) {
    throw new Error("El correo de esta fase sigue pendiente de confirmación.");
  }
  const etm = esFaseEtm(asignacion.faseNombre);
  const textosConfirmacion = asignacion.textos.confirmacion;
  const correo = correoConfirmacion({
    destinatario: asignacion.destinatario,
    identidad: asignacion.identidad,
    siguientePaso: etm ? null : asignacion.textos.siguientePaso,
    textos: esPruebaSebaEtm(
      asignacion.faseNombre,
      asignacion.destinatario.email
    )
      ? {
          ...textosConfirmacion,
          asunto: asuntoConPrefijoPrueba(
            textosConfirmacion.asunto ?? "Recibimos tus respuestas"
          ),
        }
      : textosConfirmacion,
    trato: etm ? "tu" : "usted",
  });

  try {
    const data = await enviarCorreoPreparado({
      copiaOculta: copiaOcultaEtm(
        asignacion.faseNombre,
        asignacion.destinatario.email
      ),
      copiarEquipo: !(
        etm ||
        excepcion ||
        confirmacionSinCopia(asignacion.faseNombre)
      ),
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
  const correo = await prepararCorreoInvitacion(entrevistaId);
  return await enviarCorreoPreparado({
    correo,
    idempotencyKey: claveIdempotenciaInvitacion(entrevistaId),
  });
}

function invitacionMentoreadoCorta(asignacion: AsignacionCorreo) {
  if (asignacion.faseNombre !== NOMBRE_FASE_MENTOREADOS) {
    return null;
  }
  const emprendimiento = nombrePropioCorto(asignacion.destinatario.firma);
  if (!emprendimiento) {
    return null;
  }
  return {
    ...asignacion.textos.invitacion,
    asunto: ASUNTO_INVITACION_MENTOREADO_CORTO,
    cuerpo: cuerpoInvitacionMentoreadoCorto(emprendimiento),
  };
}

async function prepararCorreoInvitacion(entrevistaId: string) {
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
    }) ||
    retenidoEtm(asignacion.faseNombre, asignacion.destinatario.email)
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

  const mentoreado = invitacionMentoreadoCorta(asignacion);
  const textosBase = mentoreado ?? asignacion.textos.invitacion;
  const textos =
    excepcion ||
    esPruebaSebaEtm(asignacion.faseNombre, asignacion.destinatario.email)
      ? {
          ...textosBase,
          asunto: asuntoConPrefijoPrueba(
            textosBase.asunto ??
              `${asignacion.identidad.cliente} le invita a una entrevista`
          ),
        }
      : textosBase;
  const correo = correoInvitacion({
    destinatario: asignacion.destinatario,
    enlace,
    identidad: mentoreado
      ? { ...asignacion.identidad, titulo: ASUNTO_INVITACION_MENTOREADO_CORTO }
      : asignacion.identidad,
    minutos: asignacion.minutos,
    textos,
    trato: esFaseEtm(asignacion.faseNombre)
      ? "tu"
      : tratoDeInvitacion(asignacion.faseNombre),
  });
  return correo;
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
  }) => Promise<"nuevo" | "ya">,
  ritmo: { intentosMaximos: number; intervaloMs: number },
  dormir: (ms: number) => Promise<void>
): Promise<ResultadoInvitacionesFase> {
  const [entrevistaId, ...resto] = pendientes;
  if (!entrevistaId) {
    return { ...SIN_ENVIOS };
  }
  const destino = await resolverAsignacionCorreo(entrevistaId, "invitacion");
  const correoDestino = destino.ok ? destino.asignacion.destinatario.email : "";
  let cuenta: "enviado" | "error" | "omitido" = "enviado";
  try {
    const correo = await prepararCorreoInvitacion(entrevistaId);
    const idempotencyKey = claveIdempotenciaInvitacion(entrevistaId);
    const aceptado = await ejecutarEnvioConReintentos({
      dormir,
      enviar: async () =>
        await enviarCorreoPreparado({ correo, idempotencyKey }),
      intentosMaximos: ritmo.intentosMaximos,
      intervaloBaseMs: ritmo.intervaloMs,
    });
    const marca = await registrar({
      correo: correoDestino,
      detalle: detalleEnvioAceptado(aceptado?.id) ?? undefined,
      entrevistaId,
      estado: "enviado",
    });
    if (marca === "ya") {
      cuenta = "omitido";
    }
  } catch (error) {
    cuenta = "error";
    await registrar({
      correo: correoDestino,
      detalle: error instanceof Error ? error.message : "Error de envío",
      entrevistaId,
      estado: "error",
    });
  }
  if (resto.length > 0 && ritmo.intervaloMs > 0) {
    await dormir(ritmo.intervaloMs);
  }
  const siguiente = await enviarEnOrden(resto, registrar, ritmo, dormir);
  if (cuenta === "enviado") {
    return { ...siguiente, enviados: siguiente.enviados + 1 };
  }
  if (cuenta === "omitido") {
    return { ...siguiente, omitidos: siguiente.omitidos + 1 };
  }
  return { ...siguiente, errores: siguiente.errores + 1 };
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
  if (
    !fase ||
    debeRetenerCorreoColaboradores(fase.nombre) ||
    debeRetenerCorreoEtm(fase.nombre)
  ) {
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
        .select("id, estado, stakeholder:stakeholder_id(email, firma)")
        .in("id", ids)
    : { data: [] };
  const yaEnviadas = new Set(
    (previos ?? []).map((fila) => String(fila.entrevista_id))
  );
  const sinCorreo = new Set<string>();
  const pruebas = new Set<string>();
  const completadas = new Set<string>();
  for (const fila of marcas ?? []) {
    const stakeholder = Array.isArray(fila.stakeholder)
      ? fila.stakeholder[0]
      : fila.stakeholder;
    const entrevistaId = String(fila.id);
    if (fila.estado === "completada") {
      completadas.add(entrevistaId);
    }
    if (!stakeholder?.email?.trim()) {
      sinCorreo.add(entrevistaId);
    }
    if (
      excluirDeCampanaColaboradores(fase.nombre, {
        correo: stakeholder?.email,
        empresa: stakeholder?.firma,
      })
    ) {
      pruebas.add(entrevistaId);
    }
  }
  const lote = pendientesDeLote(ids, {
    completadas,
    enviados: yaEnviadas,
    pruebas,
    sinCorreo,
  });
  const resultado = await enviarEnOrden(
    lote.pendientes,
    async (fila) => {
      const { error } = await admin.from("invitacion_envio").insert({
        correo: fila.correo,
        detalle: fila.detalle ?? null,
        entrevista_id: fila.entrevistaId,
        estado: fila.estado,
      });
      if (error?.code === "23505") {
        return "ya";
      }
      if (error) {
        throw new Error(error.message);
      }
      return "nuevo";
    },
    ritmoInvitacionDesdeEntorno(process.env),
    dormirMs
  );
  return { ...resultado, omitidos: resultado.omitidos + lote.omitidos };
}

export type ResultadoInvitacionEtm =
  | { estado: "enviado"; resendId: string | null }
  | { detalle: string | null; estado: "ya_enviada" };

/**
 * One ETM trial invitation. A second call after an accepted send does not
 * mail again: the stored send wins, and Resend dedupes the same key.
 */
export async function enviarInvitacionPruebaEtm(
  entrevistaId: string
): Promise<ResultadoInvitacionEtm> {
  if (!invitacionesHabilitadas()) {
    throw new Error(INVITACIONES_DESHABILITADAS);
  }
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("El servidor no puede leer la entrevista");
  }
  const { data: previa, error: errorPrevia } = await admin
    .from("invitacion_envio")
    .select("detalle")
    .eq("entrevista_id", entrevistaId)
    .eq("estado", "enviado")
    .maybeSingle();
  if (errorPrevia) {
    throw new Error(errorPrevia.message);
  }
  if (previa) {
    return { detalle: previa.detalle, estado: "ya_enviada" };
  }
  const destino = await resolverAsignacionCorreo(entrevistaId, "invitacion");
  if (!destino.ok) {
    throw new CorreoBloqueadoError(destino.motivo);
  }
  if (!esFaseEtm(destino.asignacion.faseNombre)) {
    throw new Error("Esta entrevista no es de ETM Tuesday.");
  }
  const correoDestino = destino.asignacion.destinatario.email;
  const ritmo = ritmoInvitacionDesdeEntorno(process.env);
  try {
    const correo = await prepararCorreoInvitacion(entrevistaId);
    const aceptado = await ejecutarEnvioConReintentos({
      dormir: dormirMs,
      enviar: async () =>
        await enviarCorreoPreparado({
          copiaOculta: copiaOcultaEtm(
            destino.asignacion.faseNombre,
            correoDestino
          ),
          copiarEquipo: false,
          correo,
          idempotencyKey: claveIdempotenciaInvitacion(entrevistaId),
        }),
      intentosMaximos: ritmo.intentosMaximos,
      intervaloBaseMs: ritmo.intervaloMs,
    });
    const { error } = await admin.from("invitacion_envio").insert({
      correo: correoDestino,
      detalle: detalleEnvioAceptado(aceptado?.id),
      entrevista_id: entrevistaId,
      estado: "enviado",
    });
    if (error && error.code !== "23505") {
      throw new Error(
        `Resend aceptó el envío (${aceptado?.id ?? "sin id"}), pero no quedó registrado: ${error.message}`
      );
    }
    return { estado: "enviado", resendId: aceptado?.id ?? null };
  } catch (error) {
    await admin.from("invitacion_envio").insert({
      correo: correoDestino,
      detalle: error instanceof Error ? error.message : "Error de envío",
      entrevista_id: entrevistaId,
      estado: "error",
    });
    throw error;
  }
}
