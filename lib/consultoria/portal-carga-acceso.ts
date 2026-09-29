import {
  parseTranscripcion,
  type TurnoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import { mismoEmail } from "@/lib/consultoria/roles";
import type { Entrevista } from "@/lib/supabase/types";

export type RespuestaConsulta = {
  en: string;
  pregunta: string;
  texto: string;
};

export type EntrevistaPortalCarga =
  | { acceso: "ausente" }
  | { acceso: "ajena" }
  | {
      acceso: "lectura";
      entrevista: Entrevista;
      respuestas: RespuestaConsulta[];
      turnos: TurnoEntrevista[];
    }
  | { acceso: "propia"; entrevista: Entrevista; turnos: TurnoEntrevista[] };

export type FasePortalVista = {
  entrevistas: { id: string; puedeResponder: boolean }[];
  estado: string;
  nombre: string;
};

export type VistaFasePortal =
  | { tipo: "ausente" }
  | {
      clave: "bloqueada" | "sin-respondible" | "sin-entrevista";
      nombre: string;
      tipo: "aviso";
    }
  | {
      entrevista: Entrevista;
      nombre: string;
      tipo: "chat";
      turnos: TurnoEntrevista[];
    };

export type EntrevistaPropiaCarga = {
  entrevista: Entrevista;
  turnos: TurnoEntrevista[];
};

export function coincideFaseYViewer({
  faseProyectoId,
  proyectoId,
  stakeholderEmail,
  viewerEmail,
}: {
  faseProyectoId: string | null | undefined;
  proyectoId: string;
  stakeholderEmail: string | null | undefined;
  viewerEmail: string | null;
}) {
  return (
    faseProyectoId === proyectoId && mismoEmail(stakeholderEmail, viewerEmail)
  );
}

/**
 * Transcript JSON is parsed only for the owner, or for a same-project client
 * who may read and not answer. Every other denial stays empty.
 */
export function accesoEntrevistaPortal(
  entrevista: Entrevista | null,
  viewerEmail: string | null,
  transcripcion: unknown,
  opciones?: { consultaCliente?: boolean }
): EntrevistaPortalCarga {
  if (!(viewerEmail && entrevista)) {
    return { acceso: "ausente" };
  }

  if (!mismoEmail(entrevista.stakeholder_email, viewerEmail)) {
    if (opciones?.consultaCliente) {
      return {
        acceso: "lectura",
        entrevista,
        respuestas: [],
        turnos: parseTranscripcion(transcripcion),
      };
    }
    return { acceso: "ajena" };
  }

  return {
    acceso: "propia",
    entrevista,
    turnos: parseTranscripcion(transcripcion),
  };
}

export function resolverVistaFasePortal(
  fase: FasePortalVista | null,
  propia: EntrevistaPropiaCarga | null
): VistaFasePortal {
  if (!fase) {
    return { tipo: "ausente" };
  }

  if (fase.estado === "bloqueado") {
    return { clave: "bloqueada", nombre: fase.nombre, tipo: "aviso" };
  }

  const respondible = fase.entrevistas.find((item) => item.puedeResponder);
  if (!respondible) {
    return { clave: "sin-respondible", nombre: fase.nombre, tipo: "aviso" };
  }

  if (!propia || propia.entrevista.id !== respondible.id) {
    return { clave: "sin-entrevista", nombre: fase.nombre, tipo: "aviso" };
  }

  return {
    entrevista: propia.entrevista,
    nombre: fase.nombre,
    tipo: "chat",
    turnos: propia.turnos,
  };
}
