/** Project copy, with an optional phase override. No client name is assumed. */

export type FilaComunicacion = {
  aviso_respuestas?: string | null;
  correo_asunto?: string | null;
  correo_cuerpo?: string | null;
  correo_firma?: string | null;
  correo_remitente?: string | null;
  texto_bienvenida?: string | null;
};

export type FilaComunicacionFase = FilaComunicacion & {
  bloque_comercial?: string | null;
  bloque_comercial_etiqueta?: string | null;
  bloque_comercial_url?: string | null;
  minutos?: number | null;
};

export type TextosComunicacion = {
  avisoRespuestas: string | null;
  bloqueComercial: string | null;
  bloqueComercialEtiqueta: string | null;
  bloqueComercialUrl: string | null;
  correoAsunto: string | null;
  correoCuerpo: string | null;
  correoFirma: string | null;
  correoRemitente: string | null;
  textoBienvenida: string | null;
};

const URL_HTTPS = /^https:\/\/\S+$/;

function limpio(value: string | null | undefined) {
  const texto = value?.trim() ?? "";
  return texto.length > 0 ? texto : null;
}

function preferir(
  fase: string | null | undefined,
  proyecto: string | null | undefined
) {
  return limpio(fase) ?? limpio(proyecto);
}

export function textosVacios(): TextosComunicacion {
  return {
    avisoRespuestas: null,
    bloqueComercial: null,
    bloqueComercialEtiqueta: null,
    bloqueComercialUrl: null,
    correoAsunto: null,
    correoCuerpo: null,
    correoFirma: null,
    correoRemitente: null,
    textoBienvenida: null,
  };
}

/** Https only. Anything else is dropped and never used as a link. */
export function urlHttps(value: string | null | undefined) {
  const url = limpio(value);
  if (!(url && URL_HTTPS.test(url))) {
    return null;
  }
  return url;
}

export function resolverComunicacion(
  proyecto: FilaComunicacion | null | undefined,
  fase: FilaComunicacionFase | null | undefined
): TextosComunicacion {
  return {
    avisoRespuestas: preferir(
      fase?.aviso_respuestas,
      proyecto?.aviso_respuestas
    ),
    bloqueComercial: limpio(fase?.bloque_comercial),
    bloqueComercialEtiqueta: limpio(fase?.bloque_comercial_etiqueta),
    bloqueComercialUrl: urlHttps(fase?.bloque_comercial_url),
    correoAsunto: preferir(fase?.correo_asunto, proyecto?.correo_asunto),
    correoCuerpo: preferir(fase?.correo_cuerpo, proyecto?.correo_cuerpo),
    correoFirma: preferir(fase?.correo_firma, proyecto?.correo_firma),
    correoRemitente: preferir(
      fase?.correo_remitente,
      proyecto?.correo_remitente
    ),
    textoBienvenida: preferir(
      fase?.texto_bienvenida,
      proyecto?.texto_bienvenida
    ),
  };
}

/** Invitation copy is stored apart so a confirmation field never lands in it. */
export type FilaTextosCorreo = FilaComunicacion & {
  invitacion_asunto?: string | null;
  invitacion_cuerpo?: string | null;
};

export type FilaTextosCorreoFase = FilaComunicacionFase & {
  invitacion_asunto?: string | null;
  invitacion_cuerpo?: string | null;
};

export type TextosCorreo = {
  asunto: string | null;
  cuerpo: string | null;
  firma: string | null;
  remitente: string | null;
};

export type SiguientePaso = {
  etiqueta: string | null;
  texto: string;
  url: string | null;
};

export type TextosCorreos = {
  confirmacion: TextosCorreo;
  invitacion: TextosCorreo;
  siguientePaso: SiguientePaso | null;
};

export function resolverTextosCorreo(
  proyecto: FilaTextosCorreo | null | undefined,
  fase: FilaTextosCorreoFase | null | undefined
): TextosCorreos {
  const firma = preferir(fase?.correo_firma, proyecto?.correo_firma);
  const remitente = preferir(
    fase?.correo_remitente,
    proyecto?.correo_remitente
  );
  const textoPaso = limpio(fase?.bloque_comercial);
  const url = urlHttps(fase?.bloque_comercial_url);
  const etiqueta = limpio(fase?.bloque_comercial_etiqueta);
  return {
    confirmacion: {
      asunto: preferir(fase?.correo_asunto, proyecto?.correo_asunto),
      cuerpo: preferir(fase?.correo_cuerpo, proyecto?.correo_cuerpo),
      firma,
      remitente,
    },
    invitacion: {
      asunto: preferir(fase?.invitacion_asunto, proyecto?.invitacion_asunto),
      cuerpo: preferir(fase?.invitacion_cuerpo, proyecto?.invitacion_cuerpo),
      firma,
      remitente,
    },
    siguientePaso: textoPaso
      ? {
          etiqueta: url && etiqueta ? etiqueta : null,
          texto: textoPaso,
          url: url && etiqueta ? url : null,
        }
      : null,
  };
}

export function minutosDeFase(minutos: number | null | undefined) {
  if (typeof minutos !== "number" || !Number.isInteger(minutos)) {
    return null;
  }
  if (minutos < 1 || minutos > 240) {
    return null;
  }
  return minutos;
}

export function lineasAviso(aviso: string) {
  return aviso.split("\n").flatMap((linea) => {
    const texto = linea.trim();
    return texto.length > 0 ? [texto] : [];
  });
}

/** Replaces the display name and keeps the configured mailbox. */
export function remitenteConNombre(from: string, nombre: string | null) {
  const visible = nombre?.replace(/[<>\r\n"]/g, "").trim() ?? "";
  if (!visible) {
    return from;
  }
  const entre = from.match(/<([^>]+)>/);
  const address = (entre?.[1] ?? from).trim();
  return `${visible} <${address}>`;
}
