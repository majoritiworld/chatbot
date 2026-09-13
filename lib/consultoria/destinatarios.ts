import { z } from "zod";

export const MAX_DESTINATARIOS = 50;

const LINEA_VACIA = /^\s*$/;
const LINEA_COMENTARIO = /^\s*#/;
const COMILLAS = /^["']|["']$/g;
const SEPARADOR_NOMBRE = /[._-]+/;

const emailSchema = z.string().email();

function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

export type DestinatarioPlantilla = {
  email: string;
  nombre: string;
  firma: string | null;
};

export type DestinatariosParseados =
  | { ok: true; destinatarios: DestinatarioPlantilla[] }
  | { ok: false; message: string };

function partirCampos(linea: string): string[] {
  if (linea.includes("\t")) {
    return linea.split("\t");
  }
  if (linea.includes(";")) {
    return linea.split(";");
  }
  return linea.split(",");
}

function limpiarCampo(value: string) {
  return value.trim().replace(COMILLAS, "").trim();
}

function nombreDesdeEmail(email: string) {
  const corte = email.indexOf("@");
  const local = corte === -1 ? email : email.slice(0, corte);
  const partes = local
    .split(SEPARADOR_NOMBRE)
    .filter((parte) => parte.length > 0);

  if (partes.length === 0) {
    return email;
  }

  return partes
    .map((parte) => {
      const inicial = parte.at(0);
      if (!inicial) {
        return parte;
      }
      return `${inicial.toUpperCase()}${parte.slice(1)}`;
    })
    .join(" ");
}

/**
 * One recipient per line: `email`, `email, nombre`, or `email, nombre, firma`.
 * Comma, semicolon, and tab all work as separators.
 */
export function parseDestinatarios(
  raw: string,
  firmaDefault: string | null
): DestinatariosParseados {
  const lineas = raw
    .split("\n")
    .filter(
      (linea) => !(LINEA_VACIA.test(linea) || LINEA_COMENTARIO.test(linea))
    );

  if (lineas.length === 0) {
    return { message: "Pega al menos un correo", ok: false };
  }

  if (lineas.length > MAX_DESTINATARIOS) {
    return {
      message: `Máximo ${MAX_DESTINATARIOS} destinatarios por envío`,
      ok: false,
    };
  }

  const destinatarios: DestinatarioPlantilla[] = [];
  const vistos = new Set<string>();

  for (const [indice, linea] of lineas.entries()) {
    const campos = partirCampos(linea).map(limpiarCampo);
    const emailRaw = campos.at(0) ?? "";
    const emailParsed = emailSchema.safeParse(normalizarEmail(emailRaw));

    if (!emailParsed.success) {
      return {
        message: `Línea ${indice + 1}: email inválido`,
        ok: false,
      };
    }

    const email = emailParsed.data;
    if (vistos.has(email)) {
      continue;
    }
    vistos.add(email);

    const nombreCampo = campos.at(1);
    const firmaCampo = campos.at(2);
    const nombre =
      nombreCampo && nombreCampo.length > 0
        ? nombreCampo
        : nombreDesdeEmail(email);
    const firma =
      firmaCampo && firmaCampo.length > 0 ? firmaCampo : firmaDefault;

    destinatarios.push({ email, firma, nombre });
  }

  if (destinatarios.length === 0) {
    return { message: "Pega al menos un correo", ok: false };
  }

  return { destinatarios, ok: true };
}
