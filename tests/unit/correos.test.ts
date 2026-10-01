import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  resolverComunicacion,
  resolverTextosCorreo,
} from "@/lib/consultoria/comunicacion";
import {
  evaluarAsignacionCorreo,
  type FilasAsignacionCorreo,
} from "@/lib/consultoria/correos/asignacion";
import {
  correoParaVistaPrevia,
  EJEMPLOS_CORREO,
} from "@/lib/consultoria/correos/ejemplos";
import {
  crearEnlaceAcceso,
  origenAutorizado,
  validarEnlaceAcceso,
} from "@/lib/consultoria/correos/enlace-acceso";
import {
  correoConfirmacion,
  correoInvitacion,
  remitenteVisible,
} from "@/lib/consultoria/correos/variantes";

const SITE = "https://portal.example.test";
const ENTREVISTA = "40000000-0000-4000-8000-000000000001";
const OTRA_ENTREVISTA = "40000000-0000-4000-8000-000000000002";
const PROYECTO = "40000000-0000-4000-8000-00000000000a";
const OTRO_PROYECTO = "40000000-0000-4000-8000-00000000000b";
const TAG_SCRIPT = /<script>/;
const TAG_SCRIPT_ESCAPADO = /&lt;script&gt;/;
const PARRAFO_COMERCIAL = /Conozca Majoriti/;
const CODIGO = /\.(ts|tsx)$/;

function filas(
  cambios: Omit<Partial<FilasAsignacionCorreo>, "proyecto"> & {
    proyecto?: Partial<NonNullable<FilasAsignacionCorreo["proyecto"]>>;
  } = {}
): FilasAsignacionCorreo {
  return {
    entrevistaId: ENTREVISTA,
    fase: { minutos: 15, proyecto_id: PROYECTO },
    plantillaProyectoId: PROYECTO,
    stakeholder: {
      apellido: "Prueba",
      email: "lucia@example.test",
      nombre: "Lucía",
      proyecto_id: PROYECTO,
    },
    ...cambios,
    proyecto: {
      color_principal: "#1f4b3a",
      contacto_email: "ana@cliente.test",
      id: PROYECTO,
      logo_path: "logo.png",
      nombre_publico: "Compliance Demo",
      slug: "cliente-2026",
      ...cambios.proyecto,
    },
  };
}

function evaluar(fila: FilasAsignacionCorreo, emailEsperado?: string) {
  return evaluarAsignacionCorreo(fila, {
    emailEsperado,
    permitirLocal: false,
    site: SITE,
  });
}

function asignacionOk(fila: FilasAsignacionCorreo) {
  const resultado = evaluar(fila);
  if (!resultado.ok) {
    throw new Error(resultado.motivo);
  }
  return resultado.asignacion;
}

test("resolverComunicacion keeps its shape for current consumers", () => {
  const textos = resolverComunicacion(
    { correo_asunto: "Proyecto", correo_cuerpo: "Cuerpo" },
    { correo_asunto: "Fase", minutos: 10 }
  );
  expect(Object.keys(textos).sort()).toEqual([
    "avisoRespuestas",
    "bloqueComercial",
    "bloqueComercialEtiqueta",
    "bloqueComercialUrl",
    "correoAsunto",
    "correoCuerpo",
    "correoFirma",
    "correoRemitente",
    "textoBienvenida",
  ]);
  expect(textos.correoAsunto).toBe("Fase");
  expect(textos.correoCuerpo).toBe("Cuerpo");
});

test("confirmation and invitation copy never borrow each other's fields", () => {
  const textos = resolverTextosCorreo(
    {
      correo_asunto: "Asunto de confirmación",
      correo_cuerpo: "Cuerpo de confirmación",
      invitacion_asunto: "Asunto de invitación",
    },
    { invitacion_cuerpo: "Cuerpo de invitación de la fase" }
  );
  expect(textos.confirmacion.asunto).toBe("Asunto de confirmación");
  expect(textos.confirmacion.cuerpo).toBe("Cuerpo de confirmación");
  expect(textos.invitacion.asunto).toBe("Asunto de invitación");
  expect(textos.invitacion.cuerpo).toBe("Cuerpo de invitación de la fase");

  const soloConfirmacion = resolverTextosCorreo(
    { correo_asunto: "Solo confirmación" },
    null
  );
  expect(soloConfirmacion.invitacion.asunto).toBeNull();
  expect(soloConfirmacion.invitacion.cuerpo).toBeNull();
});

