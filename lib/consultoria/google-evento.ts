const FECHA_ISO = /^(\d{4}-\d{2}-\d{2})/;
const HORA = /T(\d{2}:\d{2})/;

export type InicioGoogle = {
  date?: string;
  dateTime?: string;
};

export type AsistenteGoogle = {
  displayName?: string;
  email?: string;
  self?: boolean;
};

export type EventoGoogleCrudo = {
  attendees?: AsistenteGoogle[];
  id?: string;
  recurringEventId?: string;
  start?: InicioGoogle;
  status?: string;
  summary?: string;
};

export type EventoGoogleListo = {
  fecha: string;
  hora: string | null;
  id: string;
  participantes: string[];
  serieId: string | null;
  titulo: string;
};

export function fechaYHoraGoogle(start: InicioGoogle | undefined) {
  if (start?.date && FECHA_ISO.test(start.date)) {
    return { fecha: start.date.slice(0, 10), hora: null };
  }

  if (!start?.dateTime) {
    return null;
  }

  const fecha = FECHA_ISO.exec(start.dateTime)?.[1];
  if (!fecha) {
    return null;
  }

  return { fecha, hora: HORA.exec(start.dateTime)?.[1] ?? null };
}

export function participantesGoogle(attendees: AsistenteGoogle[] | undefined) {
  const vistos = new Set<string>();
  const nombres: string[] = [];

  for (const persona of attendees ?? []) {
    if (persona.self) {
      continue;
    }
    const nombre = persona.displayName?.trim() || persona.email?.trim() || "";
    if (!nombre || vistos.has(nombre)) {
      continue;
    }
    vistos.add(nombre);
    nombres.push(nombre);
  }

  return nombres;
}

export function eventoGoogleListo(
  raw: EventoGoogleCrudo
): EventoGoogleListo | null {
  if (!raw.id || raw.status === "cancelled") {
    return null;
  }

  const cuando = fechaYHoraGoogle(raw.start);
  if (!cuando) {
    return null;
  }

  const titulo = raw.summary?.trim() || "(Sin título)";
  return {
    fecha: cuando.fecha,
    hora: cuando.hora,
    id: raw.id,
    participantes: participantesGoogle(raw.attendees),
    serieId: raw.recurringEventId ?? null,
    titulo,
  };
}

export function avisoCalendario(codigo: string | undefined) {
  switch (codigo) {
    case "ok":
      return "Google Calendar conectado.";
    case "denegado":
      return "No se autorizó el acceso al calendario.";
    case "estado":
      return "La conexión venció. Vuelve a intentarlo.";
    case "token":
      return "Google no devolvió un permiso duradero. Vuelve a conectar.";
    case "config":
      return "Falta la configuración de Google Calendar.";
    case "cuenta":
      return "No pude leer la cuenta de Google.";
    case "guardar":
      return "No pude guardar la conexión con Google.";
    default:
      return null;
  }
}

export function urlAutorizacionGoogle(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const params = new URLSearchParams({
    access_type: "offline",
    client_id: input.clientId,
    prompt: "consent",
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/calendar.readonly",
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
