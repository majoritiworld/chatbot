import type { RolPortal } from "@/lib/consultoria/roles";

export function agruparPersonasPorAcceso<
  T extends { rolPortal: RolPortal | null },
>(personas: T[]): { clientes: T[]; stakeholders: T[] } {
  const clientes: T[] = [];
  const stakeholders: T[] = [];

  for (const persona of personas) {
    if (persona.rolPortal === "cliente") {
      clientes.push(persona);
    } else {
      stakeholders.push(persona);
    }
  }

  return { clientes, stakeholders };
}

export function resumenCantidad(
  n: number,
  singular: string,
  plural: string
): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}
