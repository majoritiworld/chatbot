import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { interviewSystemPrompt } from "@/lib/ai/prompts";
import { planificarColaboradores } from "@/lib/consultoria/cargas/compliance-latam-colaboradores";
import {
  crearEnlaceAcceso,
  validarEnlaceAcceso,
} from "@/lib/consultoria/correos/enlace-acceso";
import {
  correoConfirmacion,
  correoInvitacion,
} from "@/lib/consultoria/correos/variantes";
import {
  construirArchivoTranscripcion,
  fusionarTurnos,
  haySeccionesPendientes,
  resolverAvanceSeccion,
  type TurnoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import {
  NOMBRE_FASE_COLABORADORES,
  seccionesDeGuionClColaboradores,
} from "@/lib/consultoria/guiones/compliance-latam-colaboradores";
import {
  asuntoConPrefijoPrueba,
  debeRetenerCorreoColaboradores,
  EMAIL_PRUEBA_COLABORADORES,
  ENTREVISTA_PRUEBA_COLABORADORES,
  envioInvitacionesColaboradoresPermitido,
  esParticipantePruebaColaboradores,
  excluirDeCampanaColaboradores,
} from "@/lib/consultoria/invitacion-colaboradores";
import { resolverTurnoConObligatorias } from "@/lib/consultoria/obligatorias-turno";
import {
  filtroDesdeParametros,
  paginarSeguimiento,
} from "@/lib/consultoria/seguimiento-pagina";
import {
  decidirCookieFrenteASesionHabitual,
  decidirEntradaEnlace,
  decidirEntradaSoloCorreo,
  empaquetarSesionEntrevista,
  hashTokenEnlace,
  leerSesionEntrevistaValor,
  MENSAJE_SOLO_CORREO_SIN_ACCESO,
  puedeAbrirAsignacionConSesionHabitual,
  rutaCubiertaPorSesionEntrevista,
  sesionPortalPermiteEntrar,
} from "@/lib/consultoria/sesion-entrevista";
import type { ChatMessage } from "@/lib/types";

const ENTREVISTA = "30000000-0000-4000-8000-000000000001";
const OTRA = "30000000-0000-4000-8000-000000000002";

function mensaje(
  role: "assistant" | "user",
  text: string,
  metadata?: ChatMessage["metadata"]
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    parts: [{ text, type: "text" }],
    role,
    ...(metadata ? { metadata } : {}),
  };
}

test("las obligatorias no consumen el cupo de seguimientos", () => {
  const obligatorias = ["¿Cómo se entera?", "¿Cómo accede?"];
  const principal = mensaje("user", "Participo poco.");
  const primera = resolverTurnoConObligatorias({
    cubiertas: [],
    messages: [mensaje("assistant", "¿Su vínculo?"), principal],
    obligatorias,
    seguimientoOpcional: "¿Con qué frecuencia?",
    tieneSeguimientos: true,
  });
  expect(primera.clase).toBe("obligatoria");
  expect(primera.indiceObligatoria).toBe(0);
  expect(primera.seguimientosHechos).toBe(0);

  const cubiertas = resolverTurnoConObligatorias({
    cubiertas: [0, 1],
    messages: [mensaje("assistant", "¿Su vínculo?"), principal],
    obligatorias,
    seguimientoOpcional: "¿Con qué frecuencia?",
    tieneSeguimientos: true,
  });
  expect(cubiertas.clase).toBe("seguimiento");
  expect(cubiertas.seguimientosHechos).toBe(0);

  const meta = { createdAt: "2026-09-30T00:00:00.000Z" };
  const alTope = resolverTurnoConObligatorias({
    cubiertas: [],
    messages: [
      mensaje("assistant", "principal", { ...meta, clase: "principal" }),
      mensaje("user", "Poco."),
      mensaje("assistant", "uno", {
        ...meta,
        clase: "obligatoria",
        indiceObligatoria: 0,
      }),
      mensaje("user", "Por correo."),
      mensaje("assistant", "dos", {
        ...meta,
        clase: "obligatoria",
        indiceObligatoria: 1,
      }),
      mensaje("user", "En la web."),
      mensaje("assistant", "opcional", { ...meta, clase: "seguimiento" }),
      mensaje("user", "Mensual."),
      mensaje("assistant", "opcional 2", { ...meta, clase: "seguimiento" }),
      mensaje("user", "Corta."),
    ],
    obligatorias,
    seguimientoOpcional: "¿Otro?",
    tieneSeguimientos: true,
  });
  expect(alTope.clase).toBe("cierre");
  expect(alTope.seguimientosHechos).toBe(2);
});

