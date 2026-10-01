import { expect, test } from "@playwright/test";
import { pendientesDeLote } from "@/lib/consultoria/invitacion-colaboradores";
import {
  decisionReintento,
  detalleEnvioAceptado,
  ErrorEnvioCorreo,
  ejecutarEnvioConReintentos,
  esperaReintentoMs,
  INTENTOS_INVITACION,
  leerRetryAfterMs,
  RITMO_INVITACION_MS,
  ritmoInvitacionDesdeEntorno,
} from "@/lib/consultoria/ritmo-invitacion";

const dormir = (ms: number) => {
  esperas.push(ms);
  return Promise.resolve();
};
let esperas: number[] = [];

test.beforeEach(() => {
  esperas = [];
});

test("uses one second when the account quota is unknown", () => {
  expect(ritmoInvitacionDesdeEntorno({})).toEqual({
    intentosMaximos: INTENTOS_INVITACION,
    intervaloMs: RITMO_INVITACION_MS,
  });
  expect(RITMO_INVITACION_MS).toBe(1000);
  expect(
    ritmoInvitacionDesdeEntorno({
      INVITACION_INTENTOS_MAX: "3",
      INVITACION_RITMO_MS: "1500",
    })
  ).toEqual({ intentosMaximos: 3, intervaloMs: 1500 });
});

test("honors Retry-After and otherwise waits longer each time", () => {
  expect(leerRetryAfterMs({ "retry-after": "12" })).toBe(12_000);
  expect(
    esperaReintentoMs({
      intento: 1,
      intervaloBaseMs: 1000,
      retryAfterMs: 12_000,
    })
  ).toBe(12_000);
  expect(
    esperaReintentoMs({
      intento: 1,
      intervaloBaseMs: 1000,
      retryAfterMs: null,
    })
  ).toBe(1000);
  expect(
    esperaReintentoMs({
      intento: 3,
      intervaloBaseMs: 1000,
      retryAfterMs: null,
    })
  ).toBe(4000);
  expect(
    esperaReintentoMs({
      intento: 10,
      intervaloBaseMs: 1000,
      retryAfterMs: null,
    })
  ).toBe(60_000);
});

test("retries a limit with the same send and stops on a conflicting key", async () => {
  let envios = 0;
  const cuerpo = { html: "<p>mismo</p>", subject: "mismo" };
  const clave = "entrevista-1-invitacion";
  await ejecutarEnvioConReintentos({
    dormir,
    enviar: () => {
      envios += 1;
      expect(cuerpo.subject).toBe("mismo");
      expect(clave).toBe("entrevista-1-invitacion");
      if (envios < 3) {
        return Promise.reject(
          new ErrorEnvioCorreo({
            codigo: "rate_limit_exceeded",
            message: "Too many requests",
            retryAfterMs: 2000,
            statusCode: 429,
          })
        );
      }
      return Promise.resolve();
    },
    intentosMaximos: 5,
    intervaloBaseMs: 1000,
  });
  expect(envios).toBe(3);
  expect(esperas).toEqual([2000, 2000]);

  envios = 0;
  await expect(
    ejecutarEnvioConReintentos({
      dormir,
      enviar: () => {
        envios += 1;
        return Promise.reject(
          new ErrorEnvioCorreo({
            codigo: "invalid_idempotent_request",
            message: "La clave ya se usó con otro contenido",
            retryAfterMs: null,
            statusCode: 409,
          })
        );
      },
      intentosMaximos: 5,
      intervaloBaseMs: 1000,
    })
  ).rejects.toThrow("otro contenido");
  expect(envios).toBe(1);
});

test("stops after the maximum number of uncertain responses", async () => {
  let envios = 0;
  await expect(
    ejecutarEnvioConReintentos({
      dormir,
      enviar: () => {
        envios += 1;
        return Promise.reject(
          new ErrorEnvioCorreo({
            codigo: "network",
            message: "socket",
            retryAfterMs: null,
            statusCode: null,
          })
        );
      },
      intentosMaximos: 3,
      intervaloBaseMs: 1000,
    })
  ).rejects.toThrow("socket");
  expect(envios).toBe(3);
  expect(esperas).toEqual([1000, 2000]);
  expect(decisionReintento(new Error("validación local"))).toEqual({
    tipo: "no",
  });
});

test("a simulated provider accepts one id and a resumed batch skips it", async () => {
  const aceptados = new Map<string, { id: string; subject: string }>();
  let entregas = 0;
  const enviarLogico = (entrevistaId: string, subject: string) => {
    const clave = `entrevista-${entrevistaId}-invitacion`;
    return ejecutarEnvioConReintentos({
      dormir,
      enviar: () => {
        const previo = aceptados.get(clave);
        if (previo && previo.subject !== subject) {
          return Promise.reject(
            new ErrorEnvioCorreo({
              codigo: "invalid_idempotent_request",
              message: "La clave ya se usó con otro contenido",
              retryAfterMs: null,
              statusCode: 409,
            })
          );
        }
        if (previo) {
          return Promise.resolve(previo);
        }
        entregas += 1;
        const aceptado = { id: `correo-${entregas}`, subject };
        aceptados.set(clave, aceptado);
        return Promise.resolve(aceptado);
      },
      intentosMaximos: 3,
      intervaloBaseMs: 1000,
    });
  };

  const primero = await enviarLogico("nueva", "cuerpo fijo");
  const repetido = await enviarLogico("nueva", "cuerpo fijo");
  expect(repetido.id).toBe(primero.id);
  expect(detalleEnvioAceptado(primero.id)).toBe("resend:correo-1");
  expect(entregas).toBe(1);
  await expect(enviarLogico("nueva", "cuerpo cambiado")).rejects.toThrow(
    "otro contenido"
  );
  expect(entregas).toBe(1);

  const lote = pendientesDeLote(["nueva", "real", "prueba", "vacia"], {
    completadas: [],
    enviados: ["nueva"],
    pruebas: ["prueba"],
    sinCorreo: ["vacia"],
  });
  expect(lote.pendientes).toEqual(["real"]);
  expect(lote.omitidos).toBe(3);
});
