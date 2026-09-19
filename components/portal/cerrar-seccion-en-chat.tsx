"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useActiveChat } from "@/hooks/use-active-chat";
import { useCerrarSeccionEntrevista } from "@/hooks/use-cerrar-seccion-entrevista";
import { agenteOfrecioCierreListo } from "@/lib/consultoria/cierre-seccion";
import { etiquetaCierreTema } from "@/lib/consultoria/entrevista-piloto";

export function CerrarSeccionEnChat({ visible }: { visible: boolean }) {
  const { indiceSeccion, input, messages, numeroSecciones, setInput } =
    useActiveChat();
  const { busy, pedirCierre } = useCerrarSeccionEntrevista();
  const handleClick = useCallback(() => {
    const borrador = input;
    pedirCierre();
    if (borrador.trim().length > 0) {
      setInput(borrador);
    }
  }, [input, pedirCierre, setInput]);
  const esUltimo =
    typeof indiceSeccion === "number" &&
    typeof numeroSecciones === "number" &&
    indiceSeccion >= numeroSecciones - 1;

  if (!(visible && agenteOfrecioCierreListo(messages))) {
    return null;
  }

  return (
    <div className="pt-3">
      <Button
        disabled={busy}
        onClick={handleClick}
        size="sm"
        type="button"
        variant="outline"
      >
        {busy ? "Cerrando tema…" : etiquetaCierreTema(esUltimo)}
      </Button>
    </div>
  );
}
