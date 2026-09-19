"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useActiveChat } from "@/hooks/use-active-chat";
import { useCerrarSeccionEntrevista } from "@/hooks/use-cerrar-seccion-entrevista";

export function CerrarSeccionEnChat({ visible }: { visible: boolean }) {
  const { indiceSeccion, numeroSecciones } = useActiveChat();
  const { busy, pedirCierre } = useCerrarSeccionEntrevista();
  const handleClick = useCallback(() => {
    pedirCierre();
  }, [pedirCierre]);
  const esUltimo =
    typeof indiceSeccion === "number" &&
    typeof numeroSecciones === "number" &&
    indiceSeccion >= numeroSecciones - 1;

  if (!visible) {
    return null;
  }

  return (
    <div className="pt-1">
      <Button disabled={busy} onClick={handleClick} size="sm" type="button">
        {busy ? "Cerrando tema…" : null}
        {busy || esUltimo ? null : "Siguiente tema (cierra este)"}
        {busy || !esUltimo ? null : "Terminar tema y revisar"}
      </Button>
    </div>
  );
}