test("an assignment is blocked unless recipient, phase and project agree", () => {
  expect(evaluar(filas()).ok).toBe(true);
  expect(
    evaluar(filas({ fase: { proyecto_id: OTRO_PROYECTO } }))
  ).toMatchObject({ motivo: "asignacion_inconsistente" });
  expect(evaluar(filas({ plantillaProyectoId: OTRO_PROYECTO }))).toMatchObject({
    motivo: "asignacion_inconsistente",
  });
  expect(evaluar(filas({ proyecto: { id: OTRO_PROYECTO } }))).toMatchObject({
    motivo: "asignacion_inconsistente",
  });
  expect(evaluar(filas(), "otra@example.test")).toMatchObject({
    motivo: "destinatario_distinto",
  });
  expect(evaluar(filas(), " LUCIA@example.test ").ok).toBe(true);
  expect(evaluar(filas({ stakeholder: null }))).toMatchObject({
    motivo: "sin_entrevista",
  });
  expect(
    evaluar(
      filas({
        stakeholder: { email: "no-es-correo", proyecto_id: PROYECTO },
      })
    )
  ).toMatchObject({ motivo: "sin_destinatario" });
});

test("client name falls back to proyecto.cliente, and contact is required", () => {
  const conCliente = asignacionOk(
    filas({ proyecto: { cliente: "Cliente SA", nombre_publico: null } })
  );
  expect(conCliente.identidad.cliente).toBe("Cliente SA");
  expect(
    evaluar(filas({ proyecto: { cliente: " ", nombre_publico: null } }))
  ).toMatchObject({ motivo: "sin_cliente" });
  expect(evaluar(filas({ proyecto: { contacto_email: null } }))).toMatchObject({
    motivo: "sin_contacto",
  });
  expect(
    evaluar(filas({ proyecto: { contacto_email: "ana@cliente" } }))
  ).toMatchObject({ motivo: "sin_contacto" });
});

test("logo is an absolute site URL, and missing logo or color degrade cleanly", () => {
  const conLogo = asignacionOk(filas());
  expect(conLogo.identidad.logoUrl).toBe(`${SITE}/marca/cliente-2026/logo`);

  const sinLogo = asignacionOk(
    filas({ proyecto: { color_principal: null, logo_path: null } })
  );
  const correo = correoConfirmacion({
    destinatario: sinLogo.destinatario,
    identidad: sinLogo.identidad,
    siguientePaso: null,
    textos: sinLogo.textos.confirmacion,
  });
  expect(correo.html).not.toContain("<img");
  expect(correo.html).toContain(">Compliance Demo</p>");
  expect(correo.html).toContain("#1f2937");
});

test("names and configured copy are escaped in HTML and kept plain in text", () => {
  const asignacion = asignacionOk(
    filas({
      proyecto: {
        correo_cuerpo: 'Gracias <script>alert("x")</script> & más.',
        nombre_publico: 'Cliente "Uno" <b>',
      },
      stakeholder: {
        email: "lucia@example.test",
        nombre: "<img src=x onerror=alert(1)>",
        proyecto_id: PROYECTO,
      },
    })
  );
  const correo = correoConfirmacion({
    destinatario: asignacion.destinatario,
    identidad: asignacion.identidad,
    siguientePaso: null,
    textos: asignacion.textos.confirmacion,
  });
  expect(correo.html).not.toMatch(TAG_SCRIPT);
  expect(correo.html).toMatch(TAG_SCRIPT_ESCAPADO);
  expect(correo.html).not.toContain("<img src=x");
  expect(correo.html).toContain("Cliente &quot;Uno&quot; &lt;b&gt;");
  expect(correo.text).toContain('Gracias <script>alert("x")</script> & más.');
  expect(correo.remitenteVisible).toBe('Cliente "Uno" <b> vía Majoriti');
});

