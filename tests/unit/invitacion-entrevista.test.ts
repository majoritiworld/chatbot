import { expect, test } from "@playwright/test";
import {
  destinoSesionEnLogin,
  ejecutarInvitacionEntrevista,
  emailRedirectToAuth,
  enlaceCallbackEntrevista,
  enlaceLoginEntrevista,
  enlacePortal,
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
    expect(emailRedirectToAuth(site, DESTINO_NUEVA, "cliente-2026")).toBe(
      `https://portal.majoriti.world/auth/callback?next=${encodeURIComponent(DESTINO_NUEVA)}&proyecto=cliente-2026`
    );
    expect(emailRedirectToAuth(site, null, "admin")).toBe(
      "https://portal.majoriti.world/auth/callback"
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
    expect(enlacePortal(site)).toBe("https://portal.majoriti.world");
    expect(enlacePortal(`${site}/`)).toBe("https://portal.majoriti.world");
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

  test("prepares a new account and does not send an invitation", async () => {
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
    });

    expect(resultado).toEqual({ creada: true, ok: true });
    expect(llamadas).toEqual(["asegurar"]);
  });

  test("prepares an existing account without changing role", async () => {
    const deps = {
      asegurarCuenta: () =>
        Promise.resolve({ creada: false, ok: true as const }),
      cargarAsignacion: (id: string) =>
        Promise.resolve({
          email: "existente@example.test",
          entrevistaId: id,
          nombre: "QA",
        }),
    };

    const primero = await ejecutarInvitacionEntrevista({
      ...deps,
      entrevistaId: NUEVA,
    });
    const reintento = await ejecutarInvitacionEntrevista({
      ...deps,
      entrevistaId: NUEVA,
    });

    expect(primero).toEqual({ creada: false, ok: true });
    expect(reintento).toEqual({ creada: false, ok: true });
  });

  test("missing interview does not create an account", async () => {
    let cuentas = 0;
    const resultado = await ejecutarInvitacionEntrevista({
      asegurarCuenta: () => {
        cuentas += 1;
        return Promise.resolve({ creada: true, ok: true });
      },
      cargarAsignacion: () => Promise.resolve(null),
      entrevistaId: NUEVA,
    });

    expect(resultado.ok).toBe(false);
    expect(cuentas).toBe(0);
  });
});
