"use client";

import { Toaster } from "sonner";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { ChatShell } from "@/components/chat/shell";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { FinalizarEntrevistaButton } from "@/components/portal/finalizar-entrevista-button";
import { GuardarEntrevistaButton } from "@/components/portal/guardar-entrevista-button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";
import type { ChatMessage, SectionCompletedData } from "@/lib/types";

function avisoEntrevista(hayHistorial: boolean) {
  if (hayHistorial) {
    return "Continuas desde donde lo dejaste. Puedes guardar y volver otro día.";
  }
  return "No hace falta terminarla hoy: guarda tu progreso y continúa cuando quieras.";
}

/**
 * The interview chat without the template's sidebar chrome. The collapsed
 * SidebarProvider satisfies `useSidebar()` inside ChatShell and keeps its
 * header hidden.
 */
export function EntrevistaChat({
  entrevistaId,
  mensajesIniciales,
  mostrarPortal = true,
  onSeccionCompletada,
  seccion,
  titulo,
}: {
  entrevistaId: string;
  mensajesIniciales: ChatMessage[];
  mostrarPortal?: boolean;
  onSeccionCompletada: (data: SectionCompletedData) => void;
  seccion: SeccionEntrevista;
  titulo?: string;
}) {
  return (
    <DataStreamProvider>
      {/* The provider only exists to satisfy useSidebar() inside ChatShell:
          drop its full-viewport, sidebar-tinted wrapper styles. */}
      <SidebarProvider
        className="h-full min-h-0 bg-background"
        defaultOpen={false}
      >
        <ActiveChatProvider
          entrevistaId={entrevistaId}
          mensajesIniciales={mensajesIniciales}
          seccionId={seccion.id}
        >
          <EntrevistaShell
            acciones={
              <GuardarEntrevistaButton
                entrevistaId={entrevistaId}
                seccionId={seccion.id}
              />
            }
            aviso={avisoEntrevista(mensajesIniciales.length > 0)}
            mostrarPortal={mostrarPortal}
            titulo={titulo}
          >
            <ChatShell
              composerAction={
                <FinalizarEntrevistaButton
                  entrevistaId={entrevistaId}
                  onSeccionCompletada={onSeccionCompletada}
                  seccionId={seccion.id}
                />
              }
              onSeccionCompletada={onSeccionCompletada}
            />
          </EntrevistaShell>
          <Toaster position="top-center" />
        </ActiveChatProvider>
      </SidebarProvider>
    </DataStreamProvider>
  );
}
