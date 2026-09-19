import { expect, test } from "@playwright/test";
import {
  barrasDesdeOnda,
  clasificarErrorMicrofono,
  formatearDuracionGrabacion,
  mensajeErrorMicrofono,
  unirTextoTranscrito,
} from "@/lib/consultoria/entrevista-voz";

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

  test("maps time-domain samples to waveform bars", () => {
    const datos = Uint8Array.from([128, 255, 0, 128]);
    const barras = barrasDesdeOnda(datos, 4);
    expect(barras).toHaveLength(4);
    expect(barras[1]).toBeGreaterThan(0.9);
  });
});
