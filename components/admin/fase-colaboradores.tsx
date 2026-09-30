import { AdminSeccion } from "@/components/admin/admin-seccion";
import { createAdminClient } from "@/lib/supabase/admin";

export async function FaseColaboradoresAdmin({ faseId }: { faseId: string }) {
  const incidencias = await listarIncidencias(faseId);

  return (
    <>
      <AdminSeccion
        defaultOpen
        descripcion="La identidad de estas respuestas sigue como está hoy. No hay una decisión nueva de anonimato."
        titulo="Identidad, pendiente de decisión"
      >
        <div className="flex flex-col gap-2 text-sm">
          <p>
            El portal del cliente muestra el nombre y puede abrir las respuestas
            de las personas de este proyecto.
          </p>
          <p>
            Notion titula la página con el nombre y publica la empresa. El
            correo solo relaciona a la persona; no es un campo de la
            transcripción.
          </p>
          <p>
            El aviso de bienvenida dice que las respuestas se guardan de forma
            exclusiva para la marca. No promete anonimato.
          </p>
        </div>
      </AdminSeccion>

      <AdminSeccion
        descripcion="Filas de la planilla que no se convirtieron en entrevista, y la traza de la consolidación."
        resumen={
          incidencias.length === 1
            ? "1 incidencia"
            : `${incidencias.length} incidencias`
        }
        titulo="Incidencias de la carga"
      >
        {incidencias.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No hay incidencias cargadas para esta fase.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {incidencias.map((fila) => (
              <li key={fila.id}>
                {fila.hoja} fila {fila.fila}: {fila.motivo}
                {fila.detalle ? ` — ${fila.detalle}` : ""}
              </li>
            ))}
          </ul>
        )}
      </AdminSeccion>
    </>
  );
}

async function listarIncidencias(faseId: string) {
  const admin = createAdminClient();
  if (!admin) {
    return [];
  }
  const { data, error } = await admin
    .from("carga_incidencia")
    .select("id, hoja, fila, motivo, detalle")
    .eq("fase_id", faseId)
    .order("hoja")
    .order("fila");
  if (error || !data) {
    return [];
  }
  return data;
}
