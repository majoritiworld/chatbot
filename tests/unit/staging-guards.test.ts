import { expect, test } from "@playwright/test";
import {
  withRestoredProyectoId,
  withRestoredRolYProyecto,
} from "../support/restore-proyecto";
import {
  exigirCuentasDePrueba,
  exigirListaAutorizada,
  extraerAccessToken,
  sesionAutorizada,
} from "../support/staging-accounts";

const cuentas = {
  majoriti: {
    email: "qa-majoriti@majoriti.world",
    id: "33333333-3333-4333-8333-333333333333",
  },
  other: {
    email: "qa-otro@majoriti.world",
    id: "22222222-2222-4222-8222-222222222222",
  },
  participant: {
    email: "qa-participante@majoriti.world",
    id: "11111111-1111-4111-8111-111111111111",
  },
};

test("staging accounts must be an explicit allowlist of real mailboxes", () => {
  expect(() =>
    exigirCuentasDePrueba({
      ...cuentas,
      participant: {
        ...cuentas.participant,
        email: "participante@example.test",
      },
    })
  ).toThrow(/buzones reales/);
  expect(() =>
    exigirListaAutorizada({
      allowedEmails: [
        cuentas.participant.email,
        cuentas.other.email,
        "cliente@empresa.com",
      ],
      allowedIds: [
        cuentas.participant.id,
        cuentas.other.id,
        cuentas.majoriti.id,
      ],
      cuentas,
    })
  ).toThrow(/fuera de STAGING_ALLOWED_EMAILS/);
  exigirListaAutorizada({
    allowedEmails: [
      cuentas.participant.email,
      cuentas.other.email,
      cuentas.majoriti.email,
    ],
    allowedIds: [cuentas.participant.id, cuentas.other.id, cuentas.majoriti.id],
    cuentas,
  });
});

test("a session is rejected when uuid or email do not match the allowlist", () => {
  expect(
    sesionAutorizada(
      { email: cuentas.participant.email, id: cuentas.participant.id },
      cuentas.participant
    )
  ).toBe(true);
  expect(
    sesionAutorizada(
      { email: cuentas.other.email, id: cuentas.participant.id },
      cuentas.participant
    )
  ).toBe(false);
  expect(
    sesionAutorizada(
      { email: cuentas.participant.email, id: cuentas.other.id },
      cuentas.participant
    )
  ).toBe(false);
});

test("storage state access tokens are read without sharing them", () => {
  const token =
    "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEiLCJlbWFpbCI6InAxQG0uZXhhbXBsZSJ9.";
  expect(
    extraerAccessToken({
      cookies: [
        {
          name: "sb-auth-token",
          value: `base64-${Buffer.from(
            JSON.stringify({ access_token: token })
          ).toString("base64")}`,
        },
      ],
    })
  ).toBe(token);
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

test("role and project assignment restores both even if the check fails", async () => {
  const perfiles = new Map<string, { proyecto_id: string | null; rol: string }>(
    [
      [
        "user",
        {
          proyecto_id: "11111111-1111-4111-8111-111111111111",
          rol: "stakeholder",
        },
      ],
    ]
  );
  await expect(
    withRestoredRolYProyecto({
      during: () => Promise.reject(new Error("portal check failed")),
      getUsuario: (id) => {
        const perfil = perfiles.get(id);
        if (!perfil) {
          throw new Error("missing profile");
        }
        return Promise.resolve(perfil);
      },
      next: {
        proyecto_id: "22222222-2222-4222-8222-222222222222",
        rol: "cliente",
      },
      setUsuario: (id, next) => {
        perfiles.set(id, next);
        return Promise.resolve();
      },
      userId: "user",
    })
  ).rejects.toThrow("portal check failed");
  expect(perfiles.get("user")).toEqual({
    proyecto_id: "11111111-1111-4111-8111-111111111111",
    rol: "stakeholder",
  });
});
