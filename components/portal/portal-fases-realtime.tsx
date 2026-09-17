"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FaseStepper } from "@/components/portal/fase-stepper";
import { FechasRelevantes } from "@/components/portal/fechas-relevantes";
import { PortalTour } from "@/components/portal/portal-tour";
import type { FaseDelPortal } from "@/lib/consultoria/fases";
import type { EventoDelProyecto } from "@/lib/consultoria/fechas-relevantes";
import { createClient } from "@/lib/supabase/client";

/**
 * Renders the phase timeline and calendar, and refreshes when phases,
 * interviews, stakeholders, or calendar events change.
 */
export function PortalFasesRealtime({
  eventos,
  fases,
  proyectoId,
  tourHabilitado,
  userId,
}: {
  eventos: EventoDelProyecto[];
  fases: FaseDelPortal[];
  proyectoId: string;
  tourHabilitado: boolean;
  userId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      router.refresh();
    };

    const channel = supabase
      .channel(`portal-fases:${proyectoId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `proyecto_id=eq.${proyectoId}`,
          schema: "public",
          table: "fase",
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `proyecto_id=eq.${proyectoId}`,
          schema: "public",
          table: "stakeholder",
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "entrevista",
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `proyecto_id=eq.${proyectoId}`,
          schema: "public",
          table: "evento",
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tarea",
        },
        refresh
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [proyectoId, router]);

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-3">
        <section className="flex flex-col gap-4 lg:col-span-2">
          <h2 className="font-medium text-base">Tareas</h2>
          {fases.length > 0 ? (
            <FaseStepper fases={fases} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Todavía no hay fases publicadas para tu proyecto.
            </p>
          )}
        </section>
        <FechasRelevantes eventos={eventos} />
      </div>
      <PortalTour habilitado={tourHabilitado} userId={userId} />
    </>
  );
}
