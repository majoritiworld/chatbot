const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TLD_SIN_BUZON = new Set(["example", "invalid", "localhost", "test"]);
const DOMINIO_SIN_BUZON = new Set([
  "example.com",
  "example.net",
  "example.org",
]);

export type CuentaPrueba = {
  email: string;
  id: string;
};

export type CuentasPruebaStaging = {
  majoriti: CuentaPrueba;
  other: CuentaPrueba;
  participant: CuentaPrueba;
};

export function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

export function esUuid(value: string) {
  return UUID_RE.test(value.trim());
}

export function parseLista(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function dominioSinBuzon(email: string) {
  const domain = normalizarEmail(email).split("@").at(1) ?? "";
  const tld = domain.split(".").at(-1) ?? "";
  return DOMINIO_SIN_BUZON.has(domain) || TLD_SIN_BUZON.has(tld);
}

export function exigirListaAutorizada({
  allowedEmails,
  allowedIds,
  cuentas,
}: {
  allowedEmails: string[];
  allowedIds: string[];
  cuentas: CuentasPruebaStaging;
}) {
  const emails = [
    normalizarEmail(cuentas.participant.email),
    normalizarEmail(cuentas.other.email),
    normalizarEmail(cuentas.majoriti.email),
  ];
  const ids = [
    cuentas.participant.id.trim().toLowerCase(),
    cuentas.other.id.trim().toLowerCase(),
    cuentas.majoriti.id.trim().toLowerCase(),
  ];
  const allowEmails = new Set(allowedEmails.map(normalizarEmail));
  const allowIds = new Set(allowedIds.map((id) => id.trim().toLowerCase()));

  if (allowEmails.size !== 3 || allowIds.size !== 3) {
    throw new Error(
      "STAGING_ALLOWED_EMAILS y STAGING_ALLOWED_IDS deben listar exactamente tres cuentas de prueba exclusivas."
    );
  }
  if (new Set(emails).size !== 3 || new Set(ids).size !== 3) {
    throw new Error(
      "Las tres cuentas de prueba deben tener correos y UUID distintos."
    );
  }
  for (const email of emails) {
    if (!email.includes("@") || dominioSinBuzon(email)) {
      throw new Error(
        "Usa buzones reales que tú controles. No uses dominios de prueba sin entrega de correo ni cuentas de clientes."
      );
    }
    if (!allowEmails.has(email)) {
      throw new Error(
        "Hay un correo fuera de STAGING_ALLOWED_EMAILS. No uses cuentas de clientes."
      );
    }
  }
  for (const id of ids) {
    if (!esUuid(id)) {
      throw new Error("Cada cuenta de prueba necesita un UUID válido.");
    }
    if (!allowIds.has(id)) {
      throw new Error(
        "Hay un UUID fuera de STAGING_ALLOWED_IDS. No uses cuentas de clientes."
      );
    }
  }
}

export function exigirCuentasDePrueba(cuentas: CuentasPruebaStaging) {
  exigirListaAutorizada({
    allowedEmails: [
      cuentas.participant.email,
      cuentas.other.email,
      cuentas.majoriti.email,
    ],
    allowedIds: [cuentas.participant.id, cuentas.other.id, cuentas.majoriti.id],
    cuentas,
  });
}

export function sesionAutorizada(
  user: { email?: string | null; id?: string | null },
  expected: CuentaPrueba
) {
  return (
    (user.id ?? "").trim().toLowerCase() === expected.id.trim().toLowerCase() &&
    normalizarEmail(user.email ?? "") === normalizarEmail(expected.email)
  );
}

export function claimsDeAccessToken(token: string) {
  const payload = token.split(".").at(1);
  if (!payload) {
    throw new Error("El access token de staging no es un JWT.");
  }
  const json = Buffer.from(payload, "base64url").toString("utf8");
  const claims = JSON.parse(json) as {
    email?: unknown;
    sub?: unknown;
  };
  if (typeof claims.sub !== "string" || typeof claims.email !== "string") {
    throw new Error("El access token de staging no trae sub y email.");
  }
  return { email: claims.email, id: claims.sub };
}

export function extraerAccessToken(value: unknown, depth = 0): string | null {
  if (depth > 8 || value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("base64-")) {
      try {
        const decoded = Buffer.from(
          trimmed.slice("base64-".length),
          "base64"
        ).toString("utf8");
        return extraerAccessToken(JSON.parse(decoded), depth + 1);
      } catch {
        return null;
      }
    }
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return extraerAccessToken(JSON.parse(trimmed), depth + 1);
      } catch {
        return null;
      }
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extraerAccessToken(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (typeof value === "object") {
    if ("access_token" in value && typeof value.access_token === "string") {
      return value.access_token;
    }
    for (const nested of Object.values(value)) {
      const found = extraerAccessToken(nested, depth + 1);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export async function leerUsuarioDeSesion({
  anonKey,
  supabaseUrl,
  token,
}: {
  anonKey: string;
  supabaseUrl: string;
  token: string;
}) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
  });
  if (!response.ok) {
    throw new Error(
      `No se pudo validar la sesión de prueba (${response.status}).`
    );
  }
  const user = (await response.json()) as {
    email?: string | null;
    id?: string | null;
  };
  return { email: user.email ?? "", id: user.id ?? "" };
}

export async function exigirSesionAutorizada({
  anonKey,
  expected,
  supabaseUrl,
  token,
}: {
  anonKey: string;
  expected: CuentaPrueba;
  supabaseUrl: string;
  token: string;
}) {
  const claims = claimsDeAccessToken(token);
  if (!sesionAutorizada(claims, expected)) {
    throw new Error(
      "El access token no corresponde al UUID y correo autorizados. No se escribe nada."
    );
  }
  const user = await leerUsuarioDeSesion({ anonKey, supabaseUrl, token });
  if (!sesionAutorizada(user, expected)) {
    throw new Error(
      "La sesión de Auth no corresponde al UUID y correo autorizados. No se escribe nada."
    );
  }
}

export function cuentasDesdeEntorno() {
  const cuentas = {
    majoriti: {
      email: process.env.STAGING_MAJORITI_EMAIL ?? "",
      id: process.env.STAGING_MAJORITI_ID ?? "",
    },
    other: {
      email: process.env.STAGING_OTHER_EMAIL ?? "",
      id: process.env.STAGING_OTHER_ID ?? "",
    },
    participant: {
      email: process.env.STAGING_PARTICIPANT_EMAIL ?? "",
      id: process.env.STAGING_PARTICIPANT_ID ?? "",
    },
  };
  const allowedEmails = parseLista(process.env.STAGING_ALLOWED_EMAILS ?? "");
  const allowedIds = parseLista(process.env.STAGING_ALLOWED_IDS ?? "");
  exigirListaAutorizada({ allowedEmails, allowedIds, cuentas });
  return cuentas;
}
