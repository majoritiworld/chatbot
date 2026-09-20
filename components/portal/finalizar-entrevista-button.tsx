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
import { debeConfirmarCierrePorBorrador } from "@/lib/consultoria/entrevista-piloto";

export function FinalizarEntrevistaButton() {
  const { indiceSeccion, input, numeroSecciones, sendMessage, setInput } =
    useActiveChat();
  const {
    busy,
    forzarCierre,
    guardarProgreso,
    pedirCierre,
    seccionListaParaCerrar,
  } = useCerrarSeccionEntrevista();
  const [confirmar, setConfirmar] = useState(false);
  const [confirmarBorrador, setConfirmarBorrador] = useState(false);
  const esUltimo =
    typeof indiceSeccion === "number" &&
    typeof numeroSecciones === "number" &&
    indiceSeccion >= numeroSecciones - 1;

  const iniciarCierreListo = useCallback(() => {
    if (debeConfirmarCierrePorBorrador(input)) {
      setConfirmarBorrador(true);
      return;
    }
    pedirCierre();
  }, [input, pedirCierre]);

  const handleClick = useCallback(() => {
    if (seccionListaParaCerrar) {
      iniciarCierreListo();
      return;
    }
    setConfirmar(true);
  }, [iniciarCierreListo, seccionListaParaCerrar]);

  const handleForzar = useCallback(() => {
    setConfirmar(false);
    if (debeConfirmarCierrePorBorrador(input)) {
      setConfirmarBorrador(true);
      return;
    }
    forzarCierre();
  }, [forzarCierre, input]);

  const handleGuardar = useCallback(() => {
    setConfirmar(false);
    guardarProgreso();
  }, [guardarProgreso]);

  const seguirEditando = useCallback(() => {
    setConfirmarBorrador(false);
  }, []);

  const enviarRespuestaActual = useCallback(() => {
    const texto = input.trim();
    setConfirmarBorrador(false);
    if (!texto) {
      return;
    }
    sendMessage({
      parts: [{ text: texto, type: "text" }],
      role: "user",
    });
    setInput("");
  }, [input, sendMessage, setInput]);

  const descartarYContinuar = useCallback(() => {
    setConfirmarBorrador(false);
    setInput("");
    if (seccionListaParaCerrar) {
      pedirCierre();
      return;
    }
    forzarCierre();
  }, [forzarCierre, pedirCierre, seccionListaParaCerrar, setInput]);

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
      <AlertDialog onOpenChange={setConfirmarBorrador} open={confirmarBorrador}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tienes texto sin enviar</AlertDialogTitle>
            <AlertDialogDescription>
              Ese borrador no pasa al siguiente tema. Puedes seguir editándolo,
              enviarlo ahora a este tema, o descartarlo y continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:justify-stretch">
            <AlertDialogCancel onClick={seguirEditando} type="button">
              Seguir editando
            </AlertDialogCancel>
            <Button onClick={enviarRespuestaActual} type="button">
              Enviar al tema actual
            </Button>
            <Button
              onClick={descartarYContinuar}
              type="button"
              variant="outline"
            >
              Descartar y continuar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
