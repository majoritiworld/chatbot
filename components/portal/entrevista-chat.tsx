"use client";

import { type MouseEvent, useCallback, useState } from "react";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { ChatShell } from "@/components/chat/shell";
import { EntrevistaAyuda } from "@/components/portal/entrevista-ayuda";
import { EntrevistaInfoModales } from "@/components/portal/entrevista-info-modales";
import {
  DESTINO_CERRAR_SESION,
  enviarCierreSesionPendiente,
} from "@/components/portal/entrevista-menu-secundario";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { GuardarEntrevistaButton } from "@/components/portal/guardar-entrevista-button";
import {
  TerminarTemaAntesButton,
  TerminarTemaAntesProvider,
} from "@/components/portal/terminar-tema-antes-button";
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
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  ActiveChatProvider,
  type InicioChat,
  useActiveChat,
} from "@/hooks/use-active-chat";
import {
  useConfirmarDestinoPendiente,
  useSalidaEntrevista,
} from "@/hooks/use-salida-entrevista";
import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";
import { etiquetaProgresoTema } from "@/lib/consultoria/entrevista-piloto";
import type { ModoVozEntrevista } from "@/lib/consultoria/entrevista-voz";
import type { ChatMessage, SectionCompletedData } from "@/lib/types";

function EstadoGuardado() {
  const { estadoGuardado } = useActiveChat();
  let texto = "";
  if (estadoGuardado === "guardado") {
    texto = "Guardado";
  } else if (estadoGuardado === "guardando") {
    texto = "Guardando…";
  } else if (estadoGuardado === "error") {
    texto = "No se pudo guardar. Tu texto sigue aquí";
  }
  return (
    <span
      aria-live="polite"
      className={
        estadoGuardado === "error"
          ? "px-1 text-[12px] text-destructive"
          : "hidden px-1 text-[12px] text-neutral-400 sm:inline"
      }
      data-estado-guardado={estadoGuardado}
      data-testid="entrevista-estado-guardado"
    >
      {texto}
    </span>
  );
}

function AccionesConversacion({
  demoFalloGuardar,
  entrevistaId,
  seccionId,
}: {
  demoFalloGuardar?: boolean;
  entrevistaId: string;
  seccionId: string;
}) {
  const { inicioPendiente } = useActiveChat();
  if (inicioPendiente) {
    return null;
  }
  return (
    <>
      <EstadoGuardado />
      <GuardarEntrevistaButton
        compacto
        demoFalloGuardar={demoFalloGuardar}
        entrevistaId={entrevistaId}
        seccionId={seccionId}
      />
    </>
  );
}

