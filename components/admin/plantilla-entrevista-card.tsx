import { EnviarPlantillaForm } from "@/components/admin/enviar-plantilla-form";
import { PreguntasPlantillaForm } from "@/components/admin/preguntas-plantilla-form";
import { Badge } from "@/components/ui/badge";
import type { PlantillaAdmin } from "@/lib/consultoria/plantillas";

export function PlantillaEntrevistaCard({
  plantilla,
}: {
  plantilla: PlantillaAdmin;
}) {
  return (
    <article className="flex flex-col gap-6 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-base">{plantilla.nombre}</h3>
          <p className="text-muted-foreground text-sm">
            Fase {plantilla.faseOrden}. {plantilla.faseNombre} ·{" "}
            {plantilla.secciones.length} secciones ·{" "}
            {plantilla.preguntas.length} preguntas guía
          </p>
        </div>
        <Badge variant="outline">
          {plantilla.enviadas === 1
            ? "1 envío"
            : `${plantilla.enviadas} envíos`}
        </Badge>
      </div>

      <PreguntasPlantillaForm
        plantillaId={plantilla.id}
        proyectoId={plantilla.proyectoId}
        secciones={plantilla.secciones}
      />

      <div className="flex flex-col gap-3 border-border border-t pt-4">
        <div>
          <h4 className="font-medium text-sm">Enviar</h4>
          <p className="text-muted-foreground text-sm">
            Crea las personas, clona esta entrevista y les manda el acceso.
            Elige si entran como cliente (portal completo) o stakeholder (solo
            su entrevista).
          </p>
        </div>
        <EnviarPlantillaForm
          plantillaId={plantilla.id}
          proyectoId={plantilla.proyectoId}
        />
      </div>
    </article>
  );
}
