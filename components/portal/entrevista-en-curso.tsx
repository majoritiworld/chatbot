"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EntrevistaChat } from "@/components/portal/entrevista-chat";
import { EntrevistaCompletada } from "@/components/portal/entrevista-completada";
import { EntrevistaOnboarding } from "@/components/portal/entrevista-onboarding";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";

const REDIRECT_POST_SUBMIT_MS = 2800;

export function EntrevistaEnCurso({
  consentimientoEn,
  entrevistaId,
  estadoInicial,
  mensajesIniciales,
  mostrarPortal = true,
  proyectoNombre,
  titulo,
}: {
  consentimientoEn?: string | null;
  entrevistaId: string;
  estadoInicial: string;
  mensajesIniciales: ChatMessage[];
  mostrarPortal?: boolean;
  proyectoNombre?: string | null;
  titulo?: string;
}) {
  // titulo is a plain string here: this component crosses the server/client
  // boundary, so it cannot take arbitrary nodes.
  const router = useRouter();
  const yaEstabaCompletada = estadoInicial === "completada";
  const [completada, setCompletada] = useState(yaEstabaCompletada);
  const [onboardingListo, setOnboardingListo] = useState(
    Boolean(consentimientoEn) || mensajesIniciales.length > 0
  );
  const marcarOnboardingListo = useCallback(() => {
    setOnboardingListo(true);
  }, []);
  const marcarCompletada = useCallback(() => {
    setCompletada(true);
  }, []);

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
          filter: `id=eq.${entrevistaId}`,
          schema: "public",
          table: "entrevista",
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

  useEffect(() => {
    if (!(completada && mostrarPortal)) {
      return;
    }

    if (yaEstabaCompletada) {
      router.replace("/portal");
      return;
    }

    const timeout = setTimeout(() => {
      router.replace("/portal?listo=1");
    }, REDIRECT_POST_SUBMIT_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [completada, mostrarPortal, router, yaEstabaCompletada]);

  if (completada && mostrarPortal && yaEstabaCompletada) {
    return null;
  }

  if (completada) {
    return (
      <EntrevistaShell mostrarPortal={mostrarPortal} titulo={titulo}>
        <EntrevistaCompletada mostrarPortal={mostrarPortal} />
      </EntrevistaShell>
    );
  }

  if (!onboardingListo) {
    return (
      <EntrevistaOnboarding
        entrevistaId={entrevistaId}
        mostrarPortal={mostrarPortal}
        onAceptado={marcarOnboardingListo}
        proyectoNombre={proyectoNombre}
        titulo={titulo}
      />
    );
  }

  return (
    <EntrevistaChat
      entrevistaId={entrevistaId}
      mensajesIniciales={mensajesIniciales}
      mostrarPortal={mostrarPortal}
      onCompletada={marcarCompletada}
      titulo={titulo}
    />
  );
}
