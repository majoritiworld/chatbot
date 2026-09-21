"use client";

import { useCallback, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCerrarSeccionEntrevista } from "@/hooks/use-cerrar-seccion-entrevista";

export function FinalizarEntrevistaButton() {
  const {
    busy,
    forzarCierre,
    guardarProgreso,
    pedirCierre,
    seccionListaParaCerrar,
  } = useCerrarSeccionEntrevista();
  const [confirmar, setConfirmar] = useState(false);

  const handleClick = useCallback(() => {
    if (seccionListaParaCerrar) {
      pedirCierre();
      return;
    }
    setConfirmar(true);
  }, [pedirCierre, seccionListaParaCerrar]);

  const handleForzar = useCallback(() => {
    forzarCierre();
  }, [forzarCierre]);

  const handleGuardar = useCallback(() => {
    setConfirmar(false);
    guardarProgreso();
  }, [guardarProgreso]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (busy && !open) {
        return;
      }
      setConfirmar(open);
    },
    [busy]
  );

  return (
    <>
      <Button
        className="text-muted-foreground text-xs hover:text-foreground"
        data-tour="entrevista-finalizar"
        disabled={busy}
        onClick={handleClick}
        size="xs"
        type="button"
        variant="outline"
      >
        Finalizar sección
      </Button>
      <AlertDialog onOpenChange={handleOpenChange} open={confirmar}>
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar esta sección?</AlertDialogTitle>
            <AlertDialogDescription>
              Todavía hay temas por cubrir. Puedes continuar, guardar y volver
              otro día, o cerrar de todas maneras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:justify-stretch">
            <AlertDialogCancel
              className="w-full"
              disabled={busy}
              variant="default"
            >
              Continuar sección
            </AlertDialogCancel>
            <Button
              className="w-full"
              disabled={busy}
              onClick={handleGuardar}
              type="button"
              variant="outline"
            >
              Guardar progreso
            </Button>
            <Button
              className="w-full text-muted-foreground"
              disabled={busy}
              onClick={handleForzar}
              type="button"
              variant="ghost"
            >
              Cerrar de todas maneras
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
