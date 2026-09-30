/** Safe copy for the participant. Nothing here names roles, ids, or internals. */
export const MENSAJE_NO_PUEDE_RESPONDER =
  "No puedes responder esta entrevista.";

export const MENSAJE_CUENTA_NO_PUEDE_RESPONDER =
  "No puedes responder esta entrevista desde esta cuenta.";

export const MENSAJE_ACEPTA_INDICACIONES =
  "Acepta las indicaciones antes de empezar la entrevista.";

export const MENSAJE_ENTREVISTA_COMPLETADA = "La entrevista ya está completada";

export const MENSAJE_SECCION_INACTIVA = "Esta sección ya no está activa";

export const MENSAJE_ACEPTACION_NO_REGISTRADA =
  "No se pudo registrar la aceptación. Inténtalo de nuevo.";

const MENSAJES_PUBLICOS = new Set<string>([
  MENSAJE_ACEPTA_INDICACIONES,
  MENSAJE_ACEPTACION_NO_REGISTRADA,
  MENSAJE_CUENTA_NO_PUEDE_RESPONDER,
  MENSAJE_ENTREVISTA_COMPLETADA,
  MENSAJE_NO_PUEDE_RESPONDER,
  MENSAJE_SECCION_INACTIVA,
]);

export function mensajePublico(detalle: string | undefined, respaldo: string) {
  if (detalle && MENSAJES_PUBLICOS.has(detalle)) {
    return detalle;
  }
  return respaldo;
}
