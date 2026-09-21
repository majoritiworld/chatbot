import { expect, test } from "@playwright/test";
import {
  amplitudRmsSinContinua,
  avanzarHistorialOnda,
  clasificarErrorMicrofono,
  crearHistorialOnda,
  debeEnviarTranscripcion,
  esCapturaLocalSinEnvio,
  escalarAmplitudVisual,
  esGrabacionSimulada,
  formatearDuracionGrabacion,
  mensajeErrorMicrofono,
  suavizarAmplitud,
  unirTextoTranscrito,
} from "@/lib/consultoria/entrevista-voz";

function seno(amplitud: number, n = 512) {
  return Float32Array.from(
    { length: n },
    (_, indice) => amplitud * Math.sin((indice / n) * Math.PI * 8)
  );
}

test.describe("Interview voice helpers", () => {
  test("keeps written text and appends the transcript", () => {
    expect(unirTextoTranscrito("Hola", "mundo")).toBe("Hola mundo");
    expect(unirTextoTranscrito("", "solo audio")).toBe("solo audio");
    expect(unirTextoTranscrito("  escrito  ", "  ")).toBe("escrito");
  });

  test("formats recording duration and classifies microphone errors", () => {
    expect(formatearDuracionGrabacion(0)).toBe("0:00");
    expect(formatearDuracionGrabacion(65_000)).toBe("1:05");
    expect(clasificarErrorMicrofono({ name: "NotAllowedError" })).toBe(
      "denegado"
    );
    expect(clasificarErrorMicrofono({ name: "NotFoundError" })).toBe("sin-mic");
    expect(mensajeErrorMicrofono("denegado")).toContain("permiso");
  });

  test("measures time-domain RMS after removing DC, without peak-normalizing", () => {
    const silencio = Float32Array.from({ length: 256 }, () => 0);
    const continua = Float32Array.from({ length: 256 }, () => 0.4);
    const suave = seno(0.04);
    const normal = seno(0.12);
    expect(amplitudRmsSinContinua(silencio)).toBeCloseTo(0, 3);
    expect(amplitudRmsSinContinua(continua)).toBeCloseTo(0, 3);
    expect(amplitudRmsSinContinua(suave)).toBeGreaterThan(0.02);
    expect(amplitudRmsSinContinua(suave)).toBeLessThan(
      amplitudRmsSinContinua(normal)
    );
    expect(escalarAmplitudVisual(0.004)).toBe(0);
    expect(
      escalarAmplitudVisual(amplitudRmsSinContinua(suave))
    ).toBeGreaterThan(0.08);
    expect(
      escalarAmplitudVisual(amplitudRmsSinContinua(normal))
    ).toBeGreaterThan(0.4);
    expect(escalarAmplitudVisual(amplitudRmsSinContinua(normal))).toBeLessThan(
      1
    );
  });

  test("smooths with a fast rise, slow fall, and right-aligned history", () => {
    let nivel = 0;
    nivel = suavizarAmplitud(nivel, 0.8);
    expect(nivel).toBeGreaterThan(0.35);
    const trasAtaque = nivel;
    nivel = suavizarAmplitud(nivel, 0);
    expect(nivel).toBeGreaterThan(trasAtaque * 0.7);
    const historial = crearHistorialOnda();
    avanzarHistorialOnda(historial, 0.4);
    expect(historial.at(-1)).toBeCloseTo(0.4);
    avanzarHistorialOnda(historial, 0.9);
    expect(historial.at(-2)).toBeCloseTo(0.4);
    expect(historial.at(-1)).toBeCloseTo(0.9);
  });

  test("sends transcription on the product path and keeps local capture off it", () => {
    expect(esGrabacionSimulada("ok")).toBe(true);
    expect(esGrabacionSimulada("microfono")).toBe(false);
    expect(esCapturaLocalSinEnvio("microfono")).toBe(true);
    expect(debeEnviarTranscripcion("microfono")).toBe(false);
    expect(debeEnviarTranscripcion("transcribir")).toBe(true);
    expect(debeEnviarTranscripcion()).toBe(true);
  });
});
