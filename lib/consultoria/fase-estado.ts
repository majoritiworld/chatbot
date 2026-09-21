/** Canonical phase states. `fase.estado` is free text, so we normalize it. */
export type FaseEstado = "bloqueado" | "en_progreso" | "completado";

const ALIASES: Record<string, FaseEstado> = {
  bloqueada: "bloqueado",
  bloqueado: "bloqueado",
  completada: "completado",
  completado: "completado",
  en_curso: "en_progreso",
  en_progreso: "en_progreso",
  pendiente: "bloqueado",
};

export function normalizarEstado(estado: string): FaseEstado {
  return ALIASES[estado.trim().toLowerCase()] ?? "bloqueado";
}

export const ETIQUETA_ESTADO: Record<FaseEstado, string> = {
  bloqueado: "Bloqueado",
  completado: "Completado",
  en_progreso: "En progreso",
};
