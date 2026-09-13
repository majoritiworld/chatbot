"use client";

import { useEffect, useState } from "react";
import { EntrevistaChat } from "@/components/portal/entrevista-chat";
import { EntrevistaCompletada } from "@/components/portal/entrevista-completada";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";

export function EntrevistaEnCurso({
  entrevistaId,
  estadoInicial,
  mensajesIniciales,
  mostrarPortal = true,
  titulo,
}: {
  entrevistaId: string;
  estadoInicial: string;
  mensajesIniciales: ChatMessage[];
  mostrarPortal?: boolean;
  titulo?: string;
}) {
  // titulo is a plain string here: this component crosses the server/client
  // boundary, so it cannot take arbitrary nodes.
  const [completada, setCompletada] = useState(estadoInicial === "completada");

  useEffect(() => {
    if (completada) {
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`entrevista:${entrevistaId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "entrevista",
          filter: `id=eq.${entrevistaId}`,
        },
        (payload) => {
          if ((payload.new as { estado?: string }).estado === "completada") {
            setCompletada(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entrevistaId, completada]);

  if (completada) {
    return (
      <EntrevistaShell mostrarPortal={mostrarPortal} titulo={titulo}>
        <EntrevistaCompletada mostrarPortal={mostrarPortal} />
      </EntrevistaShell>
    );
  }

  return (
    <EntrevistaChat
      entrevistaId={entrevistaId}
      mensajesIniciales={mensajesIniciales}
      mostrarPortal={mostrarPortal}
      onCompletada={() => setCompletada(true)}
      titulo={titulo}
    />
  );
}
