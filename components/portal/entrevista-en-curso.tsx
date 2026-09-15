"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Toaster, toast } from "sonner";
import { EntrevistaBienvenida } from "@/components/portal/entrevista-bienvenida";
import { EntrevistaChat } from "@/components/portal/entrevista-chat";
import { EntrevistaCompletada } from "@/components/portal/entrevista-completada";
import { EntrevistaOnboarding } from "@/components/portal/entrevista-onboarding";
import { EntrevistaPresentacionSeccion } from "@/components/portal/entrevista-presentacion-seccion";
import { EntrevistaRevision } from "@/components/portal/entrevista-revision";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import type {
  FlujoEntrevista,
  SeccionEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";

const REDIRECT_POST_SUBMIT_MS = 2800;

export function EntrevistaEnCurso({
  consentimientoEn,
  correoAgradecimientoEn,
  entrevistaId,
  estadoInicial,
  flujoEstadoInicial,
  mensajesIniciales,
  mostrarPortal = true,
  proyectoNombre,
  seccionActualInicial,
  secciones,
  stakeholderNombre,
  titulo,
}: {
  consentimientoEn?: string | null;
  correoAgradecimientoEn?: string | null;
  entrevistaId: string;
  estadoInicial: string;
  flujoEstadoInicial: FlujoEntrevista;
  mensajesIniciales: ChatMessage[];
  mostrarPortal?: boolean;
  proyectoNombre?: string | null;
  seccionActualInicial: number;
  secciones: SeccionEntrevista[];
  stakeholderNombre?: string | null;
  titulo?: string;
}) {
  const router = useRouter();
  const yaEstabaCompletada = estadoInicial === "completada";
  const [completada, setCompletada] = useState(yaEstabaCompletada);
  const [correoPendiente, setCorreoPendiente] = useState(
    yaEstabaCompletada && !correoAgradecimientoEn
  );
  const submitEnCursoRef = useRef(false);
  const [flujoEstado, setFlujoEstado] =
    useState<FlujoEntrevista>(flujoEstadoInicial);
  const [seccionActual, setSeccionActual] = useState(seccionActualInicial);
  const [onboardingListo, setOnboardingListo] = useState(
    Boolean(consentimientoEn) || mensajesIniciales.length > 0
  );
  const [pending, startTransition] = useTransition();
  const marcarOnboardingListo = useCallback(() => {
    setOnboardingListo(true);
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
          const nueva = payload.new as { estado?: string };
          if (nueva.estado === "completada" && !submitEnCursoRef.current) {
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
    if (
      !(completada && mostrarPortal) ||
      yaEstabaCompletada ||
      correoPendiente
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      router.replace("/portal?listo=1");
    }, REDIRECT_POST_SUBMIT_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [completada, correoPendiente, mostrarPortal, router, yaEstabaCompletada]);

  const avanzar = useCallback(
    (desde: "bienvenida" | "presentacion") => {
      startTransition(async () => {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/entrevista/flujo`,
            {
              body: JSON.stringify({ desde, entrevistaId }),
              headers: { "Content-Type": "application/json" },
              method: "POST",
            }
          );
          const data = (await response.json().catch(() => null)) as {
            error?: string;
            flujoEstado?: FlujoEntrevista;
          } | null;
          if (!response.ok || !data?.flujoEstado) {
            throw new Error(data?.error ?? "No se pudo continuar");
          }
          setFlujoEstado(data.flujoEstado);
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "No se pudo continuar"
          );
        }
      });
    },
    [entrevistaId]
  );

  const marcarSeccionCompletada = useCallback(
    ({
      flujoEstado: siguienteEstado,
      seccionActual: siguienteSeccion,
    }: {
      flujoEstado: FlujoEntrevista;
      seccionActual: number;
    }) => {
      setSeccionActual(siguienteSeccion);
      setFlujoEstado(siguienteEstado);
    },
    []
  );
  const continuarBienvenida = useCallback(
    () => avanzar("bienvenida"),
    [avanzar]
  );
  const contestarSeccion = useCallback(
    () => avanzar("presentacion"),
    [avanzar]
  );

  const enviar = useCallback(() => {
    submitEnCursoRef.current = true;
    startTransition(async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/entrevista/enviar`,
          {
            body: JSON.stringify({ entrevistaId }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        );
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          correoEnviado?: boolean;
          ok?: boolean;
          warning?: string;
        } | null;
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error ?? "No se pudo enviar la entrevista");
        }
        if (data.warning) {
          toast.warning(data.warning);
        }
        setCorreoPendiente(data.correoEnviado === false);
        setCompletada(true);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo enviar la entrevista"
        );
      } finally {
        submitEnCursoRef.current = false;
      }
    });
  }, [entrevistaId]);

  if (completada) {
    return (
      <EntrevistaShell mostrarPortal={mostrarPortal} titulo={titulo}>
        <EntrevistaCompletada
          correoPendiente={correoPendiente}
          mostrarPortal={mostrarPortal}
          onReintentarCorreo={enviar}
          pending={pending}
        />
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

  if (flujoEstado === "bienvenida") {
    return (
      <EntrevistaShell mostrarPortal={mostrarPortal} titulo={titulo}>
        <EntrevistaBienvenida
          nombre={stakeholderNombre}
          numeroSecciones={secciones.length}
          onContinuar={continuarBienvenida}
          pending={pending}
        />
        <Toaster position="top-center" />
      </EntrevistaShell>
    );
  }

  if (flujoEstado === "revision") {
    return (
      <EntrevistaShell mostrarPortal={mostrarPortal} titulo={titulo}>
        <EntrevistaRevision
          nombre={stakeholderNombre}
          numeroSecciones={secciones.length}
          onEnviar={enviar}
          pending={pending}
        />
        <Toaster position="top-center" />
      </EntrevistaShell>
    );
  }

  const seccion = secciones.at(seccionActual);
  if (!seccion) {
    return (
      <EntrevistaShell mostrarPortal={mostrarPortal} titulo={titulo}>
        <p className="px-6 py-12 text-destructive text-sm" role="alert">
          Esta entrevista no tiene una sección activa. Contacta a Majoriti.
        </p>
      </EntrevistaShell>
    );
  }

  if (flujoEstado === "presentacion") {
    return (
      <EntrevistaShell mostrarPortal={mostrarPortal} titulo={titulo}>
        <EntrevistaPresentacionSeccion
          indice={seccionActual}
          numeroSecciones={secciones.length}
          onContestar={contestarSeccion}
          pending={pending}
          seccion={seccion}
        />
        <Toaster position="top-center" />
      </EntrevistaShell>
    );
  }

  return (
    <EntrevistaChat
      entrevistaId={entrevistaId}
      key={seccion.id}
      mensajesIniciales={
        seccionActual === seccionActualInicial ? mensajesIniciales : []
      }
      mostrarPortal={mostrarPortal}
      onSeccionCompletada={marcarSeccionCompletada}
      seccion={seccion}
      titulo={titulo}
    />
  );
}