test("el guion de colaboradores habla de empresa y guarda las reglas fuera de la descripción", () => {
  const secciones = seccionesDeGuionClColaboradores();
  const acceso = secciones.at(2);
  expect(acceso?.obligatorias).toHaveLength(2);
  expect(
    secciones.every((seccion) => seccion.etiquetaOrganizacion === "empresa")
  ).toBe(true);
  const publicas = secciones.map((seccion) => seccion.descripcion).join(" ");
  expect(publicas).not.toContain("No inventes");
  expect(publicas).not.toContain("cupo");
  expect(secciones.at(0)?.instrucciones).toContain("no conoce");
});

test("la fase de firmas socias sigue diciendo firma socia", () => {
  const prompt = interviewSystemPrompt({
    firmaEntrevistado: "Estudio Alba",
    nombreEntrevistado: "Ana",
    preguntas: ["Qué le ofrecen hoy a una firma socia."],
    tituloSeccion: "Valor",
  });
  expect(prompt).toContain("firma socia");
  expect(prompt).not.toContain("Preguntas obligatorias");
});

test("esta fase nombra la empresa y pide las obligatorias aunque el cupo esté lleno", () => {
  const prompt = interviewSystemPrompt({
    etiquetaOrganizacion: "empresa",
    firmaEntrevistado: "Epiroc",
    nombreEntrevistado: "Francisco",
    obligatorias: ["¿Cómo se entera?", "¿Cómo accede?"],
    preguntas: ["¿Cómo describiría su vínculo?"],
    seguimientoEsObligatorio: true,
    seguimientoSiguiente: "¿Cómo se entera?",
    seguimientos: ["Si no concreta: ¿con qué frecuencia?"],
    seguimientosHechos: 2,
    tituloSeccion: "Acceso",
    trato: "usted",
  });
  expect(prompt).toContain("la empresa Epiroc");
  expect(prompt).toContain("Preguntas obligatorias");
  expect(prompt).not.toContain("firma socia");
});

test("la planilla consolida al duplicado, deja sin correo en pendiente y separa dos personas de una empresa", () => {
  const plan = planificarColaboradores([
    fila(
      "Chile",
      40,
      "fgodoy1@gmail.com",
      "Regional Compliance Officer",
      "03.06.2024"
    ),
    fila(
      "Chile",
      67,
      "fgodoy1@gmail.com",
      "Compliance Officer Latam",
      "19.03.2025"
    ),
    fila("Chile", 50, "", "Abogada", ""),
    fila("Otros países ", 21, "  ", "Legal", ""),
    fila("Chile", 151, "", "Gerente", ""),
    fila(
      "Chile",
      2,
      "ana@empresa.test",
      "Legal",
      "01.01.2025",
      "Ana",
      "Norte SA"
    ),
    fila(
      "Chile",
      3,
      "luis@empresa.test",
      "Compliance",
      "01.02.2025",
      "Luis",
      "Norte SA"
    ),
  ]);
  expect(plan.validos).toHaveLength(3);
  const godoy = plan.validos.find(
    (persona) => persona.correo === "fgodoy1@gmail.com"
  );
  expect(godoy?.cargo).toBe("Compliance Officer Latam");
  expect(godoy?.cargoDescartado).toBe("Regional Compliance Officer");
  expect(godoy?.origenes).toHaveLength(2);
  expect(plan.pendientes.map((item) => item.motivo)).toEqual([
    "sin_correo",
    "sin_correo",
    "sin_correo",
  ]);
  const empresa = plan.validos.filter(
    (persona) => persona.empresa === "Epiroc"
  );
  expect(empresa).toHaveLength(1);
  const norte = plan.validos.filter(
    (persona) => persona.empresa === "Norte SA"
  );
  expect(norte).toHaveLength(2);
});

test("el panel cuenta todo el conjunto y no marca enviada una entrevista solo creada", () => {
  const filas = Array.from({ length: 30 }, (_, indice) => ({
    actividad: null,
    cargo: "Legal",
    correo: `persona${indice}@empresa.test`,
    empresa: indice < 10 ? "Norte SA" : "Sur SA",
    entrevistaId: `30000000-0000-4000-8000-${String(indice).padStart(12, "0")}`,
    estado: "pendiente" as const,
    nombre: `Persona ${indice}`,
    pais: indice < 10 ? "Chile" : "Perú",
  }));
  const pagina = paginarSeguimiento(
    filas,
    new Map(),
    filtroDesdeParametros({ pais: "Chile", tamano: "25" })
  );
  expect(pagina.totalFiltrado).toBe(10);
  expect(pagina.filas).toHaveLength(10);
  expect(pagina.paises).toEqual(["Chile", "Perú"]);
  expect(pagina.filas.every((item) => item.invitacion === "sin_invitar")).toBe(
    true
  );
  expect(pagina.filas.every((item) => item.estado === "pendiente")).toBe(true);
});

