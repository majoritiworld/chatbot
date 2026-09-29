import { isClienteRole, mismoEmail } from "@/lib/consultoria/roles";

export type MembresiaProyecto = {
  email: string;
  proyectoId: string;
};

export type DecisionEntrada = "permitido" | "sin_acceso" | "sesion_ajena";

/**
 * The link's project is the only one that counts. Another membership, or a
 * session opened for someone else, does not enter.
 */
export function decidirEntradaProyecto({
  email,
  membresias,
  proyectoId,
  sesionEmail,
}: {
  email: string;
  membresias: MembresiaProyecto[];
  proyectoId: string;
  sesionEmail?: string | null;
}): DecisionEntrada {
  if (sesionEmail && !mismoEmail(sesionEmail, email)) {
    return "sesion_ajena";
  }

  const enEsteProyecto = membresias.some(
    (item) => mismoEmail(item.email, email) && item.proyectoId === proyectoId
  );
  return enEsteProyecto ? "permitido" : "sin_acceso";
}

/** Read or write only the interview of a project this email belongs to. */
export function operacionEntrevistaPermitida({
  emailSesion,
  emailStakeholder,
  membresias,
  proyectoId,
}: {
  emailSesion: string | null | undefined;
  emailStakeholder: string | null | undefined;
  membresias: { proyectoId: string }[];
  proyectoId: string | null | undefined;
}) {
  if (!(emailSesion && emailStakeholder && proyectoId)) {
    return false;
  }
  if (!mismoEmail(emailSesion, emailStakeholder)) {
    return false;
  }
  return membresias.some((item) => item.proyectoId === proyectoId);
}

/**
 * Legacy /login without a project link. One membership keeps the previous
 * destination. Several memberships must not pick a project on their own.
 */
/**
 * Phase portal links stay on the account's home project. A client sees them
 * only while the interview belongs to that same project. Stakeholders, and a
 * client answering in another project, keep the interview without a phases link.
 */
export function mostrarPortalFases({
  proyectoEntrevistaId,
  proyectoOrigenId,
  rol,
}: {
  proyectoEntrevistaId?: string | null;
  proyectoOrigenId?: string | null;
  rol: string | null | undefined;
}) {
  if (!isClienteRole(rol)) {
    return false;
  }
  if (!(proyectoOrigenId && proyectoEntrevistaId)) {
    return false;
  }
  return proyectoOrigenId === proyectoEntrevistaId;
}

export function proyectoUnicoLegacy(proyectoIds: string[]) {
  const unicos = [...new Set(proyectoIds)];
  if (unicos.length === 1) {
    return unicos.at(0) ?? null;
  }
  return null;
}
