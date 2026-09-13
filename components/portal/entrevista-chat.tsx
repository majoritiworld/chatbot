"use client";

import { Toaster } from "sonner";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { ChatShell } from "@/components/chat/shell";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { FinalizarEntrevistaButton } from "@/components/portal/finalizar-entrevista-button";
import { GuardarEntrevistaButton } from "@/components/portal/guardar-entrevista-button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import type { ChatMessage } from "@/lib/types";

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
  onCompletada,
  titulo,
}: {
  entrevistaId: string;
  mensajesIniciales: ChatMessage[];
  mostrarPortal?: boolean;
  onCompletada?: () => void;
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
        >
          <EntrevistaShell
            acciones={
              <>
                <GuardarEntrevistaButton entrevistaId={entrevistaId} />
                <FinalizarEntrevistaButton
                  entrevistaId={entrevistaId}
                  onCompletada={onCompletada}
                />
              </>
            }
            aviso={avisoEntrevista(mensajesIniciales.length > 0)}
            mostrarPortal={mostrarPortal}
            titulo={titulo}
          >
            <ChatShell />
          </EntrevistaShell>
          <Toaster position="top-center" />
        </ActiveChatProvider>
      </SidebarProvider>
    </DataStreamProvider>
  );
}