test("confirmation shows a next step and button only when the phase defines one", () => {
  const asignacion = asignacionOk(
    filas({
      fase: {
        bloque_comercial: "Conozca Majoriti.",
        bloque_comercial_etiqueta: "Ver más",
        bloque_comercial_url: "https://majoriti.world",
        proyecto_id: PROYECTO,
      },
    })
  );
  const conPaso = correoConfirmacion({
    destinatario: asignacion.destinatario,
    identidad: asignacion.identidad,
    siguientePaso: asignacion.textos.siguientePaso,
    textos: asignacion.textos.confirmacion,
  });
  expect(conPaso.html).toMatch(PARRAFO_COMERCIAL);
  expect(conPaso.html).toContain(
    "background-color:#f4f4f5;border:1px solid #e4e4e7;border-radius:12px;padding:20px 22px;"
  );
  expect(conPaso.html).toContain('href="https://majoriti.world"');
  expect(conPaso.html).toContain(">Ver más</a>");
  expect(conPaso.html).not.toContain("Si el botón no funciona");
  expect(conPaso.html).not.toContain("margin:8px 0 24px");
  expect(conPaso.html).not.toContain(">https://majoriti.world<");
  expect(conPaso.text).toContain("Conozca Majoriti.");
  expect(conPaso.text).toContain("Ver más: https://majoriti.world");

  const sinPaso = correoConfirmacion({
    destinatario: asignacion.destinatario,
    identidad: asignacion.identidad,
    siguientePaso: null,
    textos: asignacion.textos.confirmacion,
  });
  expect(sinPaso.html).not.toContain("<a href");
  expect(sinPaso.subject).toBe("Recibimos sus respuestas");
  expect(sinPaso.html).toContain("Recibimos sus respuestas</h1>");
  expect(sinPaso.html).toContain("Enviado a través de Majoriti");
  expect(sinPaso.replyTo).toBe("ana@cliente.test");
});

test("access links come from the assignment and the authorized origin only", () => {
  expect(origenAutorizado("https://portal.example.test/", false)).toBe(SITE);
  expect(origenAutorizado("http://portal.example.test", true)).toBeNull();
  expect(origenAutorizado("http://localhost:3000", false)).toBeNull();
  expect(origenAutorizado("http://localhost:3000", true)).toBe(
    "http://localhost:3000"
  );

  const contexto = {
    entrevistaId: ENTREVISTA,
    permitirLocal: false,
    site: SITE,
    slug: "cliente-2026",
  };
  const enlace = crearEnlaceAcceso(contexto);
  expect(enlace?.url).toBe(`${SITE}/cliente-2026?codigo=1`);
  expect(enlace && validarEnlaceAcceso(enlace, contexto)).toBe(true);

  const sinSlug = { ...contexto, slug: null };
  const login = crearEnlaceAcceso(sinSlug);
  expect(login?.url).toBe(
    `${SITE}/login?next=${encodeURIComponent(`/portal/entrevista/${ENTREVISTA}`)}`
  );
  expect(login && validarEnlaceAcceso(login, sinSlug)).toBe(true);

  const falsos = [
    {
      entrevistaId: ENTREVISTA,
      modo: "codigo" as const,
      url: "https://evil.example/cliente-2026",
    },
    {
      entrevistaId: ENTREVISTA,
      modo: "codigo" as const,
      url: `${SITE}/otra-firma`,
    },
    {
      entrevistaId: ENTREVISTA,
      modo: "codigo" as const,
      url: `${SITE}/cliente-2026?next=https://evil.example`,
    },
    {
      entrevistaId: ENTREVISTA,
      modo: "codigo" as const,
      url: `${SITE}/cliente-2026`,
    },
    {
      entrevistaId: OTRA_ENTREVISTA,
      modo: "codigo" as const,
      url: `${SITE}/cliente-2026`,
    },
    {
      entrevistaId: ENTREVISTA,
      modo: "enlace_personal" as const,
      url: `${SITE}/cliente-2026`,
    },
  ];
  for (const falso of falsos) {
    expect(validarEnlaceAcceso(falso, contexto)).toBe(false);
  }
  expect(
    validarEnlaceAcceso(
      {
        entrevistaId: ENTREVISTA,
        modo: "codigo",
        url: `${SITE}/login?next=/portal/entrevista/${OTRA_ENTREVISTA}`,
      },
      sinSlug
    )
  ).toBe(false);
});

