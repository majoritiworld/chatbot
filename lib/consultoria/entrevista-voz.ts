export type DemoVozEntrevista = "ok" | "denegado" | "sin-mic" | "fallo";

export type ModoVozEntrevista = DemoVozEntrevista | "microfono" | "transcribir";

export type ErrorMicrofono = "denegado" | "sin-mic" | "fallo";

export function esGrabacionSimulada(
  modo?: ModoVozEntrevista
): modo is DemoVozEntrevista {
  return (
    modo === "ok" ||
    modo === "denegado" ||
    modo === "sin-mic" ||
    modo === "fallo"
  );
}

export function esCapturaLocalSinEnvio(modo?: ModoVozEntrevista) {
  return modo === "microfono";
}

export function debeEnviarTranscripcion(modo?: ModoVozEntrevista) {
  return !modo || modo === "transcribir";
}

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

export const CANTIDAD_BARRAS_ONDA = 64;
export const INTERVALO_MUESTRA_ONDA_MS = 110;
const ANCHO_BARRA_ONDA = 2.75;
export const UMBRAL_SILENCIO_VISUAL = 0.07;
const RMS_SILENCIO = 0.008;
const RMS_VOZ_PLENA = 0.16;
const ATAQUE_ONDA = 0.5;
const CAIDA_ONDA = 0.1;

export function amplitudRmsSinContinua(muestras: ArrayLike<number>) {
  const n = muestras.length;
  if (n === 0) {
    return 0;
  }

  let suma = 0;
  for (let indice = 0; indice < n; indice += 1) {
    suma += muestras[indice] ?? 0;
  }
  const media = suma / n;
  let energia = 0;
  for (let indice = 0; indice < n; indice += 1) {
    const x = (muestras[indice] ?? 0) - media;
    energia += x * x;
  }

  return Math.sqrt(energia / n);
}

export function escalarAmplitudVisual(rms: number) {
  if (rms <= RMS_SILENCIO) {
    return 0;
  }

  return Math.min(1, rms / RMS_VOZ_PLENA);
}

export function suavizarAmplitud(actual: number, objetivo: number) {
  const factor = objetivo > actual ? ATAQUE_ONDA : CAIDA_ONDA;
  return actual + (objetivo - actual) * factor;
}

export function crearHistorialOnda() {
  return new Float32Array(CANTIDAD_BARRAS_ONDA);
}

export function avanzarHistorialOnda(historial: Float32Array, muestra: number) {
  historial.copyWithin(0, 1);
  historial[historial.length - 1] = muestra;
}

export function amplitudGuionSintetico(ms: number) {
  const ciclo = ms % 4000;
  if (ciclo < 900) {
    return 0.004;
  }
  if (ciclo < 1600) {
    return 0.035;
  }
  if (ciclo < 2800) {
    return 0.12;
  }

  return 0.006;
}

function barraRedondeada(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  radio: number
) {
  const r = Math.min(radio, ancho / 2, alto / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, ancho, alto, r);
  } else {
    ctx.rect(x, y, ancho, alto);
  }
  ctx.fill();
}

export function pintarOndaEnCanvas(
  canvas: HTMLCanvasElement | null,
  historial: Float32Array
) {
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  const pixelAncho = Math.max(1, Math.floor(ancho * dpr));
  const pixelAlto = Math.max(1, Math.floor(alto * dpr));
  if (canvas.width !== pixelAncho || canvas.height !== pixelAlto) {
    canvas.width = pixelAncho;
    canvas.height = pixelAlto;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dibujarHistorialOnda(ctx, historial, ancho, alto);
}

export function dibujarHistorialOnda(
  ctx: CanvasRenderingContext2D,
  historial: Float32Array,
  ancho: number,
  alto: number
) {
  ctx.clearRect(0, 0, ancho, alto);
  const n = historial.length;
  if (n === 0 || ancho <= 0 || alto <= 0) {
    return;
  }

  const barra = ANCHO_BARRA_ONDA;
  const hueco = n > 1 ? Math.max(2, (ancho - barra * n) / (n - 1)) : 0;
  const centro = alto / 2;

  for (let indice = 0; indice < n; indice += 1) {
    const x = indice * (barra + hueco);
    const valor = historial[indice] ?? 0;
    if (valor < UMBRAL_SILENCIO_VISUAL) {
      ctx.fillStyle = "#d4d4d4";
      ctx.beginPath();
      ctx.arc(x + barra / 2, centro, barra / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    const altura = Math.max(barra, valor * (alto - 4));
    ctx.fillStyle = "#8a8a8a";
    barraRedondeada(ctx, x, centro - altura / 2, barra, altura, barra / 2);
  }
}
