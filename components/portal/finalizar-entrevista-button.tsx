"use client";

import { useCallback, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
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
    setConfirmar(false);
    forzarCierre();
  }, [forzarCierre]);

  const handleGuardar = useCallback(() => {
    setConfirmar(false);
    guardarProgreso();
  }, [guardarProgreso]);

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
      <AlertDialog onOpenChange={setConfirmar} open={confirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar esta sección?</AlertDialogTitle>
            <AlertDialogDescription>
              Todavía hay temas por cubrir. Puedes continuar, guardar y volver
              otro día, o cerrar de todas maneras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="text-muted-foreground"
              disabled={busy}
              onClick={handleForzar}
              variant="ghost"
            >
              Cerrar de todas maneras
            </AlertDialogAction>
            <Button
              disabled={busy}
              onClick={handleGuardar}
              type="button"
              variant="outline"
            >
              Guardar progreso
            </Button>
            <AlertDialogCancel disabled={busy} variant="default">
              Continuar sección
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
