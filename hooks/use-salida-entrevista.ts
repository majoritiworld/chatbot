"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  mensajeSalidaInsegura,
  salidaEntrevistaInsegura,
} from "@/lib/consultoria/entrevista-piloto";

export function useSalidaEntrevista() {
  const { guardadoEnCurso, input, status } = useActiveChat();
  const hayBorrador = input.trim().length > 0;
  const ocupadoChat = status === "submitted" || status === "streaming";
  const insegura = salidaEntrevistaInsegura({
    guardadoEnCurso,
    hayBorrador,
    ocupadoChat,
  });
  const aviso = mensajeSalidaInsegura({
    guardadoEnCurso,
    hayBorrador,
    ocupadoChat,
  });
  const [destinoPendiente, setDestinoPendiente] = useState<string | null>(null);

  useEffect(() => {
    if (!insegura) {
      return;
    }

    const avisar = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = aviso ?? "";
    };

    window.addEventListener("beforeunload", avisar);
    return () => {
      window.removeEventListener("beforeunload", avisar);
    };
  }, [aviso, insegura]);

  const pedirConfirmacion = useCallback(
    (href: string) => {
      if (!insegura) {
        return false;
      }
      setDestinoPendiente(href);
      return true;
    },
    [insegura]
  );

  const cancelarSalida = useCallback(() => {
    setDestinoPendiente(null);
  }, []);

  return {
    aviso,
    cancelarSalida,
    destinoPendiente,
    hayBorrador,
    insegura,
    pedirConfirmacion,
  };
}

export function useConfirmarDestinoPendiente(destinoPendiente: string | null) {
  const router = useRouter();
  return useCallback(() => {
    if (destinoPendiente) {
      router.push(destinoPendiente);
    }
  }, [destinoPendiente, router]);
}
