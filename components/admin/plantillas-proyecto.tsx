import { CrearPlantillaForm } from "@/components/admin/crear-plantilla-form";
import { PlantillaEntrevistaCard } from "@/components/admin/plantilla-entrevista-card";
import type { PlantillaAdmin } from "@/lib/consultoria/plantillas";
import type { FaseAdmin } from "@/lib/consultoria/stakeholders";

export function PlantillasProyecto({
  proyectoId,
  fases,
  plantillas,
}: {
  proyectoId: string;
  fases: FaseAdmin[];
  plantillas: PlantillaAdmin[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-medium text-base">Entrevistas agénticas</h2>
        <p className="text-muted-foreground text-sm">
          Armas el skill una vez y luego lo mandas a todos los stakeholders de
          esa fase.
        </p>
      </div>

      {plantillas.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay un guion. Créalo abajo y después pega la lista de
          correos.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {plantillas.map((plantilla) => (
            <PlantillaEntrevistaCard key={plantilla.id} plantilla={plantilla} />
          ))}
        </div>
      )}

      <CrearPlantillaForm fases={fases} proyectoId={proyectoId} />
    </section>
  );
}
