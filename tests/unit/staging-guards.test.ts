import { expect, test } from "@playwright/test";
import { withRestoredProyectoId } from "../support/restore-proyecto";
import {
  esEmailDePrueba,
  exigirCuentasDePrueba,
} from "../support/staging-accounts";

test("staging emails must belong to the test domain", () => {
  expect(esEmailDePrueba("participante@example.test")).toBe(true);
  expect(esEmailDePrueba("cliente@empresa.com")).toBe(false);
  expect(() =>
    exigirCuentasDePrueba({
      majoritiEmail: "admin@example.test",
      otherEmail: "otro@example.test",
      participantEmail: "cliente@empresa.com",
    })
  ).toThrow(/solo admiten cuentas/);
});

test("authorized project assignment restores the original value after failure", async () => {
  const store = new Map<string, string | null>([
    ["user", "11111111-1111-4111-8111-111111111111"],
  ]);
  await expect(
    withRestoredProyectoId({
      getProyectoId: (id) => Promise.resolve(store.get(id) ?? null),
      nextProyectoId: "22222222-2222-4222-8222-222222222222",
      setProyectoId: (id, proyectoId) => {
        store.set(id, proyectoId);
        return Promise.reject(new Error("assignment failed"));
      },
      userId: "user",
    })
  ).rejects.toThrow("assignment failed");
  expect(store.get("user")).toBe("11111111-1111-4111-8111-111111111111");
});

test("successful assignment is still rolled back to the original project", async () => {
  const store = new Map<string, string | null>([
    ["user", "11111111-1111-4111-8111-111111111111"],
  ]);
  await withRestoredProyectoId({
    getProyectoId: (id) => Promise.resolve(store.get(id) ?? null),
    nextProyectoId: "22222222-2222-4222-8222-222222222222",
    setProyectoId: (id, proyectoId) => {
      store.set(id, proyectoId);
      return Promise.resolve();
    },
    userId: "user",
  });
  expect(store.get("user")).toBe("11111111-1111-4111-8111-111111111111");
});
