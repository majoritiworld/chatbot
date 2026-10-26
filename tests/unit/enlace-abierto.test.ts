import { expect, test } from "@playwright/test";
import {
  seccionesParaNuevaEntrevista,
  validarDatosEnlaceAbierto,
} from "@/lib/consultoria/enlace-abierto-reglas";

const datos = {
  email: "  Ana.Perez@Empresa.com ",
  empresa: " Empresa SA ",
  nombre: " Ana Pérez ",
  sitio: "",
};

test("valid details are trimmed and the email is lowercased", () => {
  expect(validarDatosEnlaceAbierto(datos)).toEqual({
    datos: {
      email: "ana.perez@empresa.com",
      empresa: "Empresa SA",
      nombre: "Ana Pérez",
    },
    ok: true,
  });
});

test("each missing or invalid field gets its own message", () => {
  const resultado = validarDatosEnlaceAbierto({
    email: "no-es-correo",
    empresa: "  ",
    nombre: "",
    sitio: "",
  });
  expect(resultado.ok).toBe(false);
  if (resultado.ok || "trampa" in resultado) {
    throw new Error("expected field errors");
  }
  expect(resultado.errores).toEqual({
    email: "Escriba un correo electrónico válido.",
    empresa: "Escriba el nombre de su empresa.",
    nombre: "Escriba su nombre.",
  });
});

test("a filled hidden field is treated as a bot and creates nothing", () => {
  expect(
    validarDatosEnlaceAbierto({ ...datos, sitio: "https://spam.example" })
  ).toEqual({ ok: false, trampa: true });
});

test("template sections keep every field and get a fresh id", () => {
  const seccion = {
    apertura: "Gracias por su tiempo.",
    conversacionContinua: true,
    id: "plantilla-1",
    preguntas: ["¿Qué le ha resultado útil?"],
    titulo: "Conversación",
  };
  const secciones = seccionesParaNuevaEntrevista(
    [seccion, "no es una sección"],
    () => "nueva-1"
  );
  expect(secciones).toEqual([{ ...seccion, id: "nueva-1" }]);
  expect(seccion.id).toBe("plantilla-1");
});

test("a template without sections yields none", () => {
  expect(seccionesParaNuevaEntrevista(null, () => "x")).toEqual([]);
});
