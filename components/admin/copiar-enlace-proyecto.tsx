"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

export function CopiarEnlaceProyecto({ enlace }: { enlace: string | null }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = useCallback(async () => {
    if (!enlace) {
      return;
    }
    await navigator.clipboard.writeText(enlace);
    setCopiado(true);
  }, [enlace]);

  if (!enlace) {
    return (
      <p className="text-muted-foreground text-sm">
        Guarda un identificador para copiar el enlace y compartirlo con el
        cliente.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="break-all text-sm">{enlace}</p>
      <Button className="w-fit" onClick={copiar} type="button">
        {copiado ? "Enlace copiado" : "Copiar enlace del proyecto"}
      </Button>
    </div>
  );
}
