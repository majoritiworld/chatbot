"use client";

import { MicIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const IDS_ONDA = [
  "o01",
  "o02",
  "o03",
  "o04",
  "o05",
  "o06",
  "o07",
  "o08",
  "o09",
  "o10",
  "o11",
  "o12",
  "o13",
  "o14",
  "o15",
  "o16",
  "o17",
  "o18",
  "o19",
  "o20",
  "o21",
  "o22",
  "o23",
  "o24",
] as const;

export function EntrevistaVozCompositor({
  barras,
  cancelarGrabacion,
  detenerGrabacion,
  duracion,
  empezarGrabacion,
  errorVoz,
  estado,
}: {
  barras: number[];
  cancelarGrabacion: () => void;
  detenerGrabacion: () => void;
  duracion: string;
  empezarGrabacion: () => void;
  errorVoz: string | null;
  estado: "idle" | "recording" | "transcribing";
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
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <p aria-live="polite" className="shrink-0 font-medium text-sm">
          Grabando {duracion}
        </p>
        <div
          aria-hidden="true"
          className="flex h-6 min-w-24 flex-1 items-end gap-px"
        >
          {IDS_ONDA.map((id, indice) => (
            <span
              className={cn(
                "inline-block w-full min-w-0.5 rounded-full bg-neutral-900"
              )}
              key={id}
              style={{
                height: `${Math.max(12, (barras.at(indice) ?? 0.2) * 100)}%`,
              }}
            />
          ))}
        </div>
        <Button
          aria-label="Cancelar grabación"
          onClick={cancelarGrabacion}
          size="xs"
          type="button"
          variant="ghost"
        >
          Cancelar
        </Button>
        <Button
          aria-label="Detener grabación y transcribir"
          onClick={detenerGrabacion}
          size="xs"
          type="button"
        >
          Detener
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <Button
        aria-keyshortcuts="Alt+Space"
        aria-label="Hablar"
        className="size-8 rounded-full p-0"
        onClick={empezarGrabacion}
        type="button"
        variant="outline"
      >
        <MicIcon className="size-3.5" />
      </Button>
      {errorVoz ? (
        <p className="text-destructive text-sm" role="alert">
          {errorVoz}
        </p>
      ) : null}
    </div>
  );
}
