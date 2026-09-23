import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";
import type { GuionSeccion } from "@/lib/consultoria/guiones/compliance-latam-fase-1";

export const NOMBRE_PLANTILLA_CL_CORTO =
  "Diagnóstico corto — abogado de apoyo";

export const GUION_CL_CORTO: GuionSeccion[] = [
  {
    descripcion:
      "Esta parte es sobre el valor que Compliance Latam les da hoy a las firmas socias, visto desde quien apoya el trabajo de fondo — no el discurso comercial.",
    preguntas: [
      "Qué valor concreto les está dando Compliance Latam hoy a una firma socia: no el discurso, sino lo que de verdad usan o lo que pediría un socio.",
      "Dónde está la brecha entre lo que se promete y lo que se entrega, o lo que una firma como AZ realmente aprovecha.",
      "Si el comité pidiera cobrar más por la membresía, qué tendría que ser cierto del valor para que eso se sostenga, y qué falta hoy.",
    ],
    titulo: "Valor comercial",
  },
  {
    descripcion:
      "Queremos entender cómo apoyas a Colomba, dónde se atasca el trabajo y qué debería dejar de hacerse.",
    preguntas: [
      "Cómo apoyas hoy a Colomba: en qué entras, en qué no, y dónde se atasca el trabajo — el de ella o el tuyo.",
      "Qué debería dejar de hacer Colomba — o Compliance Latam — para concentrarse en lo que sí mueve la aguja.",
      "Cuál es el cuello de botella más caro ahora: tiempo, calidad, decisión, o que todo pase por ella.",
    ],
    titulo: "Cuellos de botella y rol de apoyo",
  },
  {
    descripcion:
      "El comité de noviembre y un cierre: qué tendría que pasar ahí, qué objeción anticipas, y una sola palanca para 2027.",
    preguntas: [
      "Cómo se vería un comité exitoso para ti este año: una decisión o un resultado, no un ambiente.",
      "Qué objeción anticipas de los socios y qué tendría que estar resuelto antes para no empantanarse.",
      "Si pudieras cambiar una sola cosa en Compliance Latam de aquí a 2027, cuál sería y por qué.",
    ],
    titulo: "Comité de noviembre",
  },
];

export function seccionesDeGuionClCorto(): SeccionEntrevista[] {
  return GUION_CL_CORTO.map((seccion) => ({
    descripcion: seccion.descripcion,
    id: crypto.randomUUID(),
    preguntas: [...seccion.preguntas],
    titulo: seccion.titulo,
  }));
}
