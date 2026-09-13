/** Canonical phase states. `fase.estado` is free text, so we normalize it. */
export type FaseEstado = "bloqueado" | "en_progreso" | "completado";

const ALIASES: Record<string, FaseEstado> = {
  bloqueado: "bloqueado",
  bloqueada: "bloqueado",
  pendiente: "bloqueado",
  en_progreso: "en_progreso",
  en_curso: "en_progreso",
  completado: "completado",
  completada: "completado",
};

export function normalizarEstado(estado: string): FaseEstado {
  return ALIASES[estado.trim().toLowerCase()] ?? "bloqueado";
}

export const ETIQUETA_ESTADO: Record<FaseEstado, string> = {
  bloqueado: "Bloqueado",
  en_progreso: "En progreso",
  completado: "Completado",
};
