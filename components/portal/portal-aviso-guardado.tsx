"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function PortalAvisoGuardado() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current || searchParams.get("guardado") !== "1") {
      return;
    }

    shown.current = true;
    toast.success(
      "Progreso guardado. Puedes retomar la entrevista cuando quieras."
    );
    router.replace("/portal", { scroll: false });
  }, [router, searchParams]);

  return null;
}
