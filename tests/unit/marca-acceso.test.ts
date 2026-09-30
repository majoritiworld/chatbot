import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  decidirEntradaProyecto,
  mostrarPortalFases,
  operacionEntrevistaPermitida,
  proyectoUnicoLegacy,
} from "@/lib/consultoria/acceso-proyecto";
import {
  claveIdempotenciaConfirmacion,
  enlaceDeProyecto,
  marcaPredeterminada,
  medidasImagen,
  mensajeSlugInvalido,
  presentacionPublica,
  puntosUsoConMarca,
  slugValido,
  textoAccesoInvitacion,
  textoBienvenidaParticipante,
  textoContactoFallo,
  textoInstruccionCorreo,
  textoPausa,
} from "@/lib/consultoria/marca";

const PROYECTO_A = "20000000-0000-4000-8000-000000000001";
const PROYECTO_B = "20000000-0000-4000-8000-000000000002";

test("png and jpeg logos report their real pixel size", () => {
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  png.set([73, 72, 68, 82], 12);
  const pngVista = new DataView(png.buffer);
  pngVista.setUint32(16, 445);
  pngVista.setUint32(20, 367);
  expect(medidasImagen(png)).toEqual({ alto: 367, ancho: 445 });

  const jpeg = new Uint8Array([
    255, 216, 255, 192, 0, 11, 8, 1, 111, 1, 189, 1, 0, 17, 0,
  ]);
  expect(medidasImagen(jpeg)).toEqual({ alto: 367, ancho: 445 });
  expect(medidasImagen(new Uint8Array([0, 1, 2]))).toBeNull();
});

test("reserved and invalid slugs never become a project link", () => {
  expect(slugValido("admin")).toBeNull();
  expect(slugValido("login")).toBeNull();
  expect(slugValido("portal")).toBeNull();
  expect(slugValido("Compliance Latam")).toBeNull();
  expect(slugValido("compliance-latam-2026")).toBe("compliance-latam-2026");
  expect(mensajeSlugInvalido("admin")).toMatch(/reservado/);
});

test("an unconfigured project keeps the default presentation", () => {
  const marca = presentacionPublica({ cliente: "ComplianceLatam" });
  expect(marca.personalizada).toBe(false);
  expect(marca.nombre).toBe("Majoriti");
  expect(marca.logoSrc).toBe("/images/majoriti-logo.png");
  expect(textoAccesoInvitacion(marca)).toMatch(/Majoriti/);
  expect(textoBienvenidaParticipante(marca, "un tema")).toMatch(/Majoriti/);
  expect(textoContactoFallo(marca)).toBe("Contacta a Majoriti.");
  expect(textoPausa(marcaPredeterminada())).not.toMatch(/Majoriti/);
});

test("a client brand without its own logo never shows the Majoriti logo", () => {
  const marca = presentacionPublica({
    nombre_publico: "ComplianceLatam",
    slug: "compliance-latam",
  });
  expect(marca.logoSrc).toBeNull();
});

test("a configured project uses the client identity on every participant line", () => {
  const marca = presentacionPublica({
    cliente: "Interno",
    color_principal: "#1F4B3A",
    contacto_email: "ana@cliente.test",
    contacto_nombre: "Ana",
    logo_path: "proyecto/logo.png",
    nombre_publico: "ComplianceLatam",
    slug: "compliance-latam-2026",
    texto_bienvenida: "Bienvenida del cliente.",
    titulo_iniciativa: "Iniciativa 2026",
  });
  expect(marca.personalizada).toBe(true);
  expect(marca.nombre).toBe("ComplianceLatam");
  expect(marca.titulo).toBe("Iniciativa 2026");
  expect(marca.logoSrc).toBe("/marca/compliance-latam-2026/logo");
  expect(marca.color).toBe("#1f4b3a");
  expect(textoAccesoInvitacion(marca)).toMatch(/ComplianceLatam/);
  expect(textoAccesoInvitacion(marca)).not.toMatch(/Majoriti/);
  expect(textoInstruccionCorreo(marca, false)).toBe(
    "Escribe tu correo y te enviaremos un código para entrar."
  );
  expect(textoInstruccionCorreo(marca, true)).toMatch(/entras directo/);
  expect(textoInstruccionCorreo(marcaPredeterminada(), false)).toMatch(
    /entras directo/
  );
  expect(textoBienvenidaParticipante(marca, "un tema")).toBe(
    "Bienvenida del cliente."
  );
  expect(textoContactoFallo(marca)).toMatch(/Ana/);
  expect(textoPausa(marca)).toMatch(/ComplianceLatam/);
  expect(puntosUsoConMarca(marca, "ComplianceLatam").join(" ")).not.toMatch(
    /puede leer la entrevista/
  );
  expect(puntosUsoConMarca(marca, "ComplianceLatam").join(" ")).not.toMatch(
    /Majoriti/
  );
  expect(
    enlaceDeProyecto("https://portal.majoriti.world/", marca.slug ?? "")
  ).toBe("https://portal.majoriti.world/compliance-latam-2026");
});