test("el enlace personal abre sin correo y solo mientras está vigente", () => {
  const vigente = { encontrado: true, faseHabilitada: true, revocado: false };
  expect(decidirEntradaEnlace(vigente).ok).toBe(true);
  expect(decidirEntradaEnlace({ ...vigente, revocado: true }).ok).toBe(false);
  expect(decidirEntradaEnlace({ ...vigente, faseHabilitada: false }).ok).toBe(
    false
  );
  expect(decidirEntradaEnlace({ ...vigente, encontrado: false }).ok).toBe(
    false
  );
  const revocado = decidirEntradaEnlace({ ...vigente, revocado: true });
  expect(revocado.ok ? "" : revocado.mensaje).not.toContain("ComplianceLatam");
});

test("la cookie abre una sola entrevista, sin rol, y se invalida si cambia", () => {
  process.env.AUTH_SECRET = "secreto-de-prueba-colaboradores";
  const enlace = hashTokenEnlace("token-de-prueba-colaboradores");
  const valor = empaquetarSesionEntrevista({
    email: " Ana@Empresa.TEST ",
    enlace,
    entrevistaId: ENTREVISTA,
    via: "enlace",
  });
  const sesion = leerSesionEntrevistaValor(valor);
  expect(sesion).toEqual({
    email: "ana@empresa.test",
    enlace,
    entrevistaId: ENTREVISTA,
    via: "enlace",
  });
  expect(Object.keys(sesion ?? {})).not.toContain("rol");

  const [firma, payload] = valor.split(".");
  const ajeno = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(payload ?? "", "base64url").toString("utf8")),
      entrevistaId: OTRA,
    })
  ).toString("base64url");
  expect(leerSesionEntrevistaValor(`${firma}.${ajeno}`)).toBeNull();

  expect(
    rutaCubiertaPorSesionEntrevista(
      `/portal/entrevista/${ENTREVISTA}`,
      ENTREVISTA
    )
  ).toBe(true);
  expect(
    rutaCubiertaPorSesionEntrevista("/api/entrevista/guardar", ENTREVISTA)
  ).toBe(true);
  expect(
    rutaCubiertaPorSesionEntrevista(`/portal/entrevista/${OTRA}`, ENTREVISTA)
  ).toBe(false);
  expect(rutaCubiertaPorSesionEntrevista("/portal", ENTREVISTA)).toBe(false);
  expect(rutaCubiertaPorSesionEntrevista("/admin", ENTREVISTA)).toBe(false);
});

test("la entrada con solo correo abre una asignación y trata las ambiguas", () => {
  const FASE = "30000000-0000-4000-8000-0000000000f5";
  expect(
    decidirEntradaSoloCorreo([{ entrevista_id: ENTREVISTA, fase_id: FASE }])
  ).toEqual({ entrevistaId: ENTREVISTA, faseId: FASE, ok: true });
  const ninguna = decidirEntradaSoloCorreo([]);
  expect(ninguna.ok ? "" : ninguna.mensaje).toBe(
    MENSAJE_SOLO_CORREO_SIN_ACCESO
  );
  expect(
    decidirEntradaSoloCorreo([
      { entrevista_id: ENTREVISTA, fase_id: FASE },
      { entrevista_id: OTRA, fase_id: FASE },
    ]).ok
  ).toBe(false);
  expect(sesionPortalPermiteEntrar(null, "ana@empresa.test")).toBe(true);
  expect(
    sesionPortalPermiteEntrar("ANA@empresa.test ", "ana@empresa.test")
  ).toBe(true);
  expect(
    sesionPortalPermiteEntrar("otra@empresa.test", "ana@empresa.test")
  ).toBe(false);
});