test("invitation explains who, why, how long, saving and access, with no bcc hint", () => {
  const asignacion = asignacionOk(
    filas({ proyecto: { titulo_iniciativa: "Iniciativa 2026" } })
  );
  const enlace = crearEnlaceAcceso({
    entrevistaId: ENTREVISTA,
    permitirLocal: false,
    site: SITE,
    slug: asignacion.slug,
  });
  if (!enlace) {
    throw new Error("sin enlace");
  }
  const correo = correoInvitacion({
    destinatario: asignacion.destinatario,
    enlace,
    identidad: asignacion.identidad,
    minutos: asignacion.minutos,
    textos: asignacion.textos.invitacion,
  });
  expect(correo.tipo).toBe("invitacion");
  expect(correo.subject).toBe(
    "Compliance Demo le invita a una entrevista — Iniciativa 2026"
  );
  expect(correo.html).toContain("Comenzar mi entrevista");
  expect(correo.html).toContain(`href="${SITE}/cliente-2026?codigo=1"`);
  expect(correo.html).toContain("Si el botón no funciona");
  expect(correo.html).toContain("margin:8px 0 12px");
  expect(correo.html).not.toContain("margin:8px 0 24px");
  expect(correo.text).toContain(`Comenzar mi entrevista: ${SITE}/cliente-2026`);
  expect(correo.text).toContain("aproximadamente 15 minutos");
  expect(correo.text).toContain("su avance queda guardado");
  expect(correo.text).toContain("Esta invitación es personal");
  expect(correo.text).toContain("código de acceso");
  expect(correo.text).not.toContain("sin código");
});

