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

export type GrupoPais<T> = { pais: string | null; personas: T[] };

export type GrupoFirma<T> = {
  firma: string | null;
  paises: GrupoPais<T>[];
  total: number;
};

/** Below this, a flat list reads better than collapsed firms. */
const MINIMO_PARA_AGRUPAR_POR_FIRMA = 7;

function clave(valor: string | null | undefined) {
  const texto = valor?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}

function compararConVaciosAlFinal(a: string | null, b: string | null) {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

export function convieneAgruparPorFirma(
  personas: { firma: string | null }[]
): boolean {
  if (personas.length < MINIMO_PARA_AGRUPAR_POR_FIRMA) {
    return false;
  }
  return new Set(personas.map((persona) => clave(persona.firma))).size > 1;
}

/** Firms alphabetically, then countries; missing firm or country goes last. */
export function agruparPorFirmaYPais<
  T extends { firma: string | null; pais: string | null },
>(personas: T[]): GrupoFirma<T>[] {
  const firmas = new Map<string | null, Map<string | null, T[]>>();

  for (const persona of personas) {
    const firma = clave(persona.firma);
    const pais = clave(persona.pais);
    const paises = firmas.get(firma) ?? new Map<string | null, T[]>();
    const lista = paises.get(pais) ?? [];
    lista.push(persona);
    paises.set(pais, lista);
    firmas.set(firma, paises);
  }

  return [...firmas.entries()]
    .sort(([a], [b]) => compararConVaciosAlFinal(a, b))
    .map(([firma, paises]) => {
      const grupos = [...paises.entries()]
        .sort(([a], [b]) => compararConVaciosAlFinal(a, b))
        .map(([pais, lista]) => ({ pais, personas: lista }));
      return {
        firma,
        paises: grupos,
        total: grupos.reduce((suma, grupo) => suma + grupo.personas.length, 0),
      };
    });
}

export function resumenCantidad(
  n: number,
  singular: string,
  plural: string
): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}
