"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useCerrarSeccionEntrevista } from "@/hooks/use-cerrar-seccion-entrevista";

export function CerrarSeccionEnChat({ visible }: { visible: boolean }) {
  const { busy, pedirCierre } = useCerrarSeccionEntrevista();
  const handleClick = useCallback(() => {
    pedirCierre();
  }, [pedirCierre]);

  if (!visible) {
    return null;
  }

  return (
    <div className="pt-1">
      <Button disabled={busy} onClick={handleClick} size="sm" type="button">
        {busy ? "Finalizando…" : "Finalizar sección"}
      </Button>
    </div>
  );
}
