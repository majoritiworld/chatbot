import { expect, test } from "@playwright/test";
import {
  createUIMessageStream,
  readUIMessageStream,
  simulateReadableStream,
  streamText,
} from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { mensajesATurnos } from "@/lib/consultoria/mensajes-a-turnos";
import {
  ErrorGuardadoTranscripcion,
  streamEntrevista,
} from "@/lib/consultoria/stream-entrevista";
import type { ChatMessage } from "@/lib/types";

function modelStream() {
  return streamText({
    model: new MockLanguageModelV3({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunkDelayInMs: 0,
          chunks: [
            { id: "first", type: "text-start" },
            { delta: "Hola.", id: "first", type: "text-delta" },
            { id: "first", type: "text-end" },
            { id: "second", type: "text-start" },
            { delta: "¿Qué cambió?", id: "second", type: "text-delta" },
            { id: "second", type: "text-end" },
            {
              finishReason: { raw: undefined, unified: "stop" },
              type: "finish",
              usage: {
                inputTokens: {
                  cacheRead: 0,
                  cacheWrite: 0,
                  noCache: 1,
                  total: 1,
                },
                outputTokens: { reasoning: 0, text: 1, total: 1 },
              },
            },
          ],
        }),
      }),
    }),
    prompt: "Begin",
  }).stream;
}

test("browser and persistence receive the same ID and all text parts", async () => {
  let saved: ChatMessage | undefined;
  let browser: ChatMessage | undefined;
  const order: string[] = [];
  const stream = streamEntrevista({
    despuesDeGuardar: () => {
      order.push("advance");
    },
    guardar: (message) => {
      saved = message;
      order.push("save");
      return Promise.resolve();
    },
    sendReasoning: false,
    stream: modelStream(),
  });
  for await (const message of readUIMessageStream<ChatMessage>({ stream })) {
    browser = message;
  }
  expect(saved).toBeDefined();
  expect(browser?.id).toBe(saved?.id);
  expect(browser?.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(mensajesATurnos(saved ? [saved] : [], "section")[0].texto).toBe(
    "Hola.\n\n¿Qué cambió?"
  );
  expect(order).toEqual(["save", "advance"]);
});

test("failed persistence emits an actionable error and never announces advancement", async () => {
  let advanced = false;
  const errors: unknown[] = [];
  const stream = createUIMessageStream({
    execute: ({ writer }) =>
      writer.merge(
        streamEntrevista({
          despuesDeGuardar: () => {
            advanced = true;
          },
          guardar: () => Promise.reject(new Error("database unavailable")),
          sendReasoning: false,
          stream: modelStream(),
        })
      ),
    onError: (error) =>
      error instanceof ErrorGuardadoTranscripcion
        ? error.message
        : "Unexpected error",
  });
  for await (const _message of readUIMessageStream({
    onError: (error) => {
      errors.push(error);
    },
    stream,
  })) {
    /* drain the browser stream */
  }
  expect(advanced).toBe(false);
  expect(errors.map(String).join(" ")).toContain(
    "No se pudo guardar la conversación"
  );
  expect(errors.map(String).join(" ")).not.toContain("database unavailable");
});
