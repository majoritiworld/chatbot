import "server-only";

import { z } from "zod";
import { siteUrl } from "@/lib/consultoria/auth";
import {
  type EventoGoogleListo,
  eventoGoogleListo,
  urlAutorizacionGoogle,
} from "@/lib/consultoria/google-evento";
import { empaquetarEstadoOAuth } from "@/lib/consultoria/oauth-estado";
import {
  cifrarSecreto,
  descifrarSecreto,
} from "@/lib/consultoria/token-cifrado";
import { createAdminClient } from "@/lib/supabase/admin";

const MARGEN_MS = 60_000;
const ESTADO_MS = 10 * 60 * 1000;
const VENTANA_MS = 60 * 24 * 60 * 60 * 1000;
const HOLGURA_MS = 12 * 60 * 60 * 1000;
const FETCH_MS = 8000;

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token: z.string().min(1).optional(),
});

const perfilSchema = z.object({
  email: z.string().email(),
});

const eventoItemSchema = z.object({
  attendees: z
    .array(
      z.object({
        displayName: z.string().optional(),
        email: z.string().optional(),
        self: z.boolean().optional(),
      })
    )
    .optional(),
  id: z.string().optional(),
  recurringEventId: z.string().optional(),
  start: z
    .object({
      date: z.string().optional(),
      dateTime: z.string().optional(),
    })
    .optional(),
  status: z.string().optional(),
  summary: z.string().optional(),
});

const listaSchema = z.object({
  items: z.array(eventoItemSchema).optional(),
});

type Conexion = {
  access_token: string | null;
  email: string;
  expires_at: string | null;
  refresh_token: string;
  usuario_id: string;
};

export type CalendarioAdmin = {
  aviso: string | null;
  conectado: boolean;
  configurado: boolean;
  email: string | null;
  eventos: EventoGoogleListo[];
};

export function googleConfigurado() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

function credenciales() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!(clientId && clientSecret)) {
    return null;
  }
  return { clientId, clientSecret };
}

function secretoApp() {
  return process.env.AUTH_SECRET ?? "";
}

export function redirectCalendario() {
  return `${siteUrl()}/api/google/calendar/callback`;
}

export function enlaceAutorizacion(input: {
  proyectoId: string;
  usuarioId: string;
}) {
  const claves = credenciales();
  const secreto = secretoApp();
  if (!(claves && secreto)) {
    return null;
  }

  const state = empaquetarEstadoOAuth(
    {
      expira: Date.now() + ESTADO_MS,
      proyectoId: input.proyectoId,
      usuarioId: input.usuarioId,
    },
    secreto
  );

  return urlAutorizacionGoogle({
    clientId: claves.clientId,
    redirectUri: redirectCalendario(),
    state,
  });
}

async function pedirToken(cuerpo: URLSearchParams) {
  const respuesta = await fetch("https://oauth2.googleapis.com/token", {
    body: cuerpo,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!respuesta.ok) {
    return null;
  }
  const parsed = tokenSchema.safeParse(await respuesta.json());
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export async function guardarCodigoGoogle(input: {
  code: string;
  usuarioId: string;
}) {
  const claves = credenciales();
  const secreto = secretoApp();
  const admin = createAdminClient();
  if (!(claves && secreto && admin)) {
    return { codigo: "config" as const, ok: false as const };
  }

  const token = await pedirToken(
    new URLSearchParams({
      client_id: claves.clientId,
      client_secret: claves.clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: redirectCalendario(),
    })
  );
  if (!token?.refresh_token) {
    return { codigo: "token" as const, ok: false as const };
  }

  const perfilRespuesta = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(FETCH_MS),
    }
  );
  const perfil = perfilSchema.safeParse(
    perfilRespuesta.ok ? await perfilRespuesta.json() : null
  );
  if (!perfil.success) {
    return { codigo: "cuenta" as const, ok: false as const };
  }

  const { error } = await admin.from("calendario_google").upsert({
    access_token: cifrarSecreto(token.access_token, secreto),
    email: perfil.data.email,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    refresh_token: cifrarSecreto(token.refresh_token, secreto),
    updated_at: new Date().toISOString(),
    usuario_id: input.usuarioId,
  });

  if (error) {
    return { codigo: "guardar" as const, ok: false as const };
  }
  return { ok: true as const };
}

