import { expect, test } from "@playwright/test";
import {
  crearAvisadorError,
  payloadReintento,
  ultimoMensajeUsuario,
} from "@/lib/consultoria/reintento-mensaje";
import type { ChatMessage } from "@/lib/types";

const primero: ChatMessage = {
  id: "11111111-1111-4111-8111-111111111111",
  parts: [{ text: "mismo texto", type: "text" }],
  role: "user",
};
const segundo: ChatMessage = {
  id: "22222222-2222-4222-8222-222222222222",
  parts: [{ text: "mismo texto", type: "text" }],
  role: "user",
};

test("retry payload keeps the original message id", () => {
  expect(payloadReintento(primero).messageId).toBe(primero.id);
  expect(payloadReintento(primero).parts).toEqual(primero.parts);
});

test("two intentional user turns with the same text stay distinct", () => {
  expect(primero.id).not.toBe(segundo.id);
  expect(ultimoMensajeUsuario([primero, segundo])?.id).toBe(segundo.id);
});

test("identical error notices are emitted once inside the window", () => {
  const emitted: string[] = [];
  const avisar = crearAvisadorError(2000);
  expect(avisar("fallo", (texto) => emitted.push(texto))).toBe(true);
  expect(avisar("fallo", (texto) => emitted.push(texto))).toBe(false);
  expect(avisar("otro", (texto) => emitted.push(texto))).toBe(true);
  expect(emitted).toEqual(["fallo", "otro"]);
});
