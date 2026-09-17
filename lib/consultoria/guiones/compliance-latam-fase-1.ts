import type { SeccionEntrevista } from "@/lib/consultoria/entrevista-contenido";

export const NOMBRE_PLANTILLA_CL_FASE_1 =
  "Diagnóstico ComplianceLatam — Fase 1";

export type GuionSeccion = {
  titulo: string;
  descripcion: string;
  preguntas: string[];
};

export const GUION_CL_FASE_1: GuionSeccion[] = [
  {
    descripcion:
      "Vamos a ponerle nota del 1 al 10 a seis capacidades de Compliance Latam. En cada una te pediremos la nota y un por qué breve.",
    preguntas: [
      "Capacidad de comunicar el impacto generado en redes sociales: nota del 1 al 10 y un por qué breve.",
      "Capacidad de comunicar el impacto generado a las firmas socias: nota del 1 al 10 y un por qué breve.",
      "Capacidad de generarle valor agregado a las firmas socias: nota del 1 al 10 y un por qué breve.",
      "Capacidad de avanzar y dar seguimiento a los proyectos acordados en el comité anterior: nota del 1 al 10 y un por qué breve.",
      "Capacidad de convertir colaboradores en clientes, a nivel AZ y a nivel ComplianceLatam: nota del 1 al 10 y un por qué breve.",
      "Capacidad de atraer nuevos colaboradores y comunicarles la propuesta de valor: nota del 1 al 10 y un por qué breve.",
    ],
    titulo: "General",
  },
  {
    descripcion:
      "Hablemos de lo que Compliance Latam les ofrece hoy a las firmas socias.",
    preguntas: [
      "Qué le están ofreciendo hoy a una firma socia.",
      "Si sienten que están cumpliendo esa propuesta de valor, o si hay una brecha entre lo que se promete y lo que se entrega.",
      "Qué parte de esa propuesta está más desaprovechada.",
    ],
    titulo: "Propuesta de valor",
  },
  {
    descripcion:
      "Queremos entender el modelo de membresías, las diferencias entre firmas y el compromiso que se espera.",
    preguntas: [
      "Cómo se llegó a que unas firmas paguen bastante más que otras, y qué problema concreto genera esa diferencia hoy.",
      "Cómo se podría mejorar esa diferencia de membresías.",
      "Si sientes que tienes el poder de llegar al comité y pedirles a las firmas que paguen más por su membresía, y por qué sí o por qué no.",
      "Qué datos usarías para justificar esa alza, y qué te falta.",
      "Cuál es el engagement mínimo que una firma debería tener con Compliance Latam.",
      "Cuál es el engagement ideal para sacarle el mejor valor a la participación.",
    ],
    titulo: "Modelo de membresías y compromiso",
  },
  {
    descripcion:
      "Esta parte es sobre foco: qué debería dejar de hacer Compliance Latam — y Colomba — para concentrarse en lo esencial.",
    preguntas: [
      "Qué debería dejar de hacer Compliance Latam o Colomba para enfocarse en lo esencial.",
      "Qué le ves a Colomba haciendo que probablemente no debería estar haciendo ella.",
      "Qué hábitos, comportamientos o acciones que hacían sentido cuando ComplianceLatam comenzó — por ejemplo que Colomba haga todo el seguimiento y prospecte clientes para todo LATAM — hoy dejan de hacer sentido.",
    ],
    titulo: "Operación y cuellos de botella",
  },
  {
    descripcion:
      "El comité de noviembre: cómo se vería el éxito, qué objeciones anticipas y quién puede empujar.",
    preguntas: [
      "Cómo se vería un comité exitoso para ti este año.",
      "Qué objeción anticipas de los socios.",
      "Qué socios podrían actuar como embajadores creíbles frente a los demás.",
    ],
    titulo: "Comité de noviembre",
  },
  {
    descripcion: "Una última pregunta para cerrar.",
    preguntas: [
      "Si pudieras cambiar una sola cosa en Compliance Latam durante 2027, cuál sería y por qué.",
    ],
    titulo: "Cierre",
  },
];

export function esProyectoComplianceLatam(proyecto: {
  nombre: string;
  cliente: string;
}) {
  const texto = `${proyecto.nombre} ${proyecto.cliente}`.toLowerCase();
  return (
    texto.includes("compliancelatam") || texto.includes("compliance latam")
  );
}

export function seccionesDeGuionClFase1(): SeccionEntrevista[] {
  return GUION_CL_FASE_1.map((seccion) => ({
    descripcion: seccion.descripcion,
    id: crypto.randomUUID(),
    preguntas: [...seccion.preguntas],
    titulo: seccion.titulo,
  }));
}
