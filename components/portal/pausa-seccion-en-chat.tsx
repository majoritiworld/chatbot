"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useCerrarSeccionEntrevista } from "@/hooks/use-cerrar-seccion-entrevista";

export function PausaSeccionEnChat({ visible }: { visible: boolean }) {
  const { busy, continuar, forzarCierre, guardarProgreso } =
    useCerrarSeccionEntrevista();
  const handleContinuar = useCallback(() => {
    continuar();
  }, [continuar]);
  const handleGuardar = useCallback(() => {
    guardarProgreso();
  }, [guardarProgreso]);
  const handleForzar = useCallback(() => {
    forzarCierre();
  }, [forzarCierre]);

  if (!visible) {
    return null;
  }

  return (
    <div className="flex flex-col items-start gap-2 pt-1">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={handleContinuar}
          size="sm"
          type="button"
        >
          Continuar
        </Button>
        <Button
          disabled={busy}
          onClick={handleGuardar}
          size="sm"
          type="button"
          variant="outline"
        >
          {busy ? "Guardando…" : "Guardar progreso"}
        </Button>
      </div>
      <button
        className="text-muted-foreground text-xs underline decoration-muted-foreground/70 underline-offset-2 hover:text-foreground disabled:opacity-50"
        disabled={busy}
        onClick={handleForzar}
        type="button"
      >
        Cerrar de todas maneras
      </button>
    </div>
  );
}
