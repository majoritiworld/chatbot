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
import { useActiveChat } from "@/hooks/use-active-chat";
import { useCerrarSeccionEntrevista } from "@/hooks/use-cerrar-seccion-entrevista";

export function FinalizarEntrevistaButton() {
  const { indiceSeccion, numeroSecciones } = useActiveChat();
  const {
    busy,
    forzarCierre,
    guardarProgreso,
    pedirCierre,
    seccionListaParaCerrar,
  } = useCerrarSeccionEntrevista();
  const [confirmar, setConfirmar] = useState(false);
  const esUltimo =
    typeof indiceSeccion === "number" &&
    typeof numeroSecciones === "number" &&
    indiceSeccion >= numeroSecciones - 1;

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
        className={
          seccionListaParaCerrar
            ? "text-xs"
            : "text-muted-foreground text-xs hover:text-foreground"
        }
        data-tour="entrevista-finalizar"
        disabled={busy}
        onClick={handleClick}
        size="xs"
        type="button"
        variant={seccionListaParaCerrar ? "default" : "outline"}
      >
        {busy ? "Cerrando tema…" : null}
        {busy || esUltimo ? null : "Siguiente tema (cierra este)"}
        {busy || !esUltimo ? null : "Terminar tema y revisar"}
      </Button>
      <AlertDialog onOpenChange={setConfirmar} open={confirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Este tema aún no está completo</AlertDialogTitle>
            <AlertDialogDescription>
              Puedes seguir ahora o guardar las respuestas ya enviadas y volver
              luego. Cerrar este tema igual no envía la entrevista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:justify-stretch">
            <AlertDialogCancel disabled={busy} variant="default">
              Seguir respondiendo
            </AlertDialogCancel>
            <Button
              disabled={busy}
              onClick={handleGuardar}
              type="button"
              variant="outline"
            >
              Guardar
            </Button>
            <Button
              className="text-muted-foreground"
              disabled={busy}
              onClick={handleForzar}
              type="button"
              variant="ghost"
            >
              Cerrar este tema igual
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
