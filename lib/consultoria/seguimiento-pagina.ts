export const TAMANOS_PAGINA = [25, 50, 100] as const;

export type FiltroSeguimiento = {
  empresa: string;
  estado: "" | "pendiente" | "en_curso" | "completada";
  orden: "nombre" | "empresa" | "actividad";
  page: number;
  pageSize: (typeof TAMANOS_PAGINA)[number];
  pais: string;
  persona: string;
  q: string;
};

export function filtroDesdeParametros(
  raw: Record<string, string | undefined>
): FiltroSeguimiento {
  const { estado, orden, tamano } = raw;
  const pageSize = TAMANOS_PAGINA.find((item) => item === Number(tamano)) ?? 25;
  return {
    empresa: raw.empresa?.trim() ?? "",
    estado:
      estado === "pendiente" || estado === "en_curso" || estado === "completada"
        ? estado
        : "",
    orden: orden === "empresa" || orden === "actividad" ? orden : "nombre",
    page: Math.max(1, Number(raw.page) || 1),
    pageSize,
    pais: raw.pais?.trim() ?? "",
    persona: raw.persona?.trim() ?? "",
    q: raw.q?.trim() ?? "",
  };
}

export type FilaSeguimiento = {
  actividad: string | null;
  cargo: string | null;
  correo: string;
  empresa: string | null;
  entrevistaId: string;
  estado: "pendiente" | "en_curso" | "completada";
  invitacion: "sin_invitar" | "enviado" | "error";
  nombre: string;
  pais: string | null;
};

export type PaginaSeguimiento = {
  empresas: string[];
  filas: FilaSeguimiento[];
  paises: string[];
  totalFiltrado: number;
  totalPaginas: number;
};

export type FilaSeguimientoCruda = {
  actividad: string | null;
  cargo: string | null;
  correo: string;
  empresa: string | null;
  entrevistaId: string;
  estado: FilaSeguimiento["estado"];
  nombre: string;
  pais: string | null;
};

export function paginarSeguimiento(
  filas: FilaSeguimientoCruda[],
  invitaciones: Map<string, "enviado" | "error">,
  filtro: FiltroSeguimiento
): PaginaSeguimiento {
  const consulta = filtro.q.trim().toLowerCase();
  const coinciden = filas.filter((fila) => {
    if (filtro.pais && fila.pais !== filtro.pais) {
      return false;
    }
    if (filtro.empresa && fila.empresa !== filtro.empresa) {
      return false;
    }
    if (filtro.estado && fila.estado !== filtro.estado) {
      return false;
    }
    if (!consulta) {
      return true;
    }
    const texto =
      `${fila.nombre} ${fila.correo} ${fila.empresa ?? ""}`.toLowerCase();
    return texto.includes(consulta);
  });
  const ordenadas = [...coinciden].sort((a, b) => {
    if (filtro.orden === "empresa") {
      return (a.empresa ?? "").localeCompare(b.empresa ?? "", "es");
    }
    if (filtro.orden === "actividad") {
      return (b.actividad ?? "").localeCompare(a.actividad ?? "");
    }
    return a.nombre.localeCompare(b.nombre, "es");
  });
  const totalFiltrado = ordenadas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / filtro.pageSize));
  const page = Math.min(Math.max(filtro.page, 1), totalPaginas);
  const inicio = (page - 1) * filtro.pageSize;
  const paises = [
    ...new Set(filas.map((fila) => fila.pais).filter(Boolean)),
  ].sort((a, b) => (a ?? "").localeCompare(b ?? "", "es")) as string[];
  const empresas = [
    ...new Set(filas.map((fila) => fila.empresa).filter(Boolean)),
  ].sort((a, b) => (a ?? "").localeCompare(b ?? "", "es")) as string[];

  return {
    empresas,
    filas: ordenadas.slice(inicio, inicio + filtro.pageSize).map((fila) => ({
      ...fila,
      invitacion: invitaciones.get(fila.entrevistaId) ?? "sin_invitar",
    })),
    paises,
    totalFiltrado,
    totalPaginas,
  };
}