test("a personal-link invitation needs no email and names no other client", () => {
  const asignacion = asignacionOk(filas());
  const enlace = crearEnlaceAcceso({
    entrevistaId: ENTREVISTA,
    permitirLocal: false,
    site: SITE,
    slug: asignacion.slug,
    token: "token-personal-de-prueba-123",
  });
  if (!enlace) {
    throw new Error("sin enlace");
  }
  const correo = correoInvitacion({
    destinatario: asignacion.destinatario,
    enlace,
    identidad: asignacion.identidad,
    minutos: asignacion.minutos,
    textos: asignacion.textos.invitacion,
  });
  const url = `${SITE}/e/token-personal-de-prueba-123`;
  expect(enlace.alternativa).toContain("/login?next=");
  expect(correo.html).toContain(`href="${url}"`);
  expect(correo.html).toContain("margin:8px 0 24px");
  expect(correo.html).not.toContain("Si el botón no funciona");
  expect(correo.html).not.toContain(`>${url}<`);
  expect(correo.html).not.toContain("basta con abrir");
  expect(correo.html).not.toContain("Este enlace es personal");
  expect(correo.html).not.toContain("código de acceso");
  expect(correo.html).not.toContain(enlace.alternativa ?? "");
  expect(correo.text).toContain(`Comenzar mi entrevista: ${url}`);
  expect(correo.text).not.toContain("basta con abrir");
  expect(correo.text).not.toContain("use como usuario");
  expect(correo.text).not.toContain("Este enlace es personal");
  expect(correo.text).not.toContain("código de acceso");
  expect(correo.text).not.toContain(enlace.alternativa ?? "");
  expect(correo.text).toContain("Compliance Demo le invita");
  expect(correo.html).not.toContain("ComplianceLatam");

  const boton = correo.html.indexOf(">Comenzar mi entrevista</a>");
  const ayuda = correo.html.indexOf("¿Tiene alguna pregunta?");
  const firma = correo.html.indexOf("Equipo Compliance Demo");
  const pie = correo.html.indexOf("Enviado a través de Majoriti");
  expect(correo.html.indexOf("Puede guardar su avance")).toBeLessThan(boton);
  expect(boton).toBeLessThan(ayuda);
  expect(ayuda).toBeLessThan(firma);
  expect(firma).toBeLessThan(pie);
  const entreBotonYAyuda = correo.html.slice(boton, ayuda);
  expect(entreBotonYAyuda).not.toContain("Si el botón");
  expect(entreBotonYAyuda).not.toContain("http");
  expect(correo.text.indexOf(`Comenzar mi entrevista: ${url}`)).toBeLessThan(
    correo.text.indexOf("¿Tiene alguna pregunta?")
  );

  const conCuerpo = correoInvitacion({
    destinatario: asignacion.destinatario,
    enlace,
    identidad: asignacion.identidad,
    minutos: 15,
    textos: {
      ...asignacion.textos.invitacion,
      cuerpo:
        "Una entrevista de 15 minutos.\n\nPuede guardar su avance y continuar más adelante desde este mismo enlace.",
    },
  });
  expect(conCuerpo.text.match(/minutos/g)).toHaveLength(1);
  expect(conCuerpo.text.match(/guardar su avance/g)).toHaveLength(1);
  const botonCuerpo = conCuerpo.html.indexOf(">Comenzar mi entrevista</a>");
  const ayudaCuerpo = conCuerpo.html.indexOf("¿Tiene alguna pregunta?");
  expect(botonCuerpo).toBeLessThan(ayudaCuerpo);
  expect(conCuerpo.html.slice(botonCuerpo, ayudaCuerpo)).not.toContain("http");
  expect(conCuerpo.text).toContain(`Comenzar mi entrevista: ${url}`);
  expect(conCuerpo.html).not.toContain("código de acceso");
});

test("sender reads «Cliente vía Majoriti» and is not duplicated", () => {
  expect(remitenteVisible("ComplianceLatam", null)).toBe(
    "ComplianceLatam vía Majoriti"
  );
  expect(
    remitenteVisible("ComplianceLatam", "ComplianceLatam vía Majoriti")
  ).toBe("ComplianceLatam vía Majoriti");
});

test("every preview fixture renders both messages without mixing clients", () => {
  for (const ejemplo of EJEMPLOS_CORREO) {
    for (const tipo of ["confirmacion", "invitacion"] as const) {
      const correo = correoParaVistaPrevia({
        filasAsignacion: ejemplo.filas,
        imagenes: true,
        logo: ejemplo.logo,
        permitirLocal: false,
        site: SITE,
        tipo,
      });
      if ("error" in correo) {
        throw new Error(`${ejemplo.id} ${tipo}: ${correo.error}`);
      }
      for (const otro of EJEMPLOS_CORREO) {
        const nombre = otro.filas.proyecto?.nombre_publico;
        if (otro.id !== ejemplo.id && nombre) {
          expect(correo.html).not.toContain(nombre);
        }
      }
      expect(correo.text.length).toBeGreaterThan(100);
    }
  }
});

test("invitations stay disabled on the server and no app code imports the sender", () => {
  const correo = readFileSync("lib/consultoria/email-entrevista.ts", "utf8");
  expect(correo).toContain(
    'correo.tipo === "invitacion" && !invitacionesHabilitadas()'
  );
  const fuentes = ["app", "components", "lib"].flatMap((carpeta) =>
    readdirSync(carpeta, { recursive: true })
      .map(String)
      .filter((ruta) => CODIGO.test(ruta))
      .map((ruta) => join(carpeta, ruta))
  );
  const importan = fuentes.filter(
    (ruta) =>
      ruta !== join("lib", "consultoria", "email-entrevista.ts") &&
      readFileSync(ruta, "utf8").includes("enviarCorreoInvitacion")
  );
  expect(importan).toEqual([]);
});