test("la cookie no pisa una sesión de otra persona ni el veto de comité", () => {
  const misma = {
    emailCookie: "ana@empresa.test",
    emailHabitual: "ANA@empresa.test",
    haySesionHabitual: true,
    rolHabitual: "majoriti",
  };
  expect(decidirCookieFrenteASesionHabitual(misma)).toBe("permitida");
  expect(
    decidirCookieFrenteASesionHabitual({
      ...misma,
      emailHabitual: null,
      haySesionHabitual: false,
      rolHabitual: null,
    })
  ).toBe("permitida");
  expect(
    decidirCookieFrenteASesionHabitual({
      ...misma,
      emailHabitual: "otra@empresa.test",
      rolHabitual: "stakeholder",
    })
  ).toBe("ajena");
  expect(
    decidirCookieFrenteASesionHabitual({
      ...misma,
      emailHabitual: "otra@empresa.test",
      rolHabitual: "comite",
    })
  ).toBe("ajena");
  expect(
    decidirCookieFrenteASesionHabitual({
      ...misma,
      rolHabitual: "comite",
    })
  ).toBe("comite");

  const propia = {
    accesoSoloCorreo: true,
    emailAsignacion: "ana@empresa.test",
    emailHabitual: "ana@empresa.test",
    rolHabitual: "majoriti",
  };
  expect(puedeAbrirAsignacionConSesionHabitual(propia)).toBe(true);
  expect(
    puedeAbrirAsignacionConSesionHabitual({
      ...propia,
      accesoSoloCorreo: false,
    })
  ).toBe(false);
  expect(
    puedeAbrirAsignacionConSesionHabitual({
      ...propia,
      rolHabitual: "comite",
    })
  ).toBe(false);
  expect(
    puedeAbrirAsignacionConSesionHabitual({
      ...propia,
      emailHabitual: "otra@empresa.test",
    })
  ).toBe(false);
  expect(
    puedeAbrirAsignacionConSesionHabitual({
      ...propia,
      emailHabitual: "otra@empresa.test",
      rolHabitual: "comite",
    })
  ).toBe(false);
});

test("abrir el enlace no consume el token ni envía correos", () => {
  const fuente = readFileSync("app/e/[token]/route.ts", "utf8");
  const acceso = readFileSync("lib/consultoria/acceso-entrevista.ts", "utf8");
  expect(fuente).not.toContain("revocar");
  expect(acceso).not.toContain("resend");
  expect(acceso).not.toContain("enviarCorreo");
  expect(acceso).not.toContain("ensureAuthUser");
});

test("los correos de esta fase siguen retenidos", () => {
  expect(envioInvitacionesColaboradoresPermitido()).toBe(false);
  expect(debeRetenerCorreoColaboradores(NOMBRE_FASE_COLABORADORES)).toBe(true);
  expect(debeRetenerCorreoColaboradores("Firmas socias")).toBe(false);
  expect(
    debeRetenerCorreoColaboradores(NOMBRE_FASE_COLABORADORES, {
      email: EMAIL_PRUEBA_COLABORADORES,
      entrevistaId: ENTREVISTA_PRUEBA_COLABORADORES,
    })
  ).toBe(false);
  expect(
    debeRetenerCorreoColaboradores(NOMBRE_FASE_COLABORADORES, {
      email: "otra@empresa.test",
      entrevistaId: ENTREVISTA_PRUEBA_COLABORADORES,
    })
  ).toBe(true);
  expect(
    debeRetenerCorreoColaboradores("Entrevistas a Firmas Socias", {
      email: EMAIL_PRUEBA_COLABORADORES,
      entrevistaId: ENTREVISTA_PRUEBA_COLABORADORES,
    })
  ).toBe(false);
});

test("las pruebas no entran en el conteo ni en la campaña de colaboradores", () => {
  expect(
    esParticipantePruebaColaboradores({
      correo: "persona@empresa.test",
      empresa: "Epiroc",
    })
  ).toBe(false);
  expect(
    esParticipantePruebaColaboradores({
      correo: EMAIL_PRUEBA_COLABORADORES,
      empresa: "PRUEBA · no es firma socia",
    })
  ).toBe(true);
  expect(
    esParticipantePruebaColaboradores({
      correo: "prueba-colaborador-20260930@majoriti.world",
      empresa: "PRUEBA — no es un participante",
    })
  ).toBe(true);
  expect(
    excluirDeCampanaColaboradores("Entrevistas a Firmas Socias", {
      correo: EMAIL_PRUEBA_COLABORADORES,
      empresa: "PRUEBA · no es firma socia",
    })
  ).toBe(false);
  expect(
    excluirDeCampanaColaboradores(NOMBRE_FASE_COLABORADORES, {
      correo: "persona@empresa.test",
      empresa: "Epiroc",
    })
  ).toBe(false);
});

