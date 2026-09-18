"use client";

import { TourGuia, type TourPaso } from "@/components/portal/tour-guia";

const PASOS: TourPaso[] = [
  {
    descripcion:
      "Te invitamos a un recorrido corto para conocer cómo está organizado tu proyecto: las fases, el calendario y tu entrevista.",
    id: "invitar",
    invitacion: true,
    prefer: "center",
    selector: null,
    titulo: "¿Te mostramos el portal?",
  },
  {
    descripcion:
      "El proyecto avanza por fases. Aquí ves en cuál están, las fechas previstas y las entrevistas o tareas de cada una.",
    id: "fases",
    prefer: "right",
    selector: '[data-tour="fases"]',
    titulo: "Las fases",
  },
  {
    descripcion:
      "Estas son las fechas relevantes del proyecto: reuniones, entregas y otros hitos, con quién participa en cada una. Si una sesión ya pasó, puedes abrirla para ver el resumen de la reunión.",
    id: "calendario",
    prefer: "left",
    selector: '[data-tour="calendario"]',
    titulo: "El calendario",
  },
  {
    descripcion:
      "Esta es tu entrevista. Te señalamos el botón para empezarla. Puedes pausar y continuar cuando quieras.",
    descripcionSinCta:
      "Esta es tu entrevista. Cuando la fase esté en curso, podrás abrirla desde aquí.",
    id: "entrevista",
    prefer: "left",
    selector: '[data-tour="entrevista"]',
    titulo: "Tu entrevista",
  },
];

export function PortalTour({
  habilitado,
  userId,
}: {
  habilitado: boolean;
  userId: string;
}) {
  return (
    <TourGuia
      ariaId="portal-tour"
      habilitado={habilitado}
      pasos={PASOS}
      storageKey={`mj-portal-tour:${userId}`}
    />
  );
}
