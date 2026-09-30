import type {
  SeccionEntrevista,
  TratoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";

export const NOMBRE_FASE_COLABORADORES = "Entrevistas a colaboradores";

export const NOMBRE_PLANTILLA_CL_COLABORADORES =
  "Entrevista a colaboradores — ComplianceLatam";

export const MINUTOS_CL_COLABORADORES = 15;

export const TRATO_CL_COLABORADORES: TratoEntrevista = "usted";

export const INSTRUCCIONES_AGENTE_CL_COLABORADORES = [
  "Esta entrevista dura unos 10 a 15 minutos. Ese tiempo es un ritmo, no una cuenta regresiva: no cortes una respuesta por el reloj.",
  "Haz las tres preguntas principales, el bloque obligatorio de información y acceso y la pregunta final. Elige como máximo dos seguimientos opcionales por sección, solo cuando falte información clave. El bloque obligatorio no consume ese cupo.",
  "Haz una pregunta por turno. No repitas lo que la persona ya respondió, aunque lo haya dicho al pasar o en otra sección.",
  "Si no conoce o no ha utilizado ComplianceLatam, explora brevemente por qué y pasa a sus necesidades. No fuerces ejemplos de uso que no existen.",
  "Explora necesidades de su rol legal aunque no estén directamente relacionadas con compliance.",
  "Reserva un minuto para el cierre y registra una sola mejora principal expresada por la persona.",
  "No inventes respuestas ni conviertas un asunto no explorado en una respuesta negativa. Si no se abordó, queda como no explorado.",
  "Habla de su empresa, no de una firma socia.",
].join(" ");

const APERTURA =
  "Gracias por su tiempo. Queremos entender qué le está aportando ComplianceLatam y cómo podría ser más útil en su trabajo. Nos sirve mucho conocer su experiencia, incluso si hasta ahora ha participado poco. Nos interesa conocer sus necesidades en su rol legal, aunque no estén directamente relacionadas con compliance.";

const CIERRE =
  "Muchas gracias. Esto nos ayuda a entender qué vale la pena mantener y qué necesitamos mejorar para que la red le resulte útil de forma más habitual.";

type GuionColaboradores = {
  titulo: string;
  descripcion: string;
  pregunta: string;
  instrucciones?: string;
  obligatorias?: string[];
  seguimientos?: string[];
};

const GUION_CL_COLABORADORES: GuionColaboradores[] = [
  {
    descripcion: "De lo que conoce o ha utilizado de ComplianceLatam.",
    instrucciones: `Para abrir, di esto antes de la pregunta principal, una sola vez: ${APERTURA} Si la persona no conoce o no ha utilizado la red, explora brevemente por qué y no pidas ejemplos de un uso que no existió.`,
    pregunta:
      "De lo que conoce o ha utilizado de ComplianceLatam, ¿qué le ha resultado útil —si es que algo— en su trabajo?",
    seguimientos: [
      "Si no queda claro cuánto conoce la red: ¿Qué conoce de ComplianceLatam y de lo que puede aprovechar como colaborador?",
      "Si responde en general: ¿Recuerda alguna actividad, contenido o conexión que haya aprovechado? ¿Para qué le sirvió?",
      "Si menciona algo valioso: De eso que cuenta, ¿qué es imprescindible mantener?",
      "Si no ha encontrado valor o ha participado poco: ¿Ha habido algo que no le resultara útil o no le diera suficientes razones para participar?",
    ],
    titulo: "Conocimiento, uso y valor actual",
  },
  {
    descripcion: "Una necesidad reciente de su trabajo.",
    instrucciones:
      "Explora necesidades de su rol legal aunque no sean de compliance. Si necesita ejemplos, ofrécelos como posibilidades y no como hechos suyos: una consulta legal en otro país, un cambio normativo o una decisión para la que necesitaba conocer la experiencia de otros equipos legales. Si no conoce la red, no inventes que la usó.",
    pregunta:
      "Pensando en su trabajo como abogado in-house, ¿cuál fue el último tema en que necesitó apoyo o información de fuera de su equipo?",
    seguimientos: [
      "Si no recuerda un caso concreto: ¿Qué desafío de su trabajo le está quitando más tiempo o le está costando resolver hoy?",
      "Si no explica cómo lo abordó: ¿A quién o a qué recurrió? ¿Qué le costó más encontrar o sigue sin resolver?",
      "Si no queda claro el posible aporte de la red: ¿En qué parte de ese desafío le habría servido el apoyo de una red como ComplianceLatam?",
      "Si no menciona ComplianceLatam: ¿Llegó a considerar recurrir a ComplianceLatam? ¿Qué influyó en esa decisión?",
    ],
    titulo: "Necesidades y relevancia para su trabajo",
  },
  {
    descripcion: "Su vínculo con la red y cómo se entera de lo que ofrece.",
    instrucciones:
      "Haz siempre las dos preguntas de información y acceso, salvo que ya estén respondidas. No consumen el cupo de seguimientos opcionales. Si necesita ejemplos, distingue entre recibir novedades —correo, WhatsApp u otro canal— y aprovechar lo que ofrece la red —consultar materiales, inscribirse en actividades o contactar a una persona—.",
    obligatorias: [
      "¿Cómo se entera hoy de lo que ofrece ComplianceLatam? ¿La información le llega a tiempo y le permite reconocer qué le puede servir?",
      "Cuando algo le interesa, ¿cómo le gustaría acceder a ese contenido, actividad o contacto?",
    ],
    pregunta: "¿Cómo describiría su vínculo con ComplianceLatam hoy?",
    seguimientos: [
      "Si no queda claro cómo funcionan los canales actuales: Piense en la última comunicación que recibió de la red: ¿qué hizo después de verla?",
      "Si no concreta sus preferencias: ¿Qué tipo de información le gustaría recibir y con qué frecuencia?",
      "Si menciona dificultades para acceder: ¿En qué paso se le complicó y qué lo habría hecho más fácil?",
      "Si participa poco y no explica por qué: La última vez que recibió una invitación y no participó, ¿qué lo frenó?",
      "Si no dice qué lo motivaría a participar: ¿Qué tendría que pasar para que quisiera participar con más frecuencia?",
      "Si muestra interés en aportar: ¿En qué tema le gustaría compartir su experiencia? ¿Qué formato y dedicación le resultarían viables?",
    ],
    titulo: "Comunidad, participación y acceso",
  },
  {
    descripcion: "Una sola prioridad para los próximos 12 meses.",
    instrucciones: `Pregunta siempre esta mejora. Registra una sola mejora principal, con las palabras de la persona. No conviertas lo no explorado en una respuesta negativa. Después de su respuesta, di: ${CIERRE}`,
    pregunta:
      "Si ComplianceLatam pudiera mejorar una sola cosa durante los próximos 12 meses, ¿cuál debería ser?",
    titulo: "Una prioridad",
  },
];

export function esFaseColaboradores(fase: { nombre: string }) {
  return fase.nombre.trim() === NOMBRE_FASE_COLABORADORES;
}

export function seccionesDeGuionClColaboradores(): SeccionEntrevista[] {
  return GUION_CL_COLABORADORES.map((seccion) => ({
    descripcion: seccion.descripcion,
    etiquetaOrganizacion: "empresa" as const,
    id: crypto.randomUUID(),
    ...(seccion.instrucciones ? { instrucciones: seccion.instrucciones } : {}),
    ...(seccion.obligatorias
      ? { obligatorias: [...seccion.obligatorias] }
      : {}),
    preguntas: [seccion.pregunta],
    ...(seccion.seguimientos
      ? { seguimientos: [...seccion.seguimientos] }
      : {}),
    titulo: seccion.titulo,
  }));
}
