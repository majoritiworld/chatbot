"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { type MarcaPublica, textoAvisoEnviada } from "@/lib/consultoria/marca";

export function PortalAvisoGuardado({ marca }: { marca: MarcaPublica }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) {
      return;
    }

    if (searchParams.get("listo") === "1") {
      shown.current = true;
      toast.success(textoAvisoEnviada(marca));
      router.replace("/portal", { scroll: false });
      return;
    }

    if (searchParams.get("guardado") !== "1") {
      return;
    }

    shown.current = true;
    toast.success(
      "Progreso guardado. Puedes retomar la entrevista cuando quieras."
    );
    router.replace("/portal", { scroll: false });
  }, [marca, router, searchParams]);

  return null;
}
