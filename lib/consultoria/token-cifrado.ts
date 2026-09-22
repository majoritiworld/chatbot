import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const VERSION = "v1";
const SAL = "majoriti-calendario";

let claveCache: { secreto: string; clave: Buffer } | null = null;

function clave(secreto: string) {
  if (claveCache?.secreto === secreto) {
    return claveCache.clave;
  }

  const derivada = scryptSync(secreto, SAL, 32);
  claveCache = { clave: derivada, secreto };
  return derivada;
}

export function cifrarSecreto(valor: string, secreto: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", clave(secreto), iv);
  const cifrado = Buffer.concat([cipher.update(valor, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    cifrado.toString("base64url"),
  ].join(".");
}

export function descifrarSecreto(empaquetado: string, secreto: string) {
  const [version, ivRaw, tagRaw, dataRaw] = empaquetado.split(".");
  if (version !== VERSION || !ivRaw || !tagRaw || !dataRaw) {
    return null;
  }
  if (empaquetado.split(".").length !== 4) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      clave(secreto),
      Buffer.from(ivRaw, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
