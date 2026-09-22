import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { EntrevistaDeFaseAdmin } from "@/lib/consultoria/stakeholders";

function etiquetaEstado(estado: string) {
  if (estado === "completada") {
    return "Completada";
  }
  if (estado === "en_curso") {
    return "En curso";
  }
  return "Pendiente";
}

export function EntrevistasFase({
  proyectoId,
  entrevistas,
}: {
  proyectoId: string;
  entrevistas: EntrevistaDeFaseAdmin[];
}) {
  return (
    <section className="flex flex-col gap-3">
      {entrevistas.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay envíos. Crea el guion abajo y mándalo a la lista de
          correos.
        </p>
      ) : (
        <ul className="flex flex-col rounded-xl border border-border">
          {entrevistas.map((entrevista) => (
            <li
              className="flex flex-wrap items-center gap-2 border-border border-b px-4 py-3 last:border-b-0"
              key={entrevista.id}
            >
              <Link
                className="flex-1 font-medium text-sm hover:underline"
                href={`/admin/${proyectoId}/stakeholder/${entrevista.stakeholderId}`}
              >
                {entrevista.stakeholderNombre}
              </Link>
              <Badge variant="outline">
                {etiquetaEstado(entrevista.estado)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
