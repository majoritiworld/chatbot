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
import { agenteOfrecioCierreListo } from "@/lib/consultoria/cierre-seccion";
import {
  avisoEntregaAlFinalizar,
  debeConfirmarCierrePorBorrador,
  etiquetaCierreTema,
} from "@/lib/consultoria/entrevista-piloto";

export function CerrarSeccionEnChat({
  placement = "inline",
  visible = true,
}: {
  placement?: "inline" | "sticky";
  visible?: boolean;
}) {
  const {
    indiceSeccion,
    input,
    messages,
    numeroSecciones,
    sendMessage,
    setInput,
  } = useActiveChat();
  const { busy, pedirCierre, seccionListaParaCerrar } =
    useCerrarSeccionEntrevista();
  const [confirmarBorrador, setConfirmarBorrador] = useState(false);
  const [confirmarEntrega, setConfirmarEntrega] = useState(false);
  const esUltimo =
    typeof indiceSeccion === "number" &&
    typeof numeroSecciones === "number" &&
    indiceSeccion >= numeroSecciones - 1;

  const intentarCerrar = useCallback(() => {
    if (esUltimo) {
      setConfirmarEntrega(true);
      return;
    }
    pedirCierre();
  }, [esUltimo, pedirCierre]);

  const handleClick = useCallback(() => {
    if (debeConfirmarCierrePorBorrador(input)) {
      setConfirmarBorrador(true);
      return;
    }
    intentarCerrar();
  }, [input, intentarCerrar]);

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
    intentarCerrar();
  }, [intentarCerrar, setInput]);

  const confirmarYCerrar = useCallback(() => {
    setConfirmarEntrega(false);
    pedirCierre();
  }, [pedirCierre]);

  const lastOfreció = agenteOfrecioCierreListo(messages);
  const mostrar =
    visible &&
    seccionListaParaCerrar &&
    (placement === "inline" ? lastOfreció : !lastOfreció);

  if (!mostrar) {
    return null;
  }

  return (
    <div className="pt-3">
      <Button
        className="h-11 rounded-full px-4"
        data-testid="entrevista-cerrar-tema"
        disabled={busy}
        onClick={handleClick}
        type="button"
        variant="outline"
      >
        {busy ? (esUltimo ? "Finalizando…" : "Cerrando tema…") : null}
        {busy ? null : etiquetaCierreTema(esUltimo)}
      </Button>
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
      <AlertDialog onOpenChange={setConfirmarEntrega} open={confirmarEntrega}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Finalizar entrevista?</AlertDialogTitle>
            <AlertDialogDescription>
              {avisoEntregaAlFinalizar()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Seguir aquí</AlertDialogCancel>
            <Button onClick={confirmarYCerrar} type="button">
              Finalizar entrevista
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
