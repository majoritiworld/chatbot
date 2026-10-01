"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatMessage } from "@/lib/types";

const PREFIJO_SALUDO = "saludo-";
const CLAVE_VISTO = "entrevista-saludo-visto:";

/** Pause before each paragraph, as if it were being typed. */
export function pausaParrafo(parrafo: string) {
  return Math.min(1100, 300 + parrafo.length * 6);
}

function textoDe(message: ChatMessage) {
  return (message.parts ?? [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

function yaVisto(clave: string) {
  try {
    return window.localStorage.getItem(clave) === "1";
  } catch {
    return true;
  }
}

function marcarVisto(clave: string) {
  try {
    window.localStorage.setItem(clave, "1");
  } catch {
    // Without storage the greeting may animate again; nothing is lost.
  }
}

/**
 * Reveals the opening greeting paragraph by paragraph the first time it is
 * shown. Resumed interviews, reduced motion and anything already exchanged
 * show it whole. `completar` shows the rest at once.
 */
export function useSaludoProgresivo({
  mensajesInicio,
  pendiente,
  sinHistorial,
}: {
  mensajesInicio: ChatMessage[];
  pendiente: boolean;
  sinHistorial: boolean;
}) {
  const saludo = mensajesInicio.at(0);
  const esSaludo = saludo?.id.startsWith(PREFIJO_SALUDO) === true;
  const texto = esSaludo && saludo ? textoDe(saludo) : "";
  const parrafos = useMemo(() => (texto ? texto.split("\n\n") : []), [texto]);
  const [visibles, setVisibles] = useState<number | null>(null);

  const animable =
    esSaludo && pendiente && sinHistorial && mensajesInicio.length === 1;
  const clave = saludo ? `${CLAVE_VISTO}${saludo.id}` : "";

  useEffect(() => {
    if (!(animable && clave) || visibles !== null) {
      return;
    }
    const reducido = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducido || yaVisto(clave)) {
      setVisibles(parrafos.length);
      return;
    }
    marcarVisto(clave);
    setVisibles(1);
  }, [animable, clave, parrafos.length, visibles]);

  // Until storage and motion preferences are read, show only the first
  // paragraph so the full text does not flash before collapsing.
  const mostrados = visibles ?? 1;
  const escribiendo = animable && mostrados < parrafos.length;

  useEffect(() => {
    if (!escribiendo || visibles === null) {
      return;
    }
    const siguiente = parrafos[visibles] ?? "";
    const temporizador = window.setTimeout(() => {
      setVisibles((actual) => (actual ?? 0) + 1);
    }, pausaParrafo(siguiente));
    return () => window.clearTimeout(temporizador);
  }, [escribiendo, parrafos, visibles]);

  const completar = useCallback(() => {
    setVisibles(parrafos.length);
  }, [parrafos.length]);

  const mensajes = useMemo(() => {
    if (!(escribiendo && saludo)) {
      return mensajesInicio;
    }
    return [
      {
        ...saludo,
        parts: [
          {
            text: parrafos.slice(0, mostrados).join("\n\n"),
            type: "text" as const,
          },
        ],
      },
      ...mensajesInicio.slice(1),
    ];
  }, [escribiendo, mensajesInicio, mostrados, parrafos, saludo]);

  return { completar, escribiendo, mensajes, textoCompleto: texto };
}
