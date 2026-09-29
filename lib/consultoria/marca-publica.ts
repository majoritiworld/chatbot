import "server-only";

import { normalizarEmail } from "@/lib/consultoria/auth";
import {
  type FilaComunicacion,
  type FilaComunicacionFase,
  minutosDeFase,
  resolverComunicacion,
  textosVacios,
} from "@/lib/consultoria/comunicacion";
import {
  type MarcaPublica,
  marcaPredeterminada,
  presentacionPublica,
  slugValido,
} from "@/lib/consultoria/marca";
import { createAdminClient } from "@/lib/supabase/admin";

/** Columns a public page may receive. Never stakeholders or transcripts. */
const COLUMNAS_MARCA =
  "aviso_respuestas, cliente, color_principal, contacto_email, contacto_nombre, correo_asunto, correo_cuerpo, correo_firma, correo_remitente, logo_path, nombre_publico, slug, texto_bienvenida, titulo_iniciativa";

const COLUMNAS_FASE_COMUNICACION =
  "aviso_respuestas, bloque_comercial, bloque_comercial_etiqueta, bloque_comercial_url, correo_asunto, correo_cuerpo, correo_firma, correo_remitente, minutos, texto_bienvenida, proyecto:proyecto_id(aviso_respuestas, correo_asunto, correo_cuerpo, correo_firma, correo_remitente, texto_bienvenida)";

export type MarcaDeProyecto = {
  marca: MarcaPublica;
  proyectoId: string;
};

export async function marcaPorSlug(
  slugCrudo: string
): Promise<MarcaDeProyecto | null> {
  const slug = slugValido(slugCrudo);
  const admin = createAdminClient();
  if (!(slug && admin)) {
    return null;
  }

  const { data } = await admin
    .from("proyecto")
    .select(`id, ${COLUMNAS_MARCA}`)
    .eq("slug", slug)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    marca: presentacionPublica(data),
    proyectoId: data.id,
  };
}

export async function marcaPorProyectoId(
  proyectoId: string | null | undefined
): Promise<MarcaPublica> {
  const admin = createAdminClient();
  if (!(proyectoId && admin)) {
    return marcaPredeterminada();
  }

  const { data } = await admin
    .from("proyecto")
    .select(COLUMNAS_MARCA)
    .eq("id", proyectoId)
    .maybeSingle();

  if (!data) {
    return marcaPredeterminada();
  }

  return presentacionPublica(data);
}

function primerObjeto<T>(valor: T | T[] | null | undefined) {
  if (Array.isArray(valor)) {
    return valor.at(0) ?? null;
  }
  return valor ?? null;
}

export async function comunicacionDeEntrevista(entrevistaId: string) {
  const admin = createAdminClient();
  if (!admin) {
    return { minutos: null, textos: textosVacios() };
  }

  const { data } = await admin
    .from("entrevista")
    .select(
      `plantilla:plantilla_id(fase:fase_id(${COLUMNAS_FASE_COMUNICACION}))`
    )
    .eq("id", entrevistaId)
    .maybeSingle();

  const plantilla = primerObjeto(
    data?.plantilla as
      | {
          fase?:
            | (FilaComunicacionFase & {
                proyecto?: FilaComunicacion | FilaComunicacion[] | null;
              })
            | Array<
                FilaComunicacionFase & {
                  proyecto?: FilaComunicacion | FilaComunicacion[] | null;
                }
              >
            | null;
        }
      | Array<{
          fase?:
            | (FilaComunicacionFase & {
                proyecto?: FilaComunicacion | FilaComunicacion[] | null;
              })
            | null;
        }>
      | null
  );
  const fase = primerObjeto(plantilla?.fase);
  const proyecto = primerObjeto(fase?.proyecto);

  return {
    minutos: minutosDeFase(fase?.minutos),
    textos: resolverComunicacion(proyecto, fase),
  };
}

export function marcaConTextos(
  marca: MarcaPublica,
  textos: {
    avisoRespuestas: string | null;
    textoBienvenida: string | null;
  }
): MarcaPublica {
  return {
    ...marca,
    avisoRespuestas: textos.avisoRespuestas ?? marca.avisoRespuestas,
    textoBienvenida: textos.textoBienvenida ?? marca.textoBienvenida,
  };
}

export async function proyectoIdDeSlug(slugCrudo: string | null | undefined) {
  const encontrada = slugCrudo ? await marcaPorSlug(slugCrudo) : null;
  return encontrada?.proyectoId ?? null;
}

export async function proyectoIdDeEntrevista(entrevistaId: string) {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }

  const { data } = await admin
    .from("entrevista")
    .select("stakeholder:stakeholder_id ( proyecto_id )")
    .eq("id", entrevistaId)
    .maybeSingle();

  const stakeholder = data?.stakeholder;
  const fila = Array.isArray(stakeholder) ? stakeholder.at(0) : stakeholder;
  return fila?.proyecto_id ?? null;
}

export async function membresiasDeEmail(email: string) {
  const admin = createAdminClient();
  if (!admin) {
    return [];
  }

  const { data } = await admin
    .from("proyecto_acceso")
    .select("email, proyecto_id")
    .eq("email", normalizarEmail(email));

  return (data ?? []).map((fila) => ({
    email: fila.email,
    proyectoId: fila.proyecto_id,
  }));
}