test("la invitación final entra directo y el agradecimiento habla de usted", () => {
  const token = "vista-previa-sin-acceso";
  const enlace = crearEnlaceAcceso({
    entrevistaId: "1190524f-79e3-49e8-b090-7000711d21ad",
    permitirLocal: false,
    site: "https://portal.majoriti.world",
    slug: "compliance-latam",
    token,
  });
  if (!enlace) {
    throw new Error("No se pudo armar el enlace de la vista previa");
  }
  const identidad = {
    cliente: "ComplianceLatam",
    color: null,
    contactoEmail: "crivera@compliancelatam.legal",
    contactoNombre: null,
    logoUrl: null,
    titulo: null,
  };
  const invitacion = correoInvitacion({
    destinatario: { email: "persona@empresa.test", nombre: "Ana" },
    enlace,
    identidad,
    minutos: 15,
    textos: {
      asunto: asuntoConPrefijoPrueba(
        "Su experiencia con ComplianceLatam: entrevista de 15 minutos"
      ),
      cuerpo: [
        "Desde ComplianceLatam queremos conocer su experiencia con la red y entender cómo podemos ser más útiles en su trabajo.",
        "Le invitamos a una entrevista individual de aproximadamente 15 minutos en la plataforma Majoriti. Su perspectiva nos sirve incluso si hasta ahora ha participado poco o no ha utilizado la red.",
        "Puede guardar su avance y continuar más adelante desde este mismo enlace.",
        "Muchas gracias por su tiempo.",
      ].join("\n\n"),
      firma: "Equipo ComplianceLatam",
      remitente: "Equipo ComplianceLatam",
    },
  });
  expect(invitacion.subject).toBe(
    "[PRUEBA] Su experiencia con ComplianceLatam: entrevista de 15 minutos"
  );
  expect(invitacion.replyTo).toBe("crivera@compliancelatam.legal");
  expect(invitacion.remitenteVisible).toBe(
    "Equipo ComplianceLatam vía Majoriti"
  );
  const destino = `https://portal.majoriti.world/e/${token}`;
  expect(invitacion.text).toContain(`Comenzar mi entrevista: ${destino}`);
  expect(invitacion.text).toContain("no ha utilizado la red");
  expect(invitacion.text).toContain("guardar su avance");
  expect(invitacion.text).not.toContain("Este enlace es personal");
  expect(invitacion.text).not.toContain("código de acceso");
  expect(invitacion.text).not.toContain("basta con abrir");
  expect(invitacion.html).toContain(`href="${destino}"`);
  expect(invitacion.html).toContain("¿Tiene alguna pregunta?");
  expect(invitacion.html).toContain("Enviado a través de Majoriti");
  expect(invitacion.html).not.toContain("Si el botón no funciona");
  const boton = invitacion.html.indexOf(">Comenzar mi entrevista</a>");
  const ayuda = invitacion.html.indexOf("¿Tiene alguna pregunta?");
  const firma = invitacion.html.indexOf("Equipo ComplianceLatam");
  const pie = invitacion.html.indexOf("Enviado a través de Majoriti");
  expect(boton).toBeLessThan(ayuda);
  expect(ayuda).toBeLessThan(firma);
  expect(firma).toBeLessThan(pie);
  expect(invitacion.html.slice(boton, ayuda)).not.toContain("http");

  const gracias = correoConfirmacion({
    destinatario: { email: "persona@empresa.test", nombre: "Ana" },
    identidad,
    siguientePaso: null,
    textos: {
      asunto: "Recibimos sus respuestas",
      cuerpo:
        "Gracias por completar la entrevista. Sus respuestas llegaron correctamente a ComplianceLatam y se considerarán en el trabajo del proyecto.",
      firma: "Equipo ComplianceLatam",
      remitente: "Equipo ComplianceLatam",
    },
  });
  expect(gracias.subject).toBe("Recibimos sus respuestas");
  expect(gracias.text).toContain("Sus respuestas");
  expect(gracias.text).not.toMatch(/\btus\b/);
  expect(gracias.text).not.toContain("Comenzar mi entrevista");
  expect(gracias.html).not.toContain("margin:8px 0 24px");
  expect(gracias.replyTo).toBe("crivera@compliancelatam.legal");
});

