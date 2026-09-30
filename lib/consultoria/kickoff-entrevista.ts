const kickoffsIniciados = new Set<string>();

export function claveKickoff(entrevistaId: string, seccionId: string) {
  return `${entrevistaId}:${seccionId}`;
}

export function reservarKickoff(clave: string) {
  if (kickoffsIniciados.has(clave)) {
    return false;
  }

  kickoffsIniciados.add(clave);
  return true;
}

export function liberarKickoff(clave: string) {
  kickoffsIniciados.delete(clave);
}

export function recordarKickoffHecho(clave: string) {
  kickoffsIniciados.add(clave);
}

export function reiniciarKickoffsParaPruebas() {
  kickoffsIniciados.clear();
}

export function textoKickoffEntrevista(haySeccionesPrevias: boolean) {
  if (haySeccionesPrevias) {
    return "Estoy listo para continuar con esta sección. No te presentes de nuevo ni expliques el tema: haz solo la primera pregunta.";
  }

  return "Estoy listo para comenzar. Saluda en una frase y haz de inmediato la primera pregunta, sin explicar el tema.";
}
