import { expect, test } from "@playwright/test";
import {
  avisoEntregaAlFinalizar,
  avisoGuardadoRespuestas,
  consentimientoEntrevistaListo,
  debeBloquearCorreoEntrevista,
  debeConfirmarCierrePorBorrador,
  decisionReintentoCorreo,
  encadenarAvanceInicial,
  entrevistaAceptaChat,
  escribirBorradorEntrevista,
  estadoEntregaEntrevista,
  etiquetaCierreTema,
  etiquetaProgresoTema,
  leerBorradorEntrevista,
  mensajeSalidaInsegura,
  muestraPantallaRevision,
  reiniciarBorradoresEntrevistaParaPruebas,
  salidaEntrevistaInsegura,
  siguienteTransicionInicial,
  textoTemasTerminados,
} from "@/lib/consultoria/entrevista-piloto";
import {
  claveKickoff,
  liberarKickoff,
  recordarKickoffHecho,
  reiniciarKickoffsParaPruebas,
  reservarKickoff,
  textoKickoffEntrevista,
} from "@/lib/consultoria/kickoff-entrevista";
import {
  homePathForRol,
  isClienteRole,
  isStakeholderRole,
} from "@/lib/consultoria/roles";

test.describe("Pilot interview helpers", () => {
  test("does not treat a transcript as consent", () => {
    expect(consentimientoEntrevistaListo(null)).toBe(false);
    expect(consentimientoEntrevistaListo(undefined)).toBe(false);
    expect(consentimientoEntrevistaListo("2026-09-19T00:00:00Z")).toBe(true);
    expect(entrevistaAceptaChat(null)).toBe(false);
    expect(entrevistaAceptaChat("2026-09-19T00:00:00Z")).toBe(true);
  });

  test("chains only the opening transitions and stops after a failure", async () => {
    expect(siguienteTransicionInicial("bienvenida", 0)).toBe("bienvenida");
    expect(siguienteTransicionInicial("presentacion", 0)).toBe("presentacion");
    expect(siguienteTransicionInicial("presentacion", 1)).toBeNull();
    expect(siguienteTransicionInicial("chat", 0)).toBeNull();

    const llamadas: string[] = [];
    const flujo = await encadenarAvanceInicial({
      avanzar: (desde) => {
        llamadas.push(desde);
        return Promise.resolve(
          desde === "bienvenida" ? "presentacion" : "chat"
        );
      },
      flujoEstado: "bienvenida",
      seccionActual: 0,
    });
    expect(llamadas).toEqual(["bienvenida", "presentacion"]);
    expect(flujo).toBe("chat");

    await expect(
      encadenarAvanceInicial({
        avanzar: (desde) => {
          if (desde === "presentacion") {
            return Promise.reject(new Error("fallo intermedio"));
          }
          return Promise.resolve("presentacion");
        },
        flujoEstado: "bienvenida",
        seccionActual: 0,
      })
    ).rejects.toThrow("fallo intermedio");

    const later = await encadenarAvanceInicial({
      avanzar: () => Promise.resolve("chat"),
      flujoEstado: "presentacion",
      seccionActual: 1,
    });
    expect(later).toBe("presentacion");
  });

  test("does not duplicate a reserved kickoff", () => {
    reiniciarKickoffsParaPruebas();
    const clave = claveKickoff("e1", "s1");
    expect(reservarKickoff(clave)).toBe(true);
    expect(reservarKickoff(clave)).toBe(false);
    liberarKickoff(clave);
    expect(reservarKickoff(clave)).toBe(true);
    recordarKickoffHecho(clave);
    expect(reservarKickoff(clave)).toBe(false);
    expect(textoKickoffEntrevista(false)).toContain(
      "haz de inmediato la primera pregunta"
    );
    expect(textoKickoffEntrevista(true)).toContain("No te presentes de nuevo");
  });

  test("shows real section progress and close labels", () => {
    expect(etiquetaProgresoTema(0, 4)).toBe("Tema 1 de 4");
    expect(etiquetaProgresoTema(3, 4)).toBe("Tema 4 de 4");
    expect(etiquetaCierreTema(false)).toBe("Cerrar y continuar");
    expect(etiquetaCierreTema(true)).toBe("Finalizar entrevista");
    expect(avisoEntregaAlFinalizar()).toContain("se enviarán tus respuestas");
    expect(
      muestraPantallaRevision({
        errorEntrega: false,
        flujoEstado: "revision",
        llegoEnRevision: false,
      })
    ).toBe(false);
    expect(
      muestraPantallaRevision({
        errorEntrega: false,
        flujoEstado: "revision",
        llegoEnRevision: true,
      })
    ).toBe(true);
    expect(
      muestraPantallaRevision({
        errorEntrega: true,
        flujoEstado: "revision",
        llegoEnRevision: false,
      })
    ).toBe(true);
    expect(textoTemasTerminados(1)).toBe("Terminaste el tema.");
    expect(textoTemasTerminados(3)).toBe("Terminaste los 3 temas.");
  });

  test("does not promise a safe exit while a draft or save is pending", () => {
    expect(
      salidaEntrevistaInsegura({
        guardadoEnCurso: false,
        hayBorrador: false,
        ocupadoChat: false,
      })
    ).toBe(false);
    expect(
      salidaEntrevistaInsegura({
        guardadoEnCurso: false,
        hayBorrador: true,
        ocupadoChat: false,
      })
    ).toBe(true);
    expect(avisoGuardadoRespuestas(false)).toBe(
      "Respuestas guardadas. Puedes salir y continuar después."
    );
    expect(avisoGuardadoRespuestas(true)).toContain(
      "El texto que aún no enviaste no se guardó"
    );
    expect(
      mensajeSalidaInsegura({
        guardadoEnCurso: true,
        hayBorrador: false,
        ocupadoChat: false,
      })
    ).toContain("envío o guardado en curso");
  });

  test("distinguishes submit, failed submit and failed thank-you mail", () => {
    expect(
      estadoEntregaEntrevista({
        completada: false,
        correoPendiente: false,
        enviando: true,
        errorEntrega: false,
      })
    ).toBe("enviando");
    expect(
      estadoEntregaEntrevista({
        completada: false,
        correoPendiente: false,
        enviando: false,
        errorEntrega: true,
      })
    ).toBe("entrega_fallida");
    expect(
      estadoEntregaEntrevista({
        completada: true,
        correoPendiente: true,
        enviando: false,
        errorEntrega: false,
      })
    ).toBe("enviada_correo_pendiente");
    expect(
      estadoEntregaEntrevista({
        completada: true,
        correoPendiente: false,
        enviando: false,
        errorEntrega: false,
      })
    ).toBe("enviada");
  });

  test("retries thank-you mail only after a completed interview", () => {
    expect(
      decisionReintentoCorreo({
        correoAgradecimientoEn: null,
        email: "a@x.test",
        estado: "abierta",
      })
    ).toBe("no_enviada");
    expect(
      decisionReintentoCorreo({
        correoAgradecimientoEn: "2026-09-19T00:00:00Z",
        email: "a@x.test",
        estado: "completada",
      })
    ).toBe("ya_enviado");
    expect(
      decisionReintentoCorreo({
        correoAgradecimientoEn: null,
        email: null,
        estado: "completada",
      })
    ).toBe("sin_email");
    expect(
      decisionReintentoCorreo({
        correoAgradecimientoEn: null,
        email: "a@x.test",
        estado: "completada",
      })
    ).toBe("reintentar");
  });

  test("blocks thank-you mail only on a local server with the flag, not on Vercel", () => {
    expect(debeBloquearCorreoEntrevista({ flag: "1", vercel: undefined })).toBe(
      true
    );
    expect(debeBloquearCorreoEntrevista({ flag: "1", vercel: "1" })).toBe(
      false
    );
    expect(
      debeBloquearCorreoEntrevista({ flag: undefined, vercel: undefined })
    ).toBe(false);
  });

  test("keeps portal onboarding for clients and interview landing for stakeholders", () => {
    expect(isClienteRole("cliente")).toBe(true);
    expect(isStakeholderRole("stakeholder")).toBe(true);
    expect(homePathForRol("cliente", "entrevista-1")).toBe("/portal");
    expect(homePathForRol("stakeholder", "entrevista-1")).toBe(
      "/portal/entrevista/entrevista-1"
    );
  });

  test("scopes interview drafts to the current topic", () => {
    reiniciarBorradoresEntrevistaParaPruebas();
    escribirBorradorEntrevista("entrevista-1", "tema-a", "texto del tema A");
    expect(leerBorradorEntrevista("entrevista-1", "tema-a")).toBe(
      "texto del tema A"
    );
    expect(leerBorradorEntrevista("entrevista-1", "tema-b")).toBe("");
    expect(debeConfirmarCierrePorBorrador("  hola  ")).toBe(true);
    expect(debeConfirmarCierrePorBorrador("   ")).toBe(false);
    escribirBorradorEntrevista("entrevista-1", "tema-a", "  ");
    expect(leerBorradorEntrevista("entrevista-1", "tema-a")).toBe("");
  });
});
