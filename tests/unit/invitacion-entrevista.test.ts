import { expect, test } from "@playwright/test";
import {
  destinoSesionEnLogin,
  ejecutarInvitacionEntrevista,
  emailRedirectToAuth,
  enlaceCallbackEntrevista,
  enlaceLoginEntrevista,
  pathEntrevista,
  rutaEntrevistaPermitida,
} from "@/lib/consultoria/destino-entrevista";
import { resolveAuthLanding } from "@/lib/consultoria/roles";

const NUEVA = "11111111-1111-4111-8111-111111111111";
const ANTIGUA = "228285c0-5153-469f-b0f1-b13c82b355c0";
const AJENA = "99999999-9999-4999-8999-999999999999";
const HOME_ANTIGUA = pathEntrevista(ANTIGUA);
const DESTINO_NUEVA = pathEntrevista(NUEVA);

test.describe("Interview invitation destination", () => {
  test("accepts only an internal interview path", () => {
    expect(rutaEntrevistaPermitida(DESTINO_NUEVA)).toBe(DESTINO_NUEVA);
    expect(rutaEntrevistaPermitida(`${DESTINO_NUEVA}?x=1`)).toBe(DESTINO_NUEVA);
    expect(rutaEntrevistaPermitida("/portal/entrevista/1")).toBeNull();
    expect(rutaEntrevistaPermitida("/portal")).toBeNull();
    expect(rutaEntrevistaPermitida("/chat/abc")).toBeNull();
  });

  test("rejects external and protocol-relative destinations", () => {
    expect(
      rutaEntrevistaPermitida(`https://evil.example${DESTINO_NUEVA}`)
    ).toBeNull();
    expect(
      rutaEntrevistaPermitida(`//evil.example${DESTINO_NUEVA}`)
    ).toBeNull();
    expect(
      rutaEntrevistaPermitida(`/%2f%2fevil.example${DESTINO_NUEVA}`)
    ).toBeNull();
    expect(
      rutaEntrevistaPermitida(`https://portal.majoriti.world${DESTINO_NUEVA}`)
    ).toBeNull();
  });

  test("code request, resend and callback keep the invited interview", () => {
    const site = "https://portal.majoriti.world";
    expect(emailRedirectToAuth(site, DESTINO_NUEVA)).toBe(
      `https://portal.majoriti.world/auth/callback?next=${encodeURIComponent(DESTINO_NUEVA)}`
    );
    expect(emailRedirectToAuth(site, DESTINO_NUEVA)).toBe(
      emailRedirectToAuth(site, `${DESTINO_NUEVA}?injected=1`)
    );
    expect(
      enlaceCallbackEntrevista({
        entrevistaId: NUEVA,
        hashedToken: "token-hash",
        site,
        type: "magiclink",
      })
    ).toBe(
      `https://portal.majoriti.world/auth/callback?token_hash=token-hash&type=magiclink&next=${encodeURIComponent(DESTINO_NUEVA)}`
    );
    expect(enlaceLoginEntrevista(site, NUEVA)).toBe(
      `https://portal.majoriti.world/login?next=${encodeURIComponent(DESTINO_NUEVA)}`
    );
  });

  test("an already signed-in session keeps the invited interview", () => {
    expect(destinoSesionEnLogin(DESTINO_NUEVA, HOME_ANTIGUA)).toBe(
      DESTINO_NUEVA
    );
    expect(destinoSesionEnLogin(null, HOME_ANTIGUA)).toBe(HOME_ANTIGUA);
    expect(destinoSesionEnLogin("/portal", HOME_ANTIGUA)).toBe(HOME_ANTIGUA);
  });

  test("several interviews: the invited id is not replaced by home", () => {
    expect(resolveAuthLanding("stakeholder", DESTINO_NUEVA, HOME_ANTIGUA)).toBe(
      DESTINO_NUEVA
    );
    expect(
      resolveAuthLanding("stakeholder", pathEntrevista(AJENA), HOME_ANTIGUA)
    ).toBe(pathEntrevista(AJENA));
  });

  test("login without next keeps the current landing", () => {
    expect(resolveAuthLanding("stakeholder", null, HOME_ANTIGUA)).toBe(
      HOME_ANTIGUA
    );
    expect(resolveAuthLanding("cliente", null, "/portal")).toBe("/portal");
    expect(resolveAuthLanding("stakeholder", "/portal", HOME_ANTIGUA)).toBe(
      HOME_ANTIGUA
    );
  });

  test("sends to a new account without creating another interview", async () => {
    const llamadas: string[] = [];
    const resultado = await ejecutarInvitacionEntrevista({
      asegurarCuenta: () => {
        llamadas.push("asegurar");
        return Promise.resolve({ creada: true, ok: true });
      },
      cargarAsignacion: (id) =>
        Promise.resolve({
          email: "nuevo@example.test",
          entrevistaId: id,
          nombre: "Nuevo",
        }),
      entrevistaId: NUEVA,
      enviarCorreo: ({ enlace, entrevistaId }) => {
        llamadas.push("enviar");
        expect(entrevistaId).toBe(NUEVA);
        expect(enlace).toContain(NUEVA);
        return Promise.resolve();
      },
      generarEnlace: ({ entrevistaId }) =>
        Promise.resolve(
          enlaceCallbackEntrevista({
            entrevistaId,
            hashedToken: "nuevo-token",
            site: "https://portal.majoriti.world",
            type: "magiclink",
          })
        ),
    });

    expect(resultado).toEqual({ creada: true, enviado: true, ok: true });
    expect(llamadas).toEqual(["asegurar", "enviar"]);
  });

  test("sends to an existing account without changing role or duplicating", async () => {
    let envios = 0;
    const deps = {
      asegurarCuenta: () =>
        Promise.resolve({ creada: false, ok: true as const }),
      cargarAsignacion: (id: string) =>
        Promise.resolve({
          email: "existente@example.test",
          entrevistaId: id,
          nombre: "QA",
        }),
      enviarCorreo: () => {
        envios += 1;
        return Promise.resolve();
      },
      generarEnlace: () =>
        Promise.resolve(
          enlaceLoginEntrevista("https://portal.majoriti.world", NUEVA)
        ),
    };

    const primero = await ejecutarInvitacionEntrevista({
      ...deps,
      entrevistaId: NUEVA,
    });
    const reintento = await ejecutarInvitacionEntrevista({
      ...deps,
      entrevistaId: NUEVA,
    });

    expect(primero).toEqual({ creada: false, enviado: true, ok: true });
    expect(reintento).toEqual({ creada: false, enviado: true, ok: true });
    expect(envios).toBe(2);
  });

  test("missing interview is rejected and does not send mail", async () => {
    let envios = 0;
    const resultado = await ejecutarInvitacionEntrevista({
      asegurarCuenta: () => {
        throw new Error("no debe crear cuenta");
      },
      cargarAsignacion: () => Promise.resolve(null),
      entrevistaId: NUEVA,
      enviarCorreo: () => {
        envios += 1;
        return Promise.resolve();
      },
      generarEnlace: () => {
        throw new Error("no debe armar enlace");
      },
    });

    expect(resultado.ok).toBe(false);
    expect(envios).toBe(0);
  });
});
