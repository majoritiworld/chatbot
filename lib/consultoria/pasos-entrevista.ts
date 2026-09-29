import {
  hasToolCall,
  isStepCount,
  type PrepareStepFunction,
  type StopCondition,
  type ToolChoice,
  type ToolSet,
} from "ai";
import { herramientasCierreActivas } from "@/lib/consultoria/cierre-seccion";
import type { ChatMessage } from "@/lib/types";

const OFERTA = "ofrecerCierreSeccion" as const;

/** Asking a follow-up and offering the close are exclusive in one turn. */
export function herramientasDelTurno({
  forzarOferta,
  messages,
  seguimientoSiguiente,
}: {
  forzarOferta: boolean;
  messages: ChatMessage[];
  seguimientoSiguiente?: string;
}): Array<
  "completarSeccion" | "ofrecerCierreSeccion" | "ofrecerContinuarOGuardar"
> {
  if (forzarOferta) {
    return [OFERTA];
  }
  if (seguimientoSiguiente) {
    return [];
  }
  return [...herramientasCierreActivas(messages)];
}

/**
 * With a follow-up menu, a close offer must never reach the participant as a
 * bare button. Other guides keep their original stop rule.
 */
export function pasosTurnoEntrevista<T extends ToolSet>({
  conSeguimientos,
  forzarOferta,
}: {
  conSeguimientos: boolean;
  forzarOferta: boolean;
}): {
  prepareStep?: PrepareStepFunction<T>;
  stopWhen: StopCondition<T>[];
} {
  if (!conSeguimientos) {
    return {
      stopWhen: [
        hasToolCall("completarSeccion", OFERTA, "ofrecerContinuarOGuardar"),
        isStepCount(2),
      ],
    };
  }

  const ofrecioSinTexto = (
    step: { text: string; toolCalls: Array<{ toolName: string }> } | undefined
  ) =>
    Boolean(
      step?.toolCalls.some((call) => call.toolName === OFERTA) &&
        step.text.trim().length === 0
    );

  return {
    prepareStep: ({ stepNumber, steps }) => {
      if (stepNumber === 0) {
        return forzarOferta
          ? {
              toolChoice: { toolName: OFERTA, type: "tool" } as ToolChoice<T>,
            }
          : undefined;
      }
      return ofrecioSinTexto(steps.at(-1))
        ? { activeTools: [], toolChoice: "none" }
        : undefined;
    },
    stopWhen: [
      hasToolCall("completarSeccion", "ofrecerContinuarOGuardar"),
      ({ steps }) => {
        const ultimo = steps.at(-1);
        return Boolean(
          ultimo?.toolCalls.some((call) => call.toolName === OFERTA) &&
            !ofrecioSinTexto(ultimo)
        );
      },
      isStepCount(2),
    ],
  };
}
