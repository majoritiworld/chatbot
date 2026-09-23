import { AdminAlta, AdminSeccion } from "@/components/admin/admin-seccion";
import { CrearPlantillaForm } from "@/components/admin/crear-plantilla-form";
import { PlantillaEntrevistaCard } from "@/components/admin/plantilla-entrevista-card";
import type { PlantillaAdmin } from "@/lib/consultoria/plantillas";
import type {
  FaseAdmin,
  StakeholderAdmin,
} from "@/lib/consultoria/stakeholders";

export function PlantillasProyecto({
  proyectoId,
  fases,
  plantillas,
  faseId,
  personas,
}: {
  proyectoId: string;
  fases: FaseAdmin[];
  plantillas: PlantillaAdmin[];
  faseId?: string;
  personas: StakeholderAdmin[];
}) {
  return (
    <AdminSeccion
      defaultOpen
      descripcion="Armas el skill una vez y luego lo mandas a todos los stakeholders de esta fase. Abre el guion para ver o editar las preguntas."
      resumen={
        plantillas.length === 1
          ? "1 entrevista"
          : `${plantillas.length} entrevistas`
      }
      titulo="Entrevistas agénticas"
    >
      {plantillas.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Todavía no hay un guion. Créalo abajo y después pega la lista de
          correos.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {plantillas.map((plantilla) => (
            <PlantillaEntrevistaCard
              key={plantilla.id}
              personas={personas}
              plantilla={plantilla}
            />
          ))}
        </div>
      )}

      <AdminAlta etiqueta="Crear entrevista agéntica">
        <CrearPlantillaForm
          faseId={faseId}
          fases={fases}
          proyectoId={proyectoId}
        />
      </AdminAlta>
    </AdminSeccion>
  );
}
