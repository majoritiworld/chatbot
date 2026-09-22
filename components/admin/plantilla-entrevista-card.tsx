import Link from "next/link";
import { AdminAlta } from "@/components/admin/admin-seccion";
import { EnviarPlantillaForm } from "@/components/admin/enviar-plantilla-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PlantillaAdmin } from "@/lib/consultoria/plantillas";

export function PlantillaEntrevistaCard({
  plantilla,
}: {
  plantilla: PlantillaAdmin;
}) {
  const href = `/admin/${plantilla.proyectoId}/fase/${plantilla.faseId}/plantilla/${plantilla.id}`;

  return (
    <article className="flex flex-col rounded-xl border border-border">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <Link className="min-w-0 flex-1 hover:underline" href={href}>
          <h3 className="font-medium text-sm">{plantilla.nombre}</h3>
          <p className="text-muted-foreground text-xs">
            {plantilla.secciones.length} secciones ·{" "}
            {plantilla.preguntas.length} preguntas guía
          </p>
        </Link>
        <Badge variant="outline">
          {plantilla.enviadas === 1
            ? "1 envío"
            : `${plantilla.enviadas} envíos`}
        </Badge>
        <Button asChild size="sm" variant="outline">
          <Link href={href}>Editar guion</Link>
        </Button>
      </div>
      <div className="border-border border-t px-4 py-3">
        <AdminAlta etiqueta="Enviar a destinatarios">
          <EnviarPlantillaForm
            plantillaId={plantilla.id}
            proyectoId={plantilla.proyectoId}
          />
        </AdminAlta>
      </div>
    </article>
  );
}