async function leerConexion(usuarioId: string) {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }
  const { data, error } = await admin
    .from("calendario_google")
    .select("usuario_id, email, refresh_token, access_token, expires_at")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as Conexion;
}

async function accessTokenDe(conexion: Conexion) {
  const secreto = secretoApp();
  const claves = credenciales();
  const admin = createAdminClient();
  if (!(secreto && claves && admin)) {
    return null;
  }

  const vigente =
    conexion.access_token &&
    conexion.expires_at &&
    new Date(conexion.expires_at).getTime() > Date.now() + MARGEN_MS;
  if (vigente && conexion.access_token) {
    const plano = descifrarSecreto(conexion.access_token, secreto);
    if (plano) {
      return plano;
    }
  }

  const refresh = descifrarSecreto(conexion.refresh_token, secreto);
  if (!refresh) {
    return null;
  }

  const token = await pedirToken(
    new URLSearchParams({
      client_id: claves.clientId,
      client_secret: claves.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refresh,
    })
  );
  if (!token) {
    return null;
  }

  await admin
    .from("calendario_google")
    .update({
      access_token: cifrarSecreto(token.access_token, secreto),
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      refresh_token: token.refresh_token
        ? cifrarSecreto(token.refresh_token, secreto)
        : conexion.refresh_token,
      updated_at: new Date().toISOString(),
    })
    .eq("usuario_id", conexion.usuario_id);

  return token.access_token;
}

async function leerJsonGoogle(url: string, accessToken: string) {
  const respuesta = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!respuesta.ok) {
    return null;
  }
  return respuesta.json();
}

export async function listarEventosGoogle(accessToken: string) {
  const params = new URLSearchParams({
    maxResults: "100",
    orderBy: "startTime",
    singleEvents: "true",
    timeMax: new Date(Date.now() + VENTANA_MS).toISOString(),
    timeMin: new Date(Date.now() - HOLGURA_MS).toISOString(),
  });
  const json = await leerJsonGoogle(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    accessToken
  );
  const parsed = listaSchema.safeParse(json);
  if (!parsed.success) {
    return null;
  }

  const eventos: EventoGoogleListo[] = [];
  for (const item of parsed.data.items ?? []) {
    const listo = eventoGoogleListo(item);
    if (listo) {
      eventos.push(listo);
    }
  }
  return eventos;
}

export async function obtenerEventoGoogle(
  accessToken: string,
  eventId: string
) {
  const json = await leerJsonGoogle(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    accessToken
  );
  const parsed = eventoItemSchema.safeParse(json);
  if (!parsed.success) {
    return null;
  }
  return eventoGoogleListo(parsed.data);
}

export async function cargarCalendarioAdmin(
  usuarioId: string
): Promise<CalendarioAdmin> {
  if (!googleConfigurado()) {
    return {
      aviso: null,
      conectado: false,
      configurado: false,
      email: null,
      eventos: [],
    };
  }

  try {
    const conexion = await leerConexion(usuarioId);
    if (!conexion) {
      return {
        aviso: null,
        conectado: false,
        configurado: true,
        email: null,
        eventos: [],
      };
    }

    const accessToken = await accessTokenDe(conexion);
    if (!accessToken) {
      return {
        aviso:
          "La conexión con Google venció. Vuelve a conectar el calendario.",
        conectado: true,
        configurado: true,
        email: conexion.email,
        eventos: [],
      };
    }

    const eventos = await listarEventosGoogle(accessToken);
    if (!eventos) {
      return {
        aviso: "No pude leer tu Google Calendar.",
        conectado: true,
        configurado: true,
        email: conexion.email,
        eventos: [],
      };
    }

    return {
      aviso: null,
      conectado: true,
      configurado: true,
      email: conexion.email,
      eventos,
    };
  } catch {
    return {
      aviso: "No pude leer tu Google Calendar.",
      conectado: true,
      configurado: true,
      email: null,
      eventos: [],
    };
  }
}

export async function tokenDeCalendario(usuarioId: string) {
  const conexion = await leerConexion(usuarioId);
  if (!conexion) {
    return null;
  }
  return accessTokenDe(conexion);
}

export async function desconectarCalendarioDe(usuarioId: string) {
  const admin = createAdminClient();
  if (!admin) {
    return false;
  }
  const { error } = await admin
    .from("calendario_google")
    .delete()
    .eq("usuario_id", usuarioId);
  return !error;
}
