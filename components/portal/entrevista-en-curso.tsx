"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { EntrevistaChat } from "@/components/portal/entrevista-chat";
import { EntrevistaCompletada } from "@/components/portal/entrevista-completada";
import { EntrevistaOnboarding } from "@/components/portal/entrevista-onboarding";
import { EntrevistaPantallaTransicion } from "@/components/portal/entrevista-pantalla-transicion";
import { EntrevistaPresentacionSeccion } from "@/components/portal/entrevista-presentacion-seccion";
import { EntrevistaRevision } from "@/components/portal/entrevista-revision";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { Button } from "@/components/ui/button";
import type {
  FlujoEntrevista,
  SeccionEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import {
  consentimientoEntrevistaListo,
  encadenarAvanceInicial,
  pantallaParticipanteEntrevista,
  siguienteTransicionInicial,
  textoFinalizandoEntrevista,
} from "@/lib/consultoria/entrevista-piloto";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";

const REDIRECT_POST_SUBMIT_MS = 2800;

export function EntrevistaEnCurso({
  cliente,
  consentimientoEn,
  correoAgradecimientoEn,
  correoUsuario,
  entrevistaId,
  estadoInicial,
  flujoEstadoInicial,
  mensajesIniciales,
  mostrarPortal = false,
  seccionActualInicial,
  secciones,
  stakeholderNombre,
  titulo,
}: {
  cliente?: string | null;
  consentimientoEn?: string | null;
  correoAgradecimientoEn?: string | null;
  correoUsuario?: string | null;
  entrevistaId: string;
  estadoInicial: string;
  flujoEstadoInicial: FlujoEntrevista;
  mensajesIniciales: ChatMessage[];
  mostrarPortal?: boolean;
  seccionActualInicial: number;
  secciones: SeccionEntrevista[];
  stakeholderNombre?: string | null;
  titulo?: string;
}) {
  const router = useRouter();
  const yaEstabaCompletada = estadoInicial === "completada";
  const llegoEnRevision = flujoEstadoInicial === "revision";
  const [completada, setCompletada] = useState(yaEstabaCompletada);
  const [correoPendiente, setCorreoPendiente] = useState(
    yaEstabaCompletada && !correoAgradecimientoEn
  );
  const [errorEntrega, setErrorEntrega] = useState(false);
  const submitEnCursoRef = useRef(false);
  const [flujoEstado, setFlujoEstado] =
    useState<FlujoEntrevista>(flujoEstadoInicial);
  const flujoRef = useRef(flujoEstadoInicial);
  const [seccionActual, setSeccionActual] = useState(seccionActualInicial);
  const [onboardingListo, setOnboardingListo] = useState(
    consentimientoEntrevistaListo(consentimientoEn)
  );
  const [avanceError, setAvanceError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const avanceLockRef = useRef(false);

  const marcarOnboardingListo = useCallback(() => {
    setOnboardingListo(true);
    setAvanceError(null);
  }, []);

  const postAvance = useCallback(
    async (desde: "bienvenida" | "presentacion") => {
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
      return data.flujoEstado;
    },
    [entrevistaId]
  );

  const encadenar = useCallback(() => {
    if (avanceLockRef.current) {
      return;
    }

    avanceLockRef.current = true;
    startTransition(async () => {
      const signal = { cancelled: false };
      try {
        const siguiente = await encadenarAvanceInicial({
          avanzar: postAvance,
          flujoEstado: flujoRef.current,
          seccionActual,
          signal,
        });
        flujoRef.current = siguiente;
        setFlujoEstado(siguiente);
        setAvanceError(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "No se pudo continuar";
        setAvanceError(message);
        toast.error(message);
      } finally {
        avanceLockRef.current = false;
      }
    });
  }, [postAvance, seccionActual]);

  useEffect(() => {
    if (!onboardingListo || completada) {
      return;
    }
    if (!siguienteTransicionInicial(flujoRef.current, seccionActual)) {
      return;
    }
    encadenar();
  }, [completada, encadenar, onboardingListo, seccionActual]);

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

  const enviar = useCallback(() => {
    submitEnCursoRef.current = true;
    setErrorEntrega(false);
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
        setErrorEntrega(false);
      } catch (error) {
        setErrorEntrega(true);
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

  const marcarSeccionCompletada = useCallback(
    ({
      flujoEstado: siguienteEstado,
      seccionActual: siguienteSeccion,
    }: {
      flujoEstado: FlujoEntrevista;
      seccionActual: number;
    }) => {
      flujoRef.current = siguienteEstado;
      setSeccionActual(siguienteSeccion);
      setFlujoEstado(siguienteEstado);
      if (siguienteEstado === "revision") {
        enviar();
      }
    },
    [enviar]
  );

  const contestarSeccion = useCallback(() => {
    if (avanceLockRef.current) {
      return;
    }
    avanceLockRef.current = true;
    startTransition(async () => {
      try {
        const siguiente = await postAvance("presentacion");
        flujoRef.current = siguiente;
        setFlujoEstado(siguiente);
        setAvanceError(null);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo continuar"
        );
      } finally {
        avanceLockRef.current = false;
      }
    });
  }, [postAvance]);

  const reintentarCorreo = useCallback(() => {
    startTransition(async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/entrevista/enviar`,
          {
            body: JSON.stringify({ entrevistaId, soloCorreo: true }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          }
        );
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          correoEnviado?: boolean;
          ok?: boolean;
        } | null;
        if (!response.ok || !data?.ok) {
          throw new Error(data?.error ?? "No se pudo reenviar el correo");
        }
        setCorreoPendiente(data.correoEnviado === false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudo reenviar el correo"
        );
      }
    });
  }, [entrevistaId]);

  const pantalla = pantallaParticipanteEntrevista({
    completada,
    errorEntrega,
    flujoEstado,
    llegoEnRevision,
    onboardingListo,
    seccionActual,
  });

  if (pantalla === "completada") {
    return (
      <EntrevistaShell
        compactoMovil
        correoUsuario={correoUsuario}
        mostrarPortal={mostrarPortal}
        titulo={titulo}
      >
        <EntrevistaCompletada
          correoPendiente={correoPendiente}
          mostrarPortal={mostrarPortal}
          onReintentarCorreo={reintentarCorreo}
          pending={pending}
        />
      </EntrevistaShell>
    );
  }

  if (pantalla === "onboarding") {
    return (
      <EntrevistaOnboarding
        cliente={cliente}
        correoUsuario={correoUsuario}
        entrevistaId={entrevistaId}
        mostrarPortal={mostrarPortal}
        nombre={stakeholderNombre}
        numeroSecciones={secciones.length}
        onAceptado={marcarOnboardingListo}
        titulo={titulo}
      />
    );
  }

  if (pantalla === "finalizando") {
    return (
      <EntrevistaShell
        compactoMovil
        correoUsuario={correoUsuario}
        mostrarPortal={mostrarPortal}
        titulo={titulo}
      >
        <EntrevistaPantallaTransicion>
          <p className="text-muted-foreground text-sm">
            {textoFinalizandoEntrevista()}
          </p>
        </EntrevistaPantallaTransicion>
      </EntrevistaShell>
    );
  }

  if (pantalla === "entrega_pendiente") {
    return (
      <EntrevistaShell
        compactoMovil
        correoUsuario={correoUsuario}
        mostrarPortal={mostrarPortal}
        titulo={titulo}
      >
        <EntrevistaRevision
          errorEntrega={errorEntrega}
          numeroSecciones={secciones.length}
          onEnviar={enviar}
          pending={pending}
        />
      </EntrevistaShell>
    );
  }

  if (pantalla === "avance") {
    return (
      <EntrevistaShell
        compactoMovil
        correoUsuario={correoUsuario}
        mostrarPortal={mostrarPortal}
        titulo={titulo}
      >
        <EntrevistaPantallaTransicion>
          {avanceError ? (
            <>
              <p className="text-destructive text-sm" role="alert">
                {avanceError}
              </p>
              <Button
                className="w-fit"
                disabled={pending}
                onClick={encadenar}
                type="button"
              >
                {pending ? "Reintentando…" : "Reintentar"}
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Abriendo la entrevista…
            </p>
          )}
        </EntrevistaPantallaTransicion>
      </EntrevistaShell>
    );
  }

  const seccion = secciones.at(seccionActual);
  if (!seccion) {
    return (
      <EntrevistaShell
        compactoMovil
        correoUsuario={correoUsuario}
        mostrarPortal={mostrarPortal}
        titulo={titulo}
      >
        <EntrevistaPantallaTransicion>
          <p className="text-destructive text-sm" role="alert">
            Esta entrevista no tiene una sección activa. Contacta a Majoriti.
          </p>
        </EntrevistaPantallaTransicion>
      </EntrevistaShell>
    );
  }

  if (flujoEstado === "presentacion") {
    return (
      <EntrevistaShell
        compactoMovil
        correoUsuario={correoUsuario}
        mostrarPortal={mostrarPortal}
        titulo={titulo}
      >
        <EntrevistaPresentacionSeccion
          indice={seccionActual}
          numeroSecciones={secciones.length}
          onContestar={contestarSeccion}
          pending={pending}
          seccion={seccion}
        />
      </EntrevistaShell>
    );
  }

  if (flujoEstado !== "chat") {
    return (
      <EntrevistaShell
        compactoMovil
        correoUsuario={correoUsuario}
        mostrarPortal={mostrarPortal}
        titulo={titulo}
      >
        <EntrevistaPantallaTransicion>
          <p className="text-muted-foreground text-sm">
            La entrevista todavía no está lista para responder.
          </p>
        </EntrevistaPantallaTransicion>
      </EntrevistaShell>
    );
  }

  return (
    <EntrevistaChat
      correoUsuario={correoUsuario}
      entrevistaId={entrevistaId}
      indice={seccionActual}
      key={seccion.id}
      mensajesIniciales={
        seccionActual === seccionActualInicial ? mensajesIniciales : []
      }
      mostrarPortal={mostrarPortal}
      numeroSecciones={secciones.length}
      onSeccionCompletada={marcarSeccionCompletada}
      seccion={seccion}
      titulo={titulo}
    />
  );
}
