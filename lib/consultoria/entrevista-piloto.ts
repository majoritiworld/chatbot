import type { FlujoEntrevista } from "@/lib/consultoria/entrevista-contenido";

export function consentimientoEntrevistaListo(
  consentimientoEn: string | null | undefined
) {
  return Boolean(consentimientoEn);
}

export function siguienteTransicionInicial(
  flujoEstado: FlujoEntrevista,
  seccionActual: number
): "bienvenida" | "presentacion" | null {
  if (flujoEstado === "bienvenida") {
    return "bienvenida";
  }

  if (flujoEstado === "presentacion" && seccionActual === 0) {
    return "presentacion";
  }

  return null;
}

export async function encadenarAvanceInicial({
  avanzar,
  flujoEstado,
  seccionActual,
  signal,
}: {
  avanzar: (desde: "bienvenida" | "presentacion") => Promise<FlujoEntrevista>;
  flujoEstado: FlujoEntrevista;
  seccionActual: number;
  signal?: { cancelled: boolean };
}): Promise<FlujoEntrevista> {
  let flujo = flujoEstado;

  while (true) {
    if (signal?.cancelled) {
      return flujo;
    }

    const paso = siguienteTransicionInicial(flujo, seccionActual);
    if (!paso) {
      return flujo;
    }

    // Sequential RPCs: each step requires the previous flujo_estado.
    // biome-ignore lint/performance/noAwaitInLoops: valid interview transitions cannot run in parallel
    flujo = await avanzar(paso);
  }
}

export function etiquetaProgresoTema(indice: number, numeroSecciones: number) {
  return `Tema ${indice + 1} de ${numeroSecciones}`;
}

export function etiquetaCierreTema(esUltimo: boolean) {
  return esUltimo ? "Finalizar entrevista" : "Cerrar y continuar";
}

export function etiquetaCierreAnticipado() {
  return "Terminar este tema antes de tiempo";
}

export function avisoCierreAnticipado(esUltimo: boolean) {
  if (esUltimo) {
    return "Todavía hay preguntas pendientes de este tema. Si confirmas, se cierra el tema, se entrega la entrevista y ya no podrás agregar más.";
  }

  return "Todavía hay preguntas pendientes de este tema. Puedes seguir respondiendo o confirmar el cierre.";
}

export function etiquetaConfirmarCierreAnticipado(esUltimo: boolean) {
  return esUltimo ? "Finalizar y entregar" : "Cerrar este tema";
}

export function etiquetaAccionCierreAnticipado({
  busy,
  esUltimo,
  mostrarError,
}: {
  busy: boolean;
  esUltimo: boolean;
  mostrarError: boolean;
}) {
  if (busy) {
    if (esUltimo) {
      return "Finalizando entrevista…";
    }
    return "Cerrando tema…";
  }
  if (mostrarError) {
    return "Reintentar";
  }
  return etiquetaConfirmarCierreAnticipado(esUltimo);
}

export function avisoBorradorCierreAnticipado() {
  return "Ese texto no se envía. Puedes seguir editándolo, o descartarlo y confirmar el cierre.";
}

export function puntosAyudaEntrevista() {
  return [
    "Las preguntas aparecen en el chat. Responde una a una, por escrito o con Hablar.",
    "Guardar conserva las respuestas ya enviadas de este tema. El texto que todavía no enviaste no se guarda.",
    "Cuando un tema está cubierto, ciérralo para pasar al siguiente. En el último, Finalizar entrevista guarda y entrega tus respuestas; después aparece la pantalla de gracias.",
  ] as const;
}

export function avisoEntregaAlFinalizar() {
  return "Al finalizar se enviarán tus respuestas y la entrevista quedará cerrada. Ya no podrás agregar más.";
}

export function muestraPantallaRevision({
  errorEntrega,
  flujoEstado,
  llegoEnRevision,
}: {
  errorEntrega: boolean;
  flujoEstado: FlujoEntrevista;
  llegoEnRevision: boolean;
}) {
  return flujoEstado === "revision" && (llegoEnRevision || errorEntrega);
}

export type PantallaParticipanteEntrevista =
  | "completada"
  | "onboarding"
  | "finalizando"
  | "entrega_pendiente"
  | "avance"
  | "chat";

export function pantallaParticipanteEntrevista({
  completada,
  errorEntrega,
  flujoEstado,
  llegoEnRevision,
  onboardingListo,
  seccionActual,
}: {
  completada: boolean;
  errorEntrega: boolean;
  flujoEstado: FlujoEntrevista;
  llegoEnRevision: boolean;
  onboardingListo: boolean;
  seccionActual: number;
}): PantallaParticipanteEntrevista {
  if (completada) {
    return "completada";
  }

  if (!onboardingListo) {
    return "onboarding";
  }

  if (flujoEstado === "revision") {
    if (
      muestraPantallaRevision({
        errorEntrega,
        flujoEstado,
        llegoEnRevision,
      })
    ) {
      return "entrega_pendiente";
    }

    return "finalizando";
  }

  if (siguienteTransicionInicial(flujoEstado, seccionActual) !== null) {
    return "avance";
  }

  return "chat";
}

