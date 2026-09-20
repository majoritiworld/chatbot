"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useActiveChat } from "@/hooks/use-active-chat";
import { useCerrarSeccionEntrevista } from "@/hooks/use-cerrar-seccion-entrevista";
import {
  avisoBorradorCierreAnticipado,
  avisoCierreAnticipado,
  debeConfirmarCierrePorBorrador,
  etiquetaAccionCierreAnticipado,
  etiquetaCierreAnticipado,
} from "@/lib/consultoria/entrevista-piloto";
import { cn } from "@/lib/utils";

type CierreAnticipadoContexto = {
  abrir: () => void;
  busy: boolean;
};

const AbrirCierreAnticipadoContext =
  createContext<CierreAnticipadoContexto | null>(null);

export function TerminarTemaAntesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { indiceSeccion, input, numeroSecciones, setInput } = useActiveChat();
  const { busy, errorCierre, exitoCierre, forzarCierre } =
    useCerrarSeccionEntrevista();
  const [confirmar, setConfirmar] = useState(false);
  const [confirmarBorrador, setConfirmarBorrador] = useState(false);
  const esUltimo =
    typeof indiceSeccion === "number" &&
    typeof numeroSecciones === "number" &&
    indiceSeccion >= numeroSecciones - 1;

  const abrir = useCallback(() => {
    if (debeConfirmarCierrePorBorrador(input)) {
      setConfirmarBorrador(true);
      return;
    }
    setConfirmar(true);
  }, [input]);

  const seguirRespondiendo = useCallback(() => {
    setConfirmar(false);
    setConfirmarBorrador(false);
  }, []);

  useEffect(() => {
    if (exitoCierre) {
      setConfirmar(false);
      setConfirmarBorrador(false);
    }
  }, [exitoCierre]);

  const confirmarCierre = useCallback(() => {
    forzarCierre();
  }, [forzarCierre]);

  const descartarBorradorYConfirmar = useCallback(() => {
    setConfirmarBorrador(false);
    setInput("");
    setConfirmar(true);
  }, [setInput]);

  const handleBorradorOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !busy) {
        setConfirmarBorrador(false);
      }
    },
    [busy]
  );

  const handleConfirmarOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !busy) {
        setConfirmar(false);
      }
    },
    [busy]
  );

  const mostrarError = Boolean(errorCierre) && confirmar;
  const value = useMemo(() => ({ abrir, busy }), [abrir, busy]);

  return (
    <AbrirCierreAnticipadoContext.Provider value={value}>
      {children}
      <AlertDialog
        onOpenChange={handleBorradorOpenChange}
        open={confirmarBorrador}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tienes texto sin enviar</AlertDialogTitle>
            <AlertDialogDescription>
              {avisoBorradorCierreAnticipado()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:justify-stretch">
            <AlertDialogCancel onClick={seguirRespondiendo} type="button">
              Seguir editando
            </AlertDialogCancel>
            <Button
              onClick={descartarBorradorYConfirmar}
              type="button"
              variant="outline"
            >
              Descartar y continuar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog onOpenChange={handleConfirmarOpenChange} open={confirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {esUltimo
                ? "¿Finalizar y entregar la entrevista?"
                : "¿Terminar este tema antes de tiempo?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {avisoCierreAnticipado(esUltimo)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {mostrarError ? (
            <p className="text-destructive text-sm" role="alert">
              {errorCierre} Lo ya cerrado se conserva. Puedes reintentar.
            </p>
          ) : null}
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:justify-stretch">
            <AlertDialogCancel
              disabled={busy}
              onClick={seguirRespondiendo}
              type="button"
            >
              Seguir respondiendo
            </AlertDialogCancel>
            <Button
              data-testid="entrevista-confirmar-cierre-anticipado"
              disabled={busy}
              onClick={confirmarCierre}
              type="button"
            >
              {etiquetaAccionCierreAnticipado({
                busy,
                esUltimo,
                mostrarError,
              })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AbrirCierreAnticipadoContext.Provider>
  );
}

export function TerminarTemaAntesButton({
  trigger = "link",
}: {
  trigger?: "link" | "menu";
}) {
  const contexto = useContext(AbrirCierreAnticipadoContext);
  const etiqueta = etiquetaCierreAnticipado();

  if (!contexto) {
    return null;
  }

  if (trigger === "menu") {
    return (
      <DropdownMenuItem
        data-testid="entrevista-cierre-anticipado-menu"
        disabled={contexto.busy}
        onSelect={contexto.abrir}
      >
        {etiqueta}
      </DropdownMenuItem>
    );
  }

  const textoBoton = contexto.busy ? "Cerrando tema…" : etiqueta;

  return (
    <Button
      className={cn(
        "h-auto min-h-11 px-0 text-left font-normal text-muted-foreground text-xs underline decoration-muted-foreground/70 underline-offset-2 hover:bg-transparent hover:text-foreground md:min-h-0"
      )}
      data-testid="entrevista-cierre-anticipado"
      disabled={contexto.busy}
      onClick={contexto.abrir}
      type="button"
      variant="ghost"
    >
      {textoBoton}
    </Button>
  );
}
