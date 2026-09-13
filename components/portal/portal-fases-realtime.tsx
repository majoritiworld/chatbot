"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FaseStepper } from "@/components/portal/fase-stepper";
import type { FaseDelPortal } from "@/lib/consultoria/fases";
import { createClient } from "@/lib/supabase/client";

/**
 * Renders the phase timeline and refreshes when phases, interviews, or
 * stakeholder status change. Relies on those tables being in the Realtime
 * publication.
 */
export function PortalFasesRealtime({
  proyectoId,
  fases,
}: {
  proyectoId: string;
  fases: FaseDelPortal[];
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
          schema: "public",
          table: "fase",
          filter: `proyecto_id=eq.${proyectoId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stakeholder",
          filter: `proyecto_id=eq.${proyectoId}`,
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [proyectoId, router]);

  return <FaseStepper fases={fases} />;
}