function turnoFicticio(
  id: string,
  seccionId: string,
  texto: string
): TurnoEntrevista {
  return {
    at: "2026-10-01T12:00:00.000Z",
    id,
    ofertaCierre: false,
    rol: "entrevistado",
    seccionId,
    texto,
  };
}

test("una asignación ficticia recorre secciones, guardado, reanudación y transcripción", () => {
  const secciones = seccionesDeGuionClColaboradores();
  const [primera, segunda] = secciones;
  if (!(primera && segunda)) {
    throw new Error("El guion de colaboradores no tiene dos secciones");
  }
  const trasPrimera = resolverAvanceSeccion(0, secciones.length);
  expect(trasPrimera.seccionActual).toBe(1);
  expect(trasPrimera.flujoEstado).toBe("presentacion");

  const guardado = turnoFicticio(
    "turno-ficticio-1",
    primera.id,
    "He usado poco la red."
  );
  const siguiente = turnoFicticio(
    "turno-ficticio-2",
    segunda.id,
    "Necesito información más clara para mi trabajo."
  );
  const reanudados = fusionarTurnos([guardado], [guardado, siguiente]);
  expect(reanudados).toHaveLength(2);

  let indice = trasPrimera.seccionActual;
  let flujo = trasPrimera.flujoEstado;
  while (indice < secciones.length) {
    const avance = resolverAvanceSeccion(indice, secciones.length);
    indice = avance.seccionActual;
    flujo = avance.flujoEstado;
  }
  expect(flujo).toBe("revision");
  expect(haySeccionesPendientes(secciones, [])).toBe(true);

  const archivo = construirArchivoTranscripcion({
    fase: NOMBRE_FASE_COLABORADORES,
    fecha: "2026-10-01T12:00:00.000Z",
    firma: "Empresa ficticia",
    nombre: "Persona ficticia",
    proyecto: "ComplianceLatam",
    turnos: reanudados,
  });
  expect(archivo.content).toContain("**Fase:** Entrevistas a colaboradores");
  expect(archivo.content).toContain("Persona ficticia");
  expect(archivo.content).toContain("He usado poco la red.");
  expect(archivo.content).not.toContain("seba@majoriti.world");
});

test("el correo + código ya no se corta para colaboradores", () => {
  const acciones = readFileSync("app/(auth)/actions.ts", "utf8");
  expect(acciones).not.toContain("debeBloquearOtp");
});

test("la transcripción nombra la fase solo cuando se la conoce y el enlace personal no es un código", () => {
  const sinFase = construirArchivoTranscripcion({
    fecha: null,
    firma: "Epiroc",
    nombre: "Francisco",
    proyecto: "ComplianceLatam",
    turnos: [],
  });
  expect(sinFase.content).not.toContain("**Fase:**");
  const conFase = construirArchivoTranscripcion({
    fase: NOMBRE_FASE_COLABORADORES,
    fecha: null,
    firma: "Epiroc",
    nombre: "Francisco",
    proyecto: "ComplianceLatam",
    turnos: [],
  });
  expect(conFase.content).toContain(`**Fase:** ${NOMBRE_FASE_COLABORADORES}`);

  const token = "vista-previa-local";
  const enlace = crearEnlaceAcceso({
    entrevistaId: ENTREVISTA,
    permitirLocal: true,
    site: "http://localhost:3000",
    slug: "compliance-latam",
    token,
  });
  expect(enlace?.modo).toBe("enlace_personal");
  expect(enlace?.url).toBe(`http://localhost:3000/e/${token}`);
  expect(enlace?.alternativa).toBe(
    `http://localhost:3000/login?next=${encodeURIComponent(`/portal/entrevista/${ENTREVISTA}`)}`
  );
  expect(
    enlace &&
      validarEnlaceAcceso(enlace, {
        entrevistaId: ENTREVISTA,
        permitirLocal: true,
        site: "http://localhost:3000",
        slug: "compliance-latam",
        token,
      })
  ).toBe(true);
  expect(
    crearEnlaceAcceso({
      entrevistaId: ENTREVISTA,
      permitirLocal: true,
      site: "http://localhost:3000",
      slug: null,
    })?.modo
  ).toBe("codigo");
});

function fila(
  hoja: string,
  numero: number,
  correo: string,
  cargo: string,
  fecha: string,
  nombre = "Francisco",
  empresa = "Epiroc"
) {
  return {
    apellido: "Godoy",
    cargo,
    correo,
    empresa,
    fechaIngreso: fecha,
    fila: numero,
    hoja,
    industria: "Minería",
    nombre,
    pais: "Chile",
  };
}
