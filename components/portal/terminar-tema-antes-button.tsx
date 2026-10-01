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

const AVISO_TERMINAR_CONVERSACION =
  "Se enviará lo que respondiste hasta este momento. Las preguntas que faltan quedarán sin responder y ya no podrás agregar más.";
const AVISO_BORRADOR_CONVERSACION =
  "El texto que escribiste y no enviaste no se incluirá. Si quieres incluirlo, elige Seguir respondiendo: lo encontrarás tal como lo dejaste.";

function tituloConfirmacion(continua: boolean, esUltimo: boolean) {
  if (continua) {
    return "¿Terminar y enviar ahora?";
  }
  return esUltimo
    ? "¿Finalizar y entregar la entrevista?"
    : "¿Terminar este tema antes de tiempo?";
}

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
  const {
    conversacionContinua,
    indiceSeccion,
    input,
    numeroSecciones,
    setInput,
  } = useActiveChat();
  const { busy, errorCierre, exitoCierre, forzarCierre } =
    useCerrarSeccionEntrevista();
  const [confirmar, setConfirmar] = useState(false);
  const [confirmarBorrador, setConfirmarBorrador] = useState(false);
  const esUltimo =
    typeof indiceSeccion === "number" &&
    typeof numeroSecciones === "number" &&
    indiceSeccion >= numeroSecciones - 1;

  const abrir = useCallback(() => {
    if (!conversacionContinua && debeConfirmarCierrePorBorrador(input)) {
      setConfirmarBorrador(true);
      return;
    }
    setConfirmar(true);
  }, [conversacionContinua, input]);
  const conBorrador =
    Boolean(conversacionContinua) && debeConfirmarCierrePorBorrador(input);

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
              {tituloConfirmacion(Boolean(conversacionContinua), esUltimo)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conversacionContinua
                ? AVISO_TERMINAR_CONVERSACION
                : avisoCierreAnticipado(esUltimo)}
            </AlertDialogDescription>
            {conBorrador ? (
              <p
                className="text-muted-foreground text-sm"
                data-testid="entrevista-aviso-borrador"
              >
                {AVISO_BORRADOR_CONVERSACION}
              </p>
            ) : null}
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
              {conversacionContinua && !(busy || mostrarError)
                ? "Terminar y enviar"
                : etiquetaAccionCierreAnticipado({
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
  enConversacion = false,
  trigger = "link",
}: {
  /** Continuous chats show it only where the caller places it. */
  enConversacion?: boolean;
  trigger?: "link" | "menu" | "compositor";
}) {
  const contexto = useContext(AbrirCierreAnticipadoContext);
  const { conversacionContinua, inicioPendiente } = useActiveChat();
  const etiqueta = etiquetaCierreAnticipado();

  if (!contexto || (conversacionContinua && !enConversacion)) {
    return null;
  }

  if (trigger === "compositor") {
    if (inicioPendiente) {
      return null;
    }
    return (
      <Button
        className="h-9 rounded-full border-neutral-300 px-3.5 font-medium text-[13px] text-neutral-700 shadow-none hover:bg-neutral-50 hover:text-neutral-900"
        data-testid="entrevista-terminar"
        disabled={contexto.busy}
        onClick={contexto.abrir}
        type="button"
        variant="outline"
      >
        {contexto.busy ? "Enviando…" : "Terminar entrevista"}
      </Button>
    );
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
        "min-h-11 w-fit rounded-full border-border/60 px-4 font-medium text-sm shadow-none hover:bg-muted/50"
      )}
      data-testid="entrevista-cierre-anticipado"
      disabled={contexto.busy}
      onClick={contexto.abrir}
      type="button"
      variant="outline"
    >
      {textoBoton}
    </Button>
  );
}
