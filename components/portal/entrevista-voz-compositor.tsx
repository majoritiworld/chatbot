"use client";

import { MicIcon, XIcon } from "lucide-react";
import type { Ref } from "react";
import { Button } from "@/components/ui/button";

export const BOTON_ICONO_COMPOSITOR_ENTREVISTA =
  "h-11 w-11 shrink-0 rounded-full";

const BOTON_GRABACION = `flex ${BOTON_ICONO_COMPOSITOR_ENTREVISTA} items-center justify-center bg-neutral-100 text-neutral-900`;

export function EntrevistaVozCompositor({
  avisoVoz,
  cancelarGrabacion,
  canvasRef,
  detenerGrabacion,
  duracionNodoRef,
  empezarGrabacion,
  errorVoz,
  estado,
  microfonoEncendido,
  soloCapturaLocal,
}: {
  avisoVoz: string | null;
  cancelarGrabacion: () => void;
  canvasRef: Ref<HTMLCanvasElement>;
  detenerGrabacion: () => void;
  duracionNodoRef: Ref<HTMLSpanElement>;
  empezarGrabacion: () => void;
  errorVoz: string | null;
  estado: "idle" | "recording" | "transcribing";
  microfonoEncendido: boolean;
  soloCapturaLocal: boolean;
}) {
  if (estado === "transcribing") {
    return (
      <p aria-live="polite" className="px-1 text-muted-foreground text-sm">
        Transcribiendo…
      </p>
    );
  }

  if (estado === "recording") {
    return (
      <div className="flex w-full min-w-0 flex-nowrap items-center gap-2">
        <button
          aria-label={
            soloCapturaLocal
              ? "Detener grabación y apagar el micrófono"
              : "Detener grabación y transcribir"
          }
          className={BOTON_GRABACION}
          onClick={detenerGrabacion}
          type="button"
        >
          <span
            aria-hidden="true"
            className="block size-3 rounded-[2px] bg-neutral-900"
          />
        </button>
        <span
          className="w-8 shrink-0 text-center text-[10px] tabular-nums text-neutral-400"
          ref={duracionNodoRef}
        >
          0:00
        </span>
        <canvas
          className="pointer-events-none h-7 min-w-0 flex-1"
          ref={canvasRef}
        />
        <button
          aria-label="Cancelar grabación"
          className={BOTON_GRABACION}
          onClick={cancelarGrabacion}
          type="button"
        >
          <XIcon aria-hidden="true" className="size-4" />
        </button>
        <span className="sr-only" role="status">
          {microfonoEncendido ? "Grabando. Micrófono encendido." : "Grabando."}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <Button
        aria-keyshortcuts="Alt+Space"
        aria-label="Hablar"
        className={`${BOTON_ICONO_COMPOSITOR_ENTREVISTA} p-0`}
        size="icon-lg"
        onClick={empezarGrabacion}
        type="button"
        variant="outline"
      >
        <MicIcon aria-hidden="true" className="size-3.5" />
      </Button>
      {errorVoz ? (
        <p className="text-destructive text-sm" role="alert">
          {errorVoz}
        </p>
      ) : null}
      {avisoVoz ? (
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {avisoVoz}
        </p>
      ) : null}
    </div>
  );
}