export function textoFinalizandoEntrevista() {
  return "Finalizando entrevista…";
}

export function explicacionEntregaPendiente() {
  return "Los temas ya están cerrados. Todavía falta entregar tus respuestas; la entrevista no está enviada.";
}

export function etiquetaEntregaPendiente({
  errorEntrega,
  pending,
}: {
  errorEntrega: boolean;
  pending: boolean;
}) {
  if (pending) {
    return textoFinalizandoEntrevista();
  }

  if (errorEntrega) {
    return "Reintentar finalización";
  }

  return "Finalizar entrevista";
}

export function textoTemasTerminados(numeroSecciones: number) {
  if (numeroSecciones === 1) {
    return "Terminaste el tema.";
  }

  return `Terminaste los ${numeroSecciones} temas.`;
}

export function entrevistaAceptaChat(
  consentimientoEn: string | null | undefined
) {
  return Boolean(consentimientoEn);
}

export function salidaEntrevistaInsegura({
  guardadoEnCurso,
  hayBorrador,
  ocupadoChat,
}: {
  guardadoEnCurso: boolean;
  hayBorrador: boolean;
  ocupadoChat: boolean;
}) {
  return hayBorrador || guardadoEnCurso || ocupadoChat;
}

export function avisoGuardadoRespuestas(hayBorrador: boolean) {
  if (hayBorrador) {
    return "Respuestas guardadas. El texto que aún no enviaste no se guardó.";
  }

  return "Respuestas guardadas. Puedes salir y continuar después.";
}

export function mensajeSalidaInsegura({
  guardadoEnCurso,
  hayBorrador,
  ocupadoChat,
}: {
  guardadoEnCurso: boolean;
  hayBorrador: boolean;
  ocupadoChat: boolean;
}) {
  if (guardadoEnCurso || ocupadoChat) {
    return "Hay un envío o guardado en curso. Si sales ahora, puede no haberse conservado.";
  }

  if (hayBorrador) {
    return "Tienes texto sin enviar. Las respuestas ya enviadas siguen; el borrador no se guarda.";
  }

  return null;
}

export type DecisionReintentoCorreo =
  | "no_enviada"
  | "ya_enviado"
  | "sin_email"
  | "reintentar";

export function decisionReintentoCorreo({
  correoAgradecimientoEn,
  email,
  estado,
}: {
  correoAgradecimientoEn: string | null | undefined;
  email: string | null | undefined;
  estado: string;
}): DecisionReintentoCorreo {
  if (estado !== "completada") {
    return "no_enviada";
  }

  if (correoAgradecimientoEn) {
    return "ya_enviado";
  }

  if (!email) {
    return "sin_email";
  }

  return "reintentar";
}

export function debeBloquearCorreoEntrevista({
  flag,
  vercel,
}: {
  flag: string | undefined;
  vercel: string | undefined;
}) {
  return flag === "1" && vercel !== "1";
}

export type EstadoEntregaEntrevista =
  | "revision"
  | "enviando"
  | "enviada"
  | "entrega_fallida"
  | "enviada_correo_pendiente";

export function estadoEntregaEntrevista({
  completada,
  correoPendiente,
  enviando,
  errorEntrega,
}: {
  completada: boolean;
  correoPendiente: boolean;
  enviando: boolean;
  errorEntrega: boolean;
}): EstadoEntregaEntrevista {
  if (enviando) {
    return "enviando";
  }

  if (errorEntrega && !completada) {
    return "entrega_fallida";
  }

  if (completada && correoPendiente) {
    return "enviada_correo_pendiente";
  }

  if (completada) {
    return "enviada";
  }

  return "revision";
}

const borradoresEntrevista = new Map<string, string>();

export function claveBorradorEntrevista(
  entrevistaId: string | undefined,
  seccionId: string | undefined
) {
  if (!(entrevistaId && seccionId)) {
    return null;
  }

  return `${entrevistaId}:${seccionId}`;
}

export function debeConfirmarCierrePorBorrador(texto: string) {
  return texto.trim().length > 0;
}

export function leerBorradorEntrevista(
  entrevistaId: string | undefined,
  seccionId: string | undefined
) {
  const clave = claveBorradorEntrevista(entrevistaId, seccionId);
  if (!clave) {
    return "";
  }

  return borradoresEntrevista.get(clave) ?? "";
}

export function escribirBorradorEntrevista(
  entrevistaId: string | undefined,
  seccionId: string | undefined,
  texto: string
) {
  const clave = claveBorradorEntrevista(entrevistaId, seccionId);
  if (!clave) {
    return;
  }

  if (texto.trim().length === 0) {
    borradoresEntrevista.delete(clave);
    return;
  }

  borradoresEntrevista.set(clave, texto);
}

export function reiniciarBorradoresEntrevistaParaPruebas() {
  borradoresEntrevista.clear();
}