function EntrevistaChatCuerpo({
  correoUsuario,
  demoFalloGuardar,
  entrevistaId,
  indice,
  mostrarPortal,
  numeroSecciones,
  onSeccionCompletada,
  seccion,
  titulo,
}: {
  correoUsuario?: string | null;
  demoFalloGuardar?: boolean;
  entrevistaId: string;
  indice: number;
  mostrarPortal: boolean;
  numeroSecciones: number;
  onSeccionCompletada?: (data: SectionCompletedData) => void;
  seccion: SeccionEntrevista;
  titulo?: string;
}) {
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const {
    aviso,
    cancelarSalida,
    destinoPendiente,
    insegura,
    pedirConfirmacion,
  } = useSalidaEntrevista();
  const irAlDestino = useConfirmarDestinoPendiente(destinoPendiente);
  const handleIrAlPortal = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!insegura) {
        return;
      }
      event.preventDefault();
      pedirConfirmacion(event.currentTarget.href);
    },
    [insegura, pedirConfirmacion]
  );
  const handleDialogChange = useCallback(
    (open: boolean) => {
      if (!open) {
        cancelarSalida();
      }
    },
    [cancelarSalida]
  );
  const handleIntentarCerrarSesion = useCallback(
    () => pedirConfirmacion(DESTINO_CERRAR_SESION),
    [pedirConfirmacion]
  );
  const handleConfirmarSalida = useCallback(() => {
    if (destinoPendiente === DESTINO_CERRAR_SESION) {
      enviarCierreSesionPendiente();
      return;
    }
    irAlDestino();
  }, [destinoPendiente, irAlDestino]);
  const handleAbrirAyuda = useCallback(() => {
    setAyudaAbierta(true);
  }, []);
  const continua = seccion.conversacionContinua === true;
  const progresoTema = continua
    ? undefined
    : etiquetaProgresoTema(indice, numeroSecciones);
  const dialogoSalida = (
    <AlertDialog
      onOpenChange={handleDialogChange}
      open={Boolean(destinoPendiente)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Salir de la entrevista?</AlertDialogTitle>
          <AlertDialogDescription>
            {aviso ??
              "Hay cambios que pueden no haberse conservado si sales ahora."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">Seguir aquí</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmarSalida} type="button">
            Salir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (seccion.inicioEnChat) {
    return (
      <TerminarTemaAntesProvider>
        <EntrevistaShell
          acciones={
            <AccionesConversacion
              demoFalloGuardar={demoFalloGuardar}
              entrevistaId={entrevistaId}
              seccionId={seccion.id}
            />
          }
          cabeceraMarca
          compactoMovil
          correoUsuario={correoUsuario}
          mostrarPortal={mostrarPortal}
          onIntentarCerrarSesion={handleIntentarCerrarSesion}
          onIrAlPortal={handleIrAlPortal}
          titulo={titulo}
        >
          <ChatShell
            onSeccionCompletada={onSeccionCompletada}
            pieCompositor={
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-between">
                <EntrevistaInfoModales inicio={seccion.inicioEnChat} />
                <TerminarTemaAntesButton enConversacion trigger="compositor" />
              </div>
            }
            sinAccionesMensaje
          />
          {dialogoSalida}
        </EntrevistaShell>
      </TerminarTemaAntesProvider>
    );
  }

  return (
    <TerminarTemaAntesProvider>
      <EntrevistaShell
        acciones={
          <>
            <EntrevistaAyuda
              abierta={ayudaAbierta}
              className="hidden text-muted-foreground text-xs hover:text-foreground md:inline-flex"
              onOpenChange={setAyudaAbierta}
            />
            <div className="hidden md:block">
              <GuardarEntrevistaButton
                demoFalloGuardar={demoFalloGuardar}
                entrevistaId={entrevistaId}
                seccionId={seccion.id}
              />
            </div>
          </>
        }
        compactoMovil
        correoUsuario={correoUsuario}
        guardarMovil={
          <GuardarEntrevistaButton
            compacto
            demoFalloGuardar={demoFalloGuardar}
            entrevistaId={entrevistaId}
            seccionId={seccion.id}
          />
        }
        mostrarPortal={mostrarPortal}
        onAbrirAyuda={handleAbrirAyuda}
        onIntentarCerrarSesion={handleIntentarCerrarSesion}
        onIrAlPortal={handleIrAlPortal}
        progresoTema={progresoTema}
        seccion={continua ? undefined : `${progresoTema}: ${seccion.titulo}`}
        titulo={titulo}
        tituloTema={continua ? undefined : seccion.titulo}
      >
        <ChatShell onSeccionCompletada={onSeccionCompletada} />
        {dialogoSalida}
      </EntrevistaShell>
    </TerminarTemaAntesProvider>
  );
}

export function EntrevistaChat({
  correoUsuario,
  demoAislada = false,
  demoFalloGuardar = false,
  demoVoz,
  entrevistaId,
  indice,
  inicio,
  mensajesIniciales,
  mostrarPortal = false,
  numeroSecciones,
  onSeccionCompletada,
  seccion,
  titulo,
}: {
  correoUsuario?: string | null;
  demoAislada?: boolean;
  demoFalloGuardar?: boolean;
  demoVoz?: ModoVozEntrevista;
  entrevistaId: string;
  indice: number;
  inicio?: InicioChat;
  mensajesIniciales: ChatMessage[];
  mostrarPortal?: boolean;
  numeroSecciones: number;
  onSeccionCompletada?: (data: SectionCompletedData) => void;
  seccion: SeccionEntrevista;
  titulo?: string;
}) {
  return (
    <DataStreamProvider>
      <SidebarProvider className="h-full min-h-0 bg-white" defaultOpen={false}>
        <ActiveChatProvider
          conversacionContinua={seccion.conversacionContinua === true}
          demoAislada={demoAislada}
          demoVoz={demoVoz}
          entrevistaId={entrevistaId}
          indiceSeccion={indice}
          inicio={inicio}
          mensajesIniciales={mensajesIniciales}
          numeroSecciones={numeroSecciones}
          onSeccionCompletada={onSeccionCompletada}
          seccionId={seccion.id}
        >
          <EntrevistaChatCuerpo
            correoUsuario={correoUsuario}
            demoFalloGuardar={demoFalloGuardar}
            entrevistaId={entrevistaId}
            indice={indice}
            mostrarPortal={mostrarPortal}
            numeroSecciones={numeroSecciones}
            onSeccionCompletada={onSeccionCompletada}
            seccion={seccion}
            titulo={titulo}
          />
        </ActiveChatProvider>
      </SidebarProvider>
    </DataStreamProvider>
  );
}
