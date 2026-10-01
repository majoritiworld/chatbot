import { claveNotion } from "@/lib/consultoria/notion-transcripcion-contenido";

/** Existing Projects row. Title in Notion: «Consultoria ETM». */
export const PAGINA_PROYECTO_NOTION_ETM =
  "3e531b45-3629-8009-9e8b-f7eaa307501d";

/** Existing Projects row for ComplianceLatam. ETM transcripts must not use it. */
export const PAGINA_PROYECTO_NOTION_COMPLIANCE_LATAM =
  "3d631b45-3629-8087-a003-c4f9482d47ee";

/**
 * Inline database «ETM Interviews» on the Consultoria ETM page.
 * Not the shared Interviews database used by ComplianceLatam.
 */
export const BASE_TRANSCRIPCIONES_ETM = "3e531b45-3629-80bb-a84b-000b4f1d5381";

export function esProyectoEtm(proyecto: {
  cliente?: string | null;
  nombre?: string | null;
  slug?: string | null;
}) {
  if (proyecto.slug?.trim().toLowerCase() === "etm-tuesday") {
    return true;
  }
  const cliente = claveNotion(proyecto.cliente ?? "");
  if (cliente === "emprendetumente") {
    return true;
  }
  const nombre = claveNotion(proyecto.nombre ?? "");
  return (
    nombre.includes("etmtuesday") ||
    nombre === "consultoriaetm" ||
    nombre === "emprendetumente"
  );
}

/** Local demo rows. They must not be created in the real Notion workspace. */
export function esConversacionFicticiaEtm(datos: {
  email?: string | null;
  proyectoNombre?: string | null;
}) {
  const email = datos.email?.trim().toLowerCase() ?? "";
  if (email.endsWith("@example.test")) {
    return true;
  }
  return claveNotion(datos.proyectoNombre ?? "").includes("demolocal");
}

export function segmentoNotionEtm(fase: string | null | undefined) {
  const clave = claveNotion(fase ?? "");
  if (clave.includes("mentoread")) {
    return "Mentoreado" as const;
  }
  if (clave.includes("mentor")) {
    return "Mentor" as const;
  }
  if (clave.includes("sponsor")) {
    return "Sponsor" as const;
  }
  return null;
}
