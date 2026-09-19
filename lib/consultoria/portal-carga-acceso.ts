import {
  parseTranscripcion,
  type TurnoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import { mismoEmail } from "@/lib/consultoria/roles";
import type { Entrevista } from "@/lib/supabase/types";

export type EntrevistaPortalCarga =
  | { acceso: "ausente" }
  | { acceso: "ajena" }
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
 * Transcript JSON is parsed only after ownership. Denied results never carry
 * turns, interview fields, or the raw transcript payload.
 */
export function accesoEntrevistaPortal(
  entrevista: Entrevista | null,
  viewerEmail: string | null,
  transcripcion: unknown
): EntrevistaPortalCarga {
  if (!(viewerEmail && entrevista)) {
    return { acceso: "ausente" };
  }

  if (!mismoEmail(entrevista.stakeholder_email, viewerEmail)) {
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
