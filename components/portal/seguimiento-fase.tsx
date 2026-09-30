import Link from "next/link";
import type {
  FilaSeguimiento,
  FiltroSeguimiento,
  PaginaSeguimiento,
} from "@/lib/consultoria/seguimiento-fase";
import { TAMANOS_PAGINA } from "@/lib/consultoria/seguimiento-fase";

const ETIQUETA_ESTADO: Record<FilaSeguimiento["estado"], string> = {
  completada: "Completada",
  en_curso: "En curso",
  pendiente: "Sin iniciar",
};

const ETIQUETA_INVITACION: Record<FilaSeguimiento["invitacion"], string> = {
  enviado: "Enviada",
  error: "Error de envío",
  sin_invitar: "Sin invitar",
};

function hrefDe(
  faseId: string,
  filtro: FiltroSeguimiento,
  cambios: Partial<FiltroSeguimiento>
) {
  const siguiente = { ...filtro, ...cambios };
  const params = new URLSearchParams();
  if (siguiente.q) {
    params.set("q", siguiente.q);
  }
  if (siguiente.pais) {
    params.set("pais", siguiente.pais);
  }
  if (siguiente.empresa) {
    params.set("empresa", siguiente.empresa);
  }
  if (siguiente.estado) {
    params.set("estado", siguiente.estado);
  }
  if (siguiente.orden !== "nombre") {
    params.set("orden", siguiente.orden);
  }
  if (siguiente.page > 1) {
    params.set("page", String(siguiente.page));
  }
  if (siguiente.pageSize !== 25) {
    params.set("tamano", String(siguiente.pageSize));
  }
  if (siguiente.persona) {
    params.set("persona", siguiente.persona);
  }
  const consulta = params.toString();
  return consulta
    ? `/portal/fase/${faseId}?${consulta}`
    : `/portal/fase/${faseId}`;
}

function formatoActividad(valor: string | null) {
  if (!valor) {
    return "Sin actividad";
  }
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    return "Sin actividad";
  }
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(fecha);
}

