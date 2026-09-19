"use client";

import { type MouseEvent, useCallback } from "react";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { ChatShell } from "@/components/chat/shell";
import { EntrevistaAyuda } from "@/components/portal/entrevista-ayuda";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { GuardarEntrevistaButton } from "@/components/portal/guardar-entrevista-button";
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
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import {
  useConfirmarDestinoPendiente,
  useSalidaEntrevista,
} from "@/hooks/use-salida-entrevista";
import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";
import { etiquetaProgresoTema } from "@/lib/consultoria/entrevista-piloto";
import type { ChatMessage, SectionCompletedData } from "@/lib/types";

function EntrevistaChatCuerpo({
  entrevistaId,
  indice,
  mostrarPortal,
  numeroSecciones,
  onSeccionCompletada,
  seccion,
  titulo,
}: {
  entrevistaId: string;
  indice: number;
  mostrarPortal: boolean;
  numeroSecciones: number;
  onSeccionCompletada?: (data: SectionCompletedData) => void;
  seccion: SeccionEntrevista;
  titulo?: string;
}) {
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

  return (
    <EntrevistaShell
      acciones={
        <>
          <EntrevistaAyuda />
          <GuardarEntrevistaButton
            entrevistaId={entrevistaId}
            seccionId={seccion.id}
          />
        </>
      }
      mostrarPortal={mostrarPortal}
      onIrAlPortal={handleIrAlPortal}
      seccion={`${etiquetaProgresoTema(indice, numeroSecciones)}: ${seccion.titulo}`}
      titulo={titulo}
    >
      <ChatShell onSeccionCompletada={onSeccionCompletada} />
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
            <AlertDialogAction onClick={irAlDestino} type="button">
              Salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EntrevistaShell>
  );
}

export function EntrevistaChat({
  demoAislada = false,
  entrevistaId,
  indice,
  mensajesIniciales,
  mostrarPortal = false,
  numeroSecciones,
  onSeccionCompletada,
  seccion,
  titulo,
}: {
  demoAislada?: boolean;
  entrevistaId: string;
  indice: number;
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
          demoAislada={demoAislada}
          entrevistaId={entrevistaId}
          indiceSeccion={indice}
          mensajesIniciales={mensajesIniciales}
          numeroSecciones={numeroSecciones}
          onSeccionCompletada={onSeccionCompletada}
          seccionId={seccion.id}
        >
          <EntrevistaChatCuerpo
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
