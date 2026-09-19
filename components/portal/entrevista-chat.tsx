"use client";

import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { ChatShell } from "@/components/chat/shell";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { EntrevistaTour } from "@/components/portal/entrevista-tour";
import { FinalizarEntrevistaButton } from "@/components/portal/finalizar-entrevista-button";
import { GuardarEntrevistaButton } from "@/components/portal/guardar-entrevista-button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";
import type { ChatMessage, SectionCompletedData } from "@/lib/types";

/**
 * The interview chat without the template's sidebar chrome. The collapsed
 * SidebarProvider satisfies `useSidebar()` inside ChatShell and keeps its
 * header hidden.
 */
export function EntrevistaChat({
  entrevistaId,
  indice,
  mensajesIniciales,
  mostrarPortal = true,
  onSeccionCompletada,
  seccion,
  titulo,
}: {
  entrevistaId: string;
  indice: number;
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
          onSeccionCompletada={onSeccionCompletada}
          seccionId={seccion.id}
        >
          <EntrevistaShell
            acciones={
              <GuardarEntrevistaButton
                entrevistaId={entrevistaId}
                seccionId={seccion.id}
              />
            }
            mostrarPortal={mostrarPortal}
            seccion={`Sección ${indice + 1}: ${seccion.titulo}`}
            titulo={titulo}
          >
            <ChatShell
              composerAction={<FinalizarEntrevistaButton />}
              onSeccionCompletada={onSeccionCompletada}
            />
          </EntrevistaShell>
          <EntrevistaTour
            entrevistaId={entrevistaId}
            habilitado={indice === 0}
          />
        </ActiveChatProvider>
      </SidebarProvider>
    </DataStreamProvider>
  );
}
