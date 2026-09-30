import type { IncidenciaCorreo } from "@/lib/consultoria/correos/incidencia";

const FECHA = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function IncidenciasCorreo({
  incidencias,
}: {
  incidencias: IncidenciaCorreo[];
}) {
  return (
    <section
      aria-labelledby="incidencias-correo"
      className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-sm" id="incidencias-correo">
          Correos sin enviar
        </h2>
        <p className="text-xs opacity-80">
          Las entrevistas están guardadas. Corrige la marca o el contacto del
          proyecto; el correo se envía cuando la persona vuelve a pedirlo.
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {incidencias.map((incidencia) => (
          <li className="flex flex-col" key={incidencia.entrevistaId}>
            <span className="font-medium">{incidencia.persona}</span>
            <span>{incidencia.mensaje}</span>
            <span className="text-xs opacity-70">
              {FECHA.format(new Date(incidencia.en))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
