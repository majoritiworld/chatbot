export type NombrePersona = {
  nombre: string;
  apellido: string | null;
};

export function partirNombre(completo: string): NombrePersona {
  const limpio = completo.trim().replace(/\s+/g, " ");
  if (!limpio) {
    return { apellido: null, nombre: "" };
  }

  const espacio = limpio.indexOf(" ");
  if (espacio === -1) {
    return { apellido: null, nombre: limpio };
  }

  return {
    apellido: limpio.slice(espacio + 1),
    nombre: limpio.slice(0, espacio),
  };
}

export function nombreCompleto(
  nombre: string | null | undefined,
  apellido?: string | null
) {
  return [nombre?.trim(), apellido?.trim()].filter(Boolean).join(" ");
}
