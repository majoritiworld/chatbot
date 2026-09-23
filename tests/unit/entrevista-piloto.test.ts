import { expect, test } from "@playwright/test";
import {
  avisoBorradorCierreAnticipado,
  avisoCierreAnticipado,
  avisoEntregaAlFinalizar,
  avisoGuardadoRespuestas,
  consentimientoEntrevistaListo,
  contextoOnboardingEntrevista,
  debeBloquearCorreoEntrevista,
  debeConfirmarCierrePorBorrador,
  decisionReintentoCorreo,
  encadenarAvanceInicial,
  entrevistaAceptaChat,
  escribirBorradorEntrevista,
  estadoEntregaEntrevista,
  estadoVisibleEntrevistaPortal,
  etiquetaAccionCierreAnticipado,
  etiquetaCierreAnticipado,
  etiquetaCierreTema,
  etiquetaConfirmarCierreAnticipado,
  etiquetaEntregaPendiente,
  etiquetaProgresoTema,
  explicacionEntregaPendiente,
  leerBorradorEntrevista,
  mensajeSalidaInsegura,
  minutosAproxEntrevista,
  muestraPantallaRevision,
  pantallaParticipanteEntrevista,
  puntosAyudaEntrevista,
  puntosUsoRespuestasEntrevista,
  reiniciarBorradoresEntrevistaParaPruebas,
  salidaEntrevistaInsegura,
  siguienteTransicionInicial,
  textoDuracionEntrevista,
  textoFinalizandoEntrevista,
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
  test("does not treat last activity as having started the interview", () => {
    expect(
      estadoVisibleEntrevistaPortal({
        consentimientoEn: null,
        entrevistaEstado: "abierta",
        flujoEstado: "bienvenida",
        stakeholderEstado: "pendiente",
      })
    ).toBe("pendiente");
    expect(
      estadoVisibleEntrevistaPortal({
        consentimientoEn: "2026-09-21T12:00:00Z",
        entrevistaEstado: "abierta",
        flujoEstado: "bienvenida",
        stakeholderEstado: "pendiente",
      })
    ).toBe("en_curso");
    expect(
      estadoVisibleEntrevistaPortal({
        consentimientoEn: null,
        entrevistaEstado: "abierta",
        flujoEstado: "chat",
        stakeholderEstado: "pendiente",
      })
    ).toBe("en_curso");
  });

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
    expect(etiquetaCierreAnticipado()).toBe("Finalizar sección");
    expect(avisoCierreAnticipado(false)).toContain("preguntas pendientes");
    expect(avisoCierreAnticipado(true)).toContain("entrega la entrevista");
    expect(etiquetaConfirmarCierreAnticipado(true)).toBe(
      "Finalizar y entregar"
    );
    expect(etiquetaConfirmarCierreAnticipado(false)).toBe("Cerrar este tema");
    expect(
      etiquetaAccionCierreAnticipado({
        busy: true,
        esUltimo: true,
        mostrarError: false,
      })
    ).toBe("Finalizando entrevista…");
    expect(
      etiquetaAccionCierreAnticipado({
        busy: false,
        esUltimo: false,
        mostrarError: true,
      })
    ).toBe("Reintentar");
    expect(avisoBorradorCierreAnticipado()).toContain("no se envía");
    expect(avisoEntregaAlFinalizar()).toContain("se enviarán tus respuestas");
    expect(puntosAyudaEntrevista().at(3)).toContain(
      "el texto que aún no enviaste no queda guardado"
    );
    expect(puntosAyudaEntrevista().at(2)).toContain(
      "si es la última sección, también se entregará la entrevista"
    );
    expect(puntosAyudaEntrevista().join(" ")).not.toContain(
      "Enviar la entrevista es un paso aparte"
    );
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
    expect(textoFinalizandoEntrevista()).toBe("Finalizando entrevista…");
    expect(explicacionEntregaPendiente()).not.toContain("Listo para enviar");
    expect(
      etiquetaEntregaPendiente({ errorEntrega: false, pending: false })
    ).toBe("Finalizar entrevista");
    expect(
      etiquetaEntregaPendiente({ errorEntrega: true, pending: false })
    ).toBe("Reintentar finalización");
    expect(
      etiquetaEntregaPendiente({ errorEntrega: true, pending: true })
    ).toBe("Finalizando entrevista…");
    expect(
      pantallaParticipanteEntrevista({
        completada: false,
        errorEntrega: false,
        flujoEstado: "revision",
        llegoEnRevision: false,
        onboardingListo: true,
        seccionActual: 1,
      })
    ).toBe("finalizando");
    expect(
      pantallaParticipanteEntrevista({
        completada: false,
        errorEntrega: false,
        flujoEstado: "revision",
        llegoEnRevision: true,
        onboardingListo: true,
        seccionActual: 1,
      })
    ).toBe("entrega_pendiente");
    expect(
      pantallaParticipanteEntrevista({
        completada: false,
        errorEntrega: true,
        flujoEstado: "revision",
        llegoEnRevision: false,
        onboardingListo: true,
        seccionActual: 1,
      })
    ).toBe("entrega_pendiente");
    expect(
      pantallaParticipanteEntrevista({
        completada: true,
        errorEntrega: false,
        flujoEstado: "revision",
        llegoEnRevision: true,
        onboardingListo: true,
        seccionActual: 1,
      })
    ).toBe("completada");
    expect(textoTemasTerminados(1)).toBe("Terminaste el tema.");
    expect(textoTemasTerminados(3)).toBe("Terminaste los 3 temas.");
    expect(
      pantallaParticipanteEntrevista({
        completada: false,
        errorEntrega: false,
        flujoEstado: "bienvenida",
        llegoEnRevision: false,
        onboardingListo: false,
        seccionActual: 0,
      })
    ).toBe("onboarding");
    expect(minutosAproxEntrevista(1)).toBe(8);
    expect(minutosAproxEntrevista(6)).toBe(30);
    expect(textoDuracionEntrevista(6)).toBe(
      "Suele tomar alrededor de 30 minutos."
    );
  });

  test("onboarding names the project company, not a hardcoded client", () => {
    expect(contextoOnboardingEntrevista("Emprende Tu Mente (ETM)")).toContain(
      "junto con Emprende Tu Mente (ETM)"
    );
    expect(contextoOnboardingEntrevista("ComplianceLatam")).toContain(
      "junto con ComplianceLatam"
    );
    expect(contextoOnboardingEntrevista("  ")).toContain(
      "junto con tu compañía"
    );
    expect(puntosUsoRespuestasEntrevista("Emprende Tu Mente (ETM)")[0]).toBe(
      "Se guardan de forma exclusiva para Emprende Tu Mente (ETM)."
    );
    expect(puntosUsoRespuestasEntrevista(null)[0]).toBe(
      "Se guardan de forma exclusiva para tu compañía."
    );
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
