"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";

export const VERBOS_PENSANDO_ES = [
  "Pensando…",
  "Reflexionando…",
  "Considerando…",
  "Analizando…",
  "Elaborando…",
  "Madurando…",
  "Rumiando…",
  "Ponderando…",
  "Hilvanando…",
  "Destilando…",
  "Conectando…",
  "Sintetizando…",
] as const;

export const VERBOS_PENSANDO_EN = [
  "Pondering…",
  "Considering…",
  "Reasoning…",
  "Weighing…",
  "Distilling…",
  "Connecting…",
  "Composing…",
  "Reflecting…",
  "Examining…",
  "Synthesizing…",
] as const;

const INTERVALO_MS = 2400;

function indiceAlAzar(length: number) {
  if (length <= 1) {
    return 0;
  }
  return Math.floor(Math.random() * length);
}

function siguienteIndice(actual: number, length: number) {
  if (length <= 1) {
    return 0;
  }
  const salto = Math.floor(Math.random() * (length - 1)) + 1;
  return (actual + salto) % length;
}

export function ThinkingVerb({
  label,
  verbs,
}: {
  label: string;
  verbs: readonly string[];
}) {
  const [index, setIndex] = useState(() => indiceAlAzar(verbs.length));

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((actual) => siguienteIndice(actual, verbs.length));
    }, INTERVALO_MS);
    return () => window.clearInterval(id);
  }, [verbs.length]);

  const verbo = verbs.at(index) ?? label;

  return (
    <>
      <span className="sr-only">{label}</span>
      <AnimatePresence mode="wait">
        <motion.span
          animate={{ opacity: 1, y: 0 }}
          aria-hidden="true"
          className="inline-block"
          exit={{ opacity: 0, y: -4 }}
          initial={{ opacity: 0, y: 4 }}
          key={verbo}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <Shimmer as="span" className="font-medium" duration={1}>
            {verbo}
          </Shimmer>
        </motion.span>
      </AnimatePresence>
    </>
  );
}
