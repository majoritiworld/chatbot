import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProyectoConProgreso } from "@/lib/consultoria/stakeholders";

function agruparPorCliente(proyectos: ProyectoConProgreso[]) {
  const grupos = new Map<string, ProyectoConProgreso[]>();

  for (const proyecto of proyectos) {
    const actual = grupos.get(proyecto.cliente);
    if (actual) {
      actual.push(proyecto);
    } else {
      grupos.set(proyecto.cliente, [proyecto]);
    }
  }

  return [...grupos];
}

function porcentaje({
  entrevistasCompletadas,
  entrevistasTotal,
}: ProyectoConProgreso) {
  if (entrevistasTotal === 0) {
    return 0;
  }

  return Math.round((entrevistasCompletadas / entrevistasTotal) * 100);
}

export function ProyectosLista({
  proyectos,
}: {
  proyectos: ProyectoConProgreso[];
}) {
  if (proyectos.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Todavía no hay proyectos cargados.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {agruparPorCliente(proyectos).map(([cliente, delCliente]) => (
        <section className="flex flex-col gap-3" key={cliente}>
          <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            {cliente}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {delCliente.map((proyecto) => (
              <Link
                className="rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href={`/admin/${proyecto.id}`}
                key={proyecto.id}
              >
                <Card
                  className="h-full transition-shadow hover:ring-foreground/25"
                  size="sm"
                >
                  <CardHeader>
                    <CardTitle>{proyecto.nombre}</CardTitle>
                    <CardDescription>
                      {proyecto.entrevistasCompletadas}/
                      {proyecto.entrevistasTotal} entrevistas completadas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${porcentaje(proyecto)}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
