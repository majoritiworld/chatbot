import {
  enlaceLoginEntrevista,
  pathEntrevista,
} from "@/lib/consultoria/destino-entrevista";
import { slugValido } from "@/lib/consultoria/marca";

/**
 * How the invitation lets the person in: "codigo" is email + code;
 * "enlace_personal" opens the interview directly, with email + code to the
 * same interview as the alternative.
 */
export type ModoAcceso = "codigo" | "enlace_personal";

export type EnlaceAcceso = {
  /** Email + code entry to the same interview. Only for the personal link. */
  alternativa?: string;
  entrevistaId: string;
  modo: ModoAcceso;
  url: string;
};

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1"]);

/** Https origin of the site. Plain http only for localhost when allowed. */
export function origenAutorizado(site: string, permitirLocal: boolean) {
  let url: URL;
  try {
    url = new URL(site);
  } catch {
    return null;
  }
  if (url.username || url.password) {
    return null;
  }
  if (url.protocol === "https:") {
    return url.origin;
  }
  if (
    permitirLocal &&
    url.protocol === "http:" &&
    HOSTS_LOCALES.has(url.hostname)
  ) {
    return url.origin;
  }
  return null;
}

const TOKEN_ENLACE = /^[A-Za-z0-9_-]{16,128}$/;

/** `?codigo=1` keeps email + code even where the project page asks only for the email. */
function entradaConCodigo(origen: string, slug: string) {
  return `${origen}/${slug}?codigo=1`;
}

/** Built from the assignment only. Callers never pass a URL of their own. */
export function crearEnlaceAcceso({
  entrevistaId,
  permitirLocal,
  site,
  slug,
  token,
}: {
  entrevistaId: string;
  permitirLocal: boolean;
  site: string;
  slug: string | null;
  token?: string | null;
}): EnlaceAcceso | null {
  const origen = origenAutorizado(site, permitirLocal);
  if (!origen) {
    return null;
  }
  if (token) {
    if (!TOKEN_ENLACE.test(token)) {
      return null;
    }
    return {
      alternativa: enlaceLoginEntrevista(origen, entrevistaId),
      entrevistaId,
      modo: "enlace_personal",
      url: `${origen}/e/${token}`,
    };
  }
  const slugProyecto = slugValido(slug);
  const url = slugProyecto
    ? entradaConCodigo(origen, slugProyecto)
    : enlaceLoginEntrevista(origen, entrevistaId);
  return { entrevistaId, modo: "codigo", url };
}

export function validarEnlaceAcceso(
  enlace: EnlaceAcceso,
  {
    entrevistaId,
    permitirLocal,
    site,
    slug,
    token,
  }: {
    entrevistaId: string;
    permitirLocal: boolean;
    site: string;
    slug: string | null;
    token?: string | null;
  }
) {
  if (enlace.entrevistaId !== entrevistaId) {
    return false;
  }
  if (enlace.modo === "enlace_personal") {
    if (!(token && TOKEN_ENLACE.test(token))) {
      return false;
    }
    const origen = origenAutorizado(site, permitirLocal);
    let url: URL;
    try {
      url = new URL(enlace.url);
    } catch {
      return false;
    }
    return (
      origen !== null &&
      url.origin === origen &&
      !url.username &&
      !url.hash &&
      url.search === "" &&
      url.pathname === `/e/${token}` &&
      enlace.alternativa === enlaceLoginEntrevista(origen, entrevistaId)
    );
  }
  if (enlace.modo !== "codigo") {
    return false;
  }
  const origen = origenAutorizado(site, permitirLocal);
  let url: URL;
  try {
    url = new URL(enlace.url);
  } catch {
    return false;
  }
  if (!origen || url.origin !== origen || url.username || url.hash) {
    return false;
  }
  const slugProyecto = slugValido(slug);
  if (slugProyecto) {
    return enlace.url === entradaConCodigo(origen, slugProyecto);
  }
  const claves = [...url.searchParams.keys()];
  return (
    url.pathname === "/login" &&
    claves.length === 1 &&
    url.searchParams.get("next") === pathEntrevista(entrevistaId)
  );
}
