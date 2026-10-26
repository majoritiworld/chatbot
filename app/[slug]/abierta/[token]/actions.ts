"use server";

import { redirect } from "next/navigation";
import {
  abrirEntrevistaDeEnlaceAbierto,
  rechazoEnlaceAbierto,
} from "@/lib/consultoria/acceso-entrevista";
import {
  crearEntrevistaDeEnlaceAbierto,
  faseDeEnlaceAbierto,
} from "@/lib/consultoria/enlace-abierto";
import {
  type DatosEnlaceAbierto,
  MENSAJE_ENLACE_ABIERTO_ERROR,
  MENSAJE_ENLACE_ABIERTO_LIMITE,
  MENSAJE_ENLACE_ABIERTO_NO_DISPONIBLE,
  validarDatosEnlaceAbierto,
} from "@/lib/consultoria/enlace-abierto-reglas";
import { MENSAJE_SESION_AJENA } from "@/lib/consultoria/sesion-entrevista";

export type EnlaceAbiertoState = {
  errores?: Partial<Record<keyof DatosEnlaceAbierto, string>>;
  mensaje?: string;
  sesionAjena?: true;
  valores?: Partial<DatosEnlaceAbierto>;
};

function valor(formData: FormData, campo: string) {
  const crudo = formData.get(campo);
  return typeof crudo === "string" ? crudo : "";
}

export async function empezarEntrevistaAbierta(
  _prev: EnlaceAbiertoState,
  formData: FormData
): Promise<EnlaceAbiertoState> {
  const valores = {
    email: valor(formData, "email"),
    empresa: valor(formData, "empresa"),
    nombre: valor(formData, "nombre"),
  };
  const validacion = validarDatosEnlaceAbierto({
    ...valores,
    sitio: valor(formData, "sitio"),
  });
  if (!validacion.ok) {
    return "trampa" in validacion
      ? { mensaje: MENSAJE_ENLACE_ABIERTO_ERROR }
      : { errores: validacion.errores, valores };
  }
  const { datos } = validacion;

  const fase = await faseDeEnlaceAbierto(
    valor(formData, "proyecto"),
    valor(formData, "enlace")
  );
  if (!fase) {
    return { mensaje: MENSAJE_ENLACE_ABIERTO_NO_DISPONIBLE, valores };
  }

  const rechazo = await rechazoEnlaceAbierto(datos.email);
  if (rechazo) {
    return {
      mensaje: rechazo,
      valores,
      ...(rechazo === MENSAJE_SESION_AJENA
        ? { sesionAjena: true as const }
        : {}),
    };
  }

  const creada = await crearEntrevistaDeEnlaceAbierto(fase, datos);
  if (!creada.ok) {
    return {
      mensaje:
        creada.motivo === "limite"
          ? MENSAJE_ENLACE_ABIERTO_LIMITE
          : MENSAJE_ENLACE_ABIERTO_ERROR,
      valores,
    };
  }

  const abierta = await abrirEntrevistaDeEnlaceAbierto({
    email: datos.email,
    entrevistaId: creada.entrevistaId,
  });
  if (!abierta) {
    return { mensaje: MENSAJE_ENLACE_ABIERTO_ERROR, valores };
  }

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  redirect(`${base}/portal/entrevista/${creada.entrevistaId}`);
}
