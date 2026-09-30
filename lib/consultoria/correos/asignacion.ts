import {
  type FilaTextosCorreo,
  type FilaTextosCorreoFase,
  minutosDeFase,
  resolverTextosCorreo,
  type TextosCorreos,
} from "@/lib/consultoria/comunicacion";
import { origenAutorizado } from "@/lib/consultoria/correos/enlace-acceso";
import type { IdentidadVisual } from "@/lib/consultoria/correos/plantilla";
import { interpretarColor, slugValido } from "@/lib/consultoria/marca";
import { nombreCompleto } from "@/lib/consultoria/nombre";

export type FilaProyectoCorreo = FilaTextosCorreo & {
  cliente?: string | null;
  color_principal?: string | null;
  contacto_email?: string | null;
  contacto_nombre?: string | null;
  id: string;
  logo_path?: string | null;
  nombre_publico?: string | null;
  slug?: string | null;
  titulo_iniciativa?: string | null;
};

export type FilaFaseCorreo = FilaTextosCorreoFase & {
  acceso_enlace_personal?: boolean | null;
  nombre?: string | null;
  proyecto_id?: string | null;
};

export type FilasAsignacionCorreo = {
  entrevistaId: string;
  fase: FilaFaseCorreo | null;
  plantillaProyectoId: string | null;
  proyecto: FilaProyectoCorreo | null;
  stakeholder: {
    apellido?: string | null;
    email?: string | null;
    nombre?: string | null;
    proyecto_id?: string | null;
  } | null;
};

export type IdentidadCorreo = IdentidadVisual & {
  contactoEmail: string;
  contactoNombre: string | null;
  titulo: string | null;
};

export type AsignacionCorreo = {
  /** The phase invites with a personal link instead of email + code. */
  accesoEnlacePersonal: boolean;
  destinatario: {
    email: string;
    nombre: string | null;
    nombreCompleto: string;
  };
  entrevistaId: string;
  faseNombre: string | null;
  identidad: IdentidadCorreo;
  minutos: number | null;
  proyectoId: string;
  slug: string | null;
  textos: TextosCorreos;
};

export type MotivoBloqueoCorreo =
  | "asignacion_inconsistente"
  | "destinatario_distinto"
  | "sin_cliente"
  | "sin_contacto"
  | "sin_destinatario"
  | "sin_entrevista";

export type ResultadoAsignacionCorreo =
  | { asignacion: AsignacionCorreo; ok: true }
  | { motivo: MotivoBloqueoCorreo; ok: false };

const EMAIL_RE = /^[^\s@<>",;:()[\]\\]+@[^\s@<>",;:()[\]\\]+\.[a-z]{2,}$/i;

export function emailValido(value: string | null | undefined) {
  const email = value?.trim().toLowerCase() ?? "";
  return EMAIL_RE.test(email) ? email : null;
}

function texto(value: string | null | undefined) {
  const limpio = value?.trim() ?? "";
  return limpio.length > 0 ? limpio : null;
}

export const MENSAJES_BLOQUEO: Record<MotivoBloqueoCorreo, string> = {
  asignacion_inconsistente:
    "La entrevista, su fase y su proyecto no coinciden. No se envió el correo.",
  destinatario_distinto:
    "El destinatario no coincide con la persona asignada. No se envió el correo.",
  sin_cliente:
    "Falta el nombre público o el cliente del proyecto. No se envió el correo.",
  sin_contacto:
    "Falta un correo de contacto válido del cliente para las respuestas. No se envió el correo.",
  sin_destinatario:
    "La persona asignada no tiene un correo válido. No se envió el correo.",
  sin_entrevista: "No encontramos la entrevista. No se envió el correo.",
};

/**
 * Recipient, client identity and copy of one assignment. Every piece must
 * point to the same project; otherwise nothing is sent.
 */
export function evaluarAsignacionCorreo(
  filas: FilasAsignacionCorreo,
  {
    emailEsperado,
    permitirLocal,
    site,
  }: { emailEsperado?: string | null; permitirLocal: boolean; site: string }
): ResultadoAsignacionCorreo {
  const { fase, proyecto, stakeholder } = filas;
  if (!stakeholder) {
    return { motivo: "sin_entrevista", ok: false };
  }
  const email = emailValido(stakeholder.email);
  if (!email) {
    return { motivo: "sin_destinatario", ok: false };
  }
  if (emailEsperado !== undefined && emailValido(emailEsperado) !== email) {
    return { motivo: "destinatario_distinto", ok: false };
  }

  const proyectoId = stakeholder.proyecto_id ?? null;
  const coincide =
    proyectoId &&
    proyecto?.id === proyectoId &&
    (filas.plantillaProyectoId === null ||
      filas.plantillaProyectoId === proyectoId) &&
    (fase === null || fase.proyecto_id === proyectoId);
  if (!(coincide && proyecto)) {
    return { motivo: "asignacion_inconsistente", ok: false };
  }

  const cliente = texto(proyecto.nombre_publico) ?? texto(proyecto.cliente);
  if (!cliente) {
    return { motivo: "sin_cliente", ok: false };
  }
  const contactoEmail = emailValido(proyecto.contacto_email);
  if (!contactoEmail) {
    return { motivo: "sin_contacto", ok: false };
  }

  const slug = slugValido(proyecto.slug);
  const origen = origenAutorizado(site, permitirLocal);
  const color = interpretarColor(proyecto.color_principal ?? "");

  return {
    asignacion: {
      accesoEnlacePersonal: fase?.acceso_enlace_personal === true,
      destinatario: {
        email,
        nombre: texto(stakeholder.nombre),
        nombreCompleto: nombreCompleto(
          stakeholder.nombre,
          stakeholder.apellido
        ),
      },
      entrevistaId: filas.entrevistaId,
      faseNombre: texto(fase?.nombre),
      identidad: {
        cliente,
        color: color.ok ? color.color : null,
        contactoEmail,
        contactoNombre: texto(proyecto.contacto_nombre),
        logoUrl:
          origen && slug && proyecto.logo_path
            ? `${origen}/marca/${slug}/logo`
            : null,
        titulo: texto(proyecto.titulo_iniciativa),
      },
      minutos: minutosDeFase(fase?.minutos),
      proyectoId,
      slug,
      textos: resolverTextosCorreo(proyecto, fase),
    },
    ok: true,
  };
}
