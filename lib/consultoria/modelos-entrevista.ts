import type { SharedV4ProviderOptions } from "@ai-sdk/provider";

/**
 * Models a guide may pin for its interviews. Projects that pin nothing keep
 * the global chat model.
 */
const MODELOS_ENTREVISTA = {
  "openai/gpt-4.1": {},
  "openai/gpt-5.4-mini": { openai: { reasoningEffort: "low" } },
  "openai/gpt-6-luna": { openai: { reasoningEffort: "low" } },
  "openai/gpt-6-sol": { openai: { reasoningEffort: "low" } },
  "openai/gpt-6.1-sol": { openai: { reasoningEffort: "low" } },
  "xai/grok-4.1-fast-non-reasoning": { gateway: { order: ["xai"] } },
} satisfies Record<string, SharedV4ProviderOptions>;

export type ModeloEntrevista = keyof typeof MODELOS_ENTREVISTA;

export function esModeloEntrevista(id: unknown): id is ModeloEntrevista {
  return typeof id === "string" && Object.hasOwn(MODELOS_ENTREVISTA, id);
}

export function opcionesModeloEntrevista(
  id: ModeloEntrevista
): SharedV4ProviderOptions {
  return MODELOS_ENTREVISTA[id];
}
