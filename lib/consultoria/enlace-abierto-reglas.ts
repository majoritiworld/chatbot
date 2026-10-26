import { z } from "zod";

/** New interviews one open link may create in 24 hours. */
export const LIMITE_DIARIO_ENLACE_ABIERTO = 200;

export const MENSAJE_ENLACE_ABIERTO_NO_DISPONIBLE =
  "Este enlace ya no está disponible.";

export const MENSAJE_ENLACE_ABIERTO_LIMITE =
  "En este momento no podemos abrir más entrevistas. Inténtelo de nuevo más tarde.";

export const MENSAJE_ENLACE_ABIERTO_ERROR =
  "No pudimos preparar la entrevista. Inténtelo de nuevo.";

const texto = (maximo: number, mensaje: string) =>
  z
    .string()
    .trim()
    .min(1, mensaje)
    .max(maximo, `Use como máximo ${maximo} caracteres.`);

export const datosEnlaceAbiertoSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Escriba un correo electrónico válido.").max(254)),
  empresa: texto(160, "Escriba el nombre de su empresa."),
  nombre: texto(120, "Escriba su nombre."),
});

export type DatosEnlaceAbierto = z.infer<typeof datosEnlaceAbiertoSchema>;

export type ValidacionEnlaceAbierto =
  | { ok: true; datos: DatosEnlaceAbierto }
  | { ok: false; errores: Partial<Record<keyof DatosEnlaceAbierto, string>> }
  | { ok: false; trampa: true };

/** `sitio` is a hidden field: people leave it empty, form bots fill it in. */
export function validarDatosEnlaceAbierto(entrada: {
  email: unknown;
  empresa: unknown;
  nombre: unknown;
  sitio: unknown;
}): ValidacionEnlaceAbierto {
  if (typeof entrada.sitio === "string" && entrada.sitio.trim().length > 0) {
    return { ok: false, trampa: true };
  }
  const parsed = datosEnlaceAbiertoSchema.safeParse({
    email: typeof entrada.email === "string" ? entrada.email : "",
    empresa: typeof entrada.empresa === "string" ? entrada.empresa : "",
    nombre: typeof entrada.nombre === "string" ? entrada.nombre : "",
  });
  if (parsed.success) {
    return { datos: parsed.data, ok: true };
  }
  const errores: Partial<Record<keyof DatosEnlaceAbierto, string>> = {};
  for (const issue of parsed.error.issues) {
    const campo = issue.path[0] as keyof DatosEnlaceAbierto;
    errores[campo] ??= issue.message;
  }
  return { errores, ok: false };
}

/**
 * The template's sections, raw, with a new id each. Fields this build does not
 * parse are kept, so a later build still finds them on the interview.
 */
export function seccionesParaNuevaEntrevista(
  secciones: unknown,
  nuevoId: () => string
): Record<string, unknown>[] {
  if (!Array.isArray(secciones)) {
    return [];
  }
  return secciones.flatMap((seccion) =>
    typeof seccion === "object" && seccion !== null
      ? [{ ...(seccion as Record<string, unknown>), id: nuevoId() }]
      : []
  );
}
