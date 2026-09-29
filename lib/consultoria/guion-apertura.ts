/** Opening a phase page must not rewrite a guide that already exists. */
export function accionAlAbrirPlantillaGuion(existe: boolean) {
  return existe ? ("conservar" as const) : ("crear" as const);
}

/**
 * A later phase gets its own interview. An interview already in this phase
 * is left as it is, including its answers.
 */
export function decisionAsignacionNuevaFase(tieneEnEstaFase: boolean) {
  return tieneEnEstaFase ? ("omitir" as const) : ("crear" as const);
}