export function SeguimientoFase({
  faseId,
  filtro,
  pagina,
}: {
  faseId: string;
  filtro: FiltroSeguimiento;
  pagina: PaginaSeguimiento;
}) {
  const detalle = pagina.filas.find(
    (fila) => fila.entrevistaId === filtro.persona
  );
  const inicio =
    pagina.totalFiltrado === 0
      ? 0
      : (Math.min(filtro.page, pagina.totalPaginas) - 1) * filtro.pageSize + 1;
  const fin = Math.min(filtro.page * filtro.pageSize, pagina.totalFiltrado);

  return (
    <div className="flex flex-col gap-4">
      <form action={`/portal/fase/${faseId}`} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm" htmlFor="q">
          Buscar por nombre, correo o empresa
          <input
            className="rounded-md border bg-background px-3 py-2"
            defaultValue={filtro.q}
            id="q"
            name="q"
            type="search"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm" htmlFor="pais">
            País
            <select
              className="rounded-md border bg-background px-3 py-2"
              defaultValue={filtro.pais}
              id="pais"
              name="pais"
            >
              <option value="">Todos</option>
              {pagina.paises.map((pais) => (
                <option key={pais} value={pais}>
                  {pais}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm" htmlFor="empresa">
            Empresa
            <select
              className="rounded-md border bg-background px-3 py-2"
              defaultValue={filtro.empresa}
              id="empresa"
              name="empresa"
            >
              <option value="">Todas</option>
              {pagina.empresas.map((empresa) => (
                <option key={empresa} value={empresa}>
                  {empresa}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm" htmlFor="estado">
            Estado de la entrevista
            <select
              className="rounded-md border bg-background px-3 py-2"
              defaultValue={filtro.estado}
              id="estado"
              name="estado"
            >
              <option value="">Todos</option>
              <option value="pendiente">Sin iniciar</option>
              <option value="en_curso">En curso</option>
              <option value="completada">Completada</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm" htmlFor="orden">
            Orden
            <select
              className="rounded-md border bg-background px-3 py-2"
              defaultValue={filtro.orden}
              id="orden"
              name="orden"
            >
              <option value="nombre">Persona</option>
              <option value="empresa">Empresa</option>
              <option value="actividad">Última actividad</option>
            </select>
          </label>
        </div>
        <button
          className="w-fit rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm"
          type="submit"
        >
          Aplicar
        </button>
      </form>

      <p className="text-muted-foreground text-sm">
        {pagina.totalFiltrado === 0
          ? "Ninguna persona coincide con el filtro."
          : `${inicio}–${fin} de ${pagina.totalFiltrado}`}
      </p>

      <div className="flex flex-col gap-3 md:hidden">
        {pagina.filas.map((fila) => (
          <article className="rounded-lg border p-3" key={fila.entrevistaId}>
            <h2 className="font-medium text-sm">{fila.nombre}</h2>
            <p className="text-muted-foreground text-sm">
              {fila.empresa ?? "Sin empresa"}
            </p>
            <p className="text-sm">{fila.pais ?? "Sin país"}</p>
            <p className="text-sm">{ETIQUETA_ESTADO[fila.estado]}</p>
            <p className="text-muted-foreground text-sm">
              {formatoActividad(fila.actividad)}
            </p>
            <Link
              className="font-medium text-primary text-sm"
              href={hrefDe(faseId, filtro, { persona: fila.entrevistaId })}
            >
              Ver detalle
            </Link>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2 pr-3 font-medium" scope="col">
                Persona
              </th>
              <th className="py-2 pr-3 font-medium" scope="col">
                Empresa
              </th>
              <th className="py-2 pr-3 font-medium" scope="col">
                País
              </th>
              <th className="py-2 pr-3 font-medium" scope="col">
                Estado
              </th>
              <th className="py-2 font-medium" scope="col">
                Última actividad
              </th>
            </tr>
          </thead>
          <tbody>
            {pagina.filas.map((fila) => (
              <tr className="border-b" key={fila.entrevistaId}>
                <td className="py-2 pr-3">
                  <Link
                    className="font-medium text-primary"
                    href={hrefDe(faseId, filtro, {
                      persona: fila.entrevistaId,
                    })}
                  >
                    {fila.nombre}
                  </Link>
                </td>
                <td className="py-2 pr-3">{fila.empresa ?? "—"}</td>
                <td className="py-2 pr-3">{fila.pais ?? "—"}</td>
                <td className="py-2 pr-3">{ETIQUETA_ESTADO[fila.estado]}</td>
                <td className="py-2">{formatoActividad(fila.actividad)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {filtro.page > 1 ? (
          <Link
            href={hrefDe(faseId, filtro, {
              page: filtro.page - 1,
              persona: "",
            })}
          >
            Anterior
          </Link>
        ) : null}
        <span>
          Página {Math.min(filtro.page, pagina.totalPaginas)} de{" "}
          {pagina.totalPaginas}
        </span>
        {filtro.page < pagina.totalPaginas ? (
          <Link
            href={hrefDe(faseId, filtro, {
              page: filtro.page + 1,
              persona: "",
            })}
          >
            Siguiente
          </Link>
        ) : null}
        {TAMANOS_PAGINA.map((tamano) => (
          <Link
            href={hrefDe(faseId, filtro, {
              page: 1,
              pageSize: tamano,
              persona: "",
            })}
            key={tamano}
          >
            {tamano}
          </Link>
        ))}
      </div>

      {detalle ? (
        <section className="rounded-lg border p-4">
          <h2 className="font-medium">{detalle.nombre}</h2>
          <dl className="mt-2 grid gap-1 text-sm">
            <div>Empresa: {detalle.empresa ?? "—"}</div>
            <div>País: {detalle.pais ?? "—"}</div>
            <div>Cargo: {detalle.cargo ?? "—"}</div>
            <div>Correo: {detalle.correo}</div>
            <div>Entrevista: {ETIQUETA_ESTADO[detalle.estado]}</div>
            <div>Invitación: {ETIQUETA_INVITACION[detalle.invitacion]}</div>
            <div>Última actividad: {formatoActividad(detalle.actividad)}</div>
          </dl>
          <Link
            className="mt-3 inline-block font-medium text-primary text-sm"
            href={`/portal/entrevista/${detalle.entrevistaId}`}
          >
            Ver respuestas
          </Link>
        </section>
      ) : null}
    </div>
  );
}