test("another project or another session does not enter", () => {
  const membresias = [
    { email: "ana@cliente.test", proyectoId: PROYECTO_A },
    { email: "ana@cliente.test", proyectoId: PROYECTO_B },
  ];
  expect(
    decidirEntradaProyecto({
      email: "ana@cliente.test",
      membresias,
      proyectoId: PROYECTO_B,
      sesionEmail: "ana@cliente.test",
    })
  ).toBe("permitido");
  expect(
    decidirEntradaProyecto({
      email: "ana@cliente.test",
      membresias: [{ email: "ana@cliente.test", proyectoId: PROYECTO_A }],
      proyectoId: PROYECTO_B,
      sesionEmail: "ana@cliente.test",
    })
  ).toBe("sin_acceso");
  expect(
    decidirEntradaProyecto({
      email: "ana@cliente.test",
      membresias,
      proyectoId: PROYECTO_B,
      sesionEmail: "otro@cliente.test",
    })
  ).toBe("sesion_ajena");
});

test("phase links stay on the home project for a client", () => {
  expect(
    mostrarPortalFases({
      proyectoEntrevistaId: PROYECTO_A,
      proyectoOrigenId: PROYECTO_A,
      rol: "cliente",
    })
  ).toBe(true);
  expect(
    mostrarPortalFases({
      proyectoEntrevistaId: PROYECTO_B,
      proyectoOrigenId: PROYECTO_A,
      rol: "cliente",
    })
  ).toBe(false);
  expect(
    mostrarPortalFases({
      proyectoEntrevistaId: PROYECTO_A,
      proyectoOrigenId: PROYECTO_A,
      rol: "stakeholder",
    })
  ).toBe(false);
  expect(
    mostrarPortalFases({
      proyectoEntrevistaId: null,
      proyectoOrigenId: PROYECTO_A,
      rol: "cliente",
    })
  ).toBe(false);
});

test("the same email keeps independent permission in each project", () => {
  expect(proyectoUnicoLegacy([PROYECTO_A])).toBe(PROYECTO_A);
  expect(proyectoUnicoLegacy([PROYECTO_A, PROYECTO_B])).toBeNull();
  expect(proyectoUnicoLegacy([])).toBeNull();
  expect(
    operacionEntrevistaPermitida({
      emailSesion: "ana@cliente.test",
      emailStakeholder: "ana@cliente.test",
      membresias: [{ proyectoId: PROYECTO_A }, { proyectoId: PROYECTO_B }],
      proyectoId: PROYECTO_B,
    })
  ).toBe(true);
  expect(
    operacionEntrevistaPermitida({
      emailSesion: "ana@cliente.test",
      emailStakeholder: "ana@cliente.test",
      membresias: [{ proyectoId: PROYECTO_A }],
      proyectoId: PROYECTO_B,
    })
  ).toBe(false);
  expect(
    operacionEntrevistaPermitida({
      emailSesion: "otro@cliente.test",
      emailStakeholder: "ana@cliente.test",
      membresias: [{ proyectoId: PROYECTO_B }],
      proyectoId: PROYECTO_B,
    })
  ).toBe(false);
});

test("the completion idempotency key is stable per interview", () => {
  expect(claveIdempotenciaConfirmacion("entrevista-1")).toBe(
    "entrevista-entrevista-1-agradecimiento"
  );
  expect(claveIdempotenciaConfirmacion("entrevista-1")).toBe(
    claveIdempotenciaConfirmacion("entrevista-1")
  );
});

test("the server no longer sends portal invitations", () => {
  const auth = readFileSync("lib/consultoria/auth.ts", "utf8");
  const correo = readFileSync("lib/consultoria/email-entrevista.ts", "utf8");
  const plantillas = readFileSync("lib/consultoria/plantillas.ts", "utf8");
  const acciones = readFileSync("app/(admin)/admin/actions.ts", "utf8");
  expect(auth).not.toContain("inviteUserByEmail");
  expect(correo).not.toContain("enviarCorreoInvitacionEntrevista");
  expect(correo).toContain('process.env.HABILITAR_INVITACIONES_CORREO === "1"');
  expect(plantillas).not.toContain("enviarInvitacionEntrevista");
  expect(acciones).not.toContain("invitarEntrevistaAsignada");
});
