export type DemoVozEntrevista = "ok" | "denegado" | "sin-mic" | "fallo";

export type ErrorMicrofono = "denegado" | "sin-mic" | "fallo";

export function unirTextoTranscrito(escrito: string, transcrito: string) {
  const previo = escrito.trim();
  const nuevo = transcrito.trim();
  if (!(previo && nuevo)) {
    return previo || nuevo;
  }

  return `${previo} ${nuevo}`;
}

export function formatearDuracionGrabacion(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutos = Math.floor(total / 60);
  const segundos = total % 60;
  return `${minutos}:${String(segundos).padStart(2, "0")}`;
}

export function clasificarErrorMicrofono(error: unknown): ErrorMicrofono {
  const nombre =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";

  if (nombre === "NotAllowedError" || nombre === "PermissionDeniedError") {
    return "denegado";
  }

  if (nombre === "NotFoundError" || nombre === "DevicesNotFoundError") {
    return "sin-mic";
  }

  return "fallo";
}

export function mensajeErrorMicrofono(tipo: ErrorMicrofono) {
  if (tipo === "denegado") {
    return "No hay permiso para usar el micrófono.";
  }

  if (tipo === "sin-mic") {
    return "No encontramos un micrófono.";
  }

  return "No se pudo acceder al micrófono.";
}

export function barrasDesdeOnda(datos: Uint8Array, cantidad = 24) {
  const paso = Math.max(1, Math.floor(datos.length / cantidad));
  const barras: number[] = [];

  for (let indice = 0; indice < cantidad; indice += 1) {
    const muestra = datos.at(indice * paso) ?? 128;
    barras.push(Math.min(1, Math.abs(muestra - 128) / 128));
  }

  return barras;
}

export function barrasSinteticas(instante: number, cantidad = 24) {
  const barras: number[] = [];

  for (let indice = 0; indice < cantidad; indice += 1) {
    barras.push(0.2 + 0.8 * Math.abs(Math.sin(instante / 160 + indice * 0.35)));
  }

  return barras;
}
