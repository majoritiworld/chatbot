import type {
  SeccionEntrevista,
  TratoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import type { GuionSeccion } from "@/lib/consultoria/guiones/compliance-latam-fase-1";

export const NOMBRE_PLANTILLA_CL_FASE_2 = "Entrevista a firmas socias — Fase 2";

export const MINUTOS_CL_FASE_2 = 30;

export const TRATO_CL_FASE_2: TratoEntrevista = "usted";

export const INSTRUCCIONES_AGENTE_CL_FASE_2 = [
  "Haz la pregunta principal y deja espacio para responder. Consérvala en usted, como está escrita.",
  "Los seguimientos son un menú: elige como máximo dos por sección, solo para cubrir información clave que no haya surgido. Hazlos de a uno, adaptando las palabras a lo que la persona acaba de contar. Si un tema ya fue respondido, no lo vuelvas a preguntar.",
  "Prioriza ejemplos de lo que ocurrió en la práctica. No presupongas falta de participación ni uso incorrecto.",
  "No interpretes la falta de mención como falta de uso o participación. Si un tema no se abordó, regístralo como “no explorado”.",
  "Distingue entre lo que la persona conoce directamente y lo que supone sobre otros integrantes de su firma.",
].join(" ");

const APERTURA =
  "Gracias por hacerse este espacio. Nos gustaría entender cómo les ha ido con ComplianceLatam: qué les ha servido, qué les ha costado aprovechar y qué podríamos mejorar. La idea es conversar con franqueza, pensando sobre todo en lo que han vivido durante el último año.";

const CIERRE =
  "Gracias por compartir su experiencia con franqueza. Sus respuestas nos ayudarán a entender qué está aportando valor, qué dificulta la participación y qué cambios conviene priorizar para las firmas socias de ComplianceLatam.";

type GuionSeccionConSeguimientos = GuionSeccion & {
  instrucciones?: string;
  seguimientos: string[];
};

function armarSeccion({
  descripcion,
  instrucciones,
  pregunta,
  seguimientos,
  titulo,
}: {
  titulo: string;
  descripcion: string;
  pregunta: string;
  seguimientos: string[];
  instrucciones?: string;
}): GuionSeccionConSeguimientos {
  return {
    descripcion,
    ...(instrucciones ? { instrucciones } : {}),
    preguntas: [pregunta],
    seguimientos,
    titulo,
  };
}

export const GUION_CL_FASE_2: GuionSeccionConSeguimientos[] = [
  armarSeccion({
    descripcion:
      "Conversaremos sobre lo que ComplianceLatam aporta a su firma en la práctica.",
    instrucciones: `Para abrir, di esto antes de la pregunta principal: ${APERTURA}`,
    pregunta:
      "Si su firma dejara de pertenecer a ComplianceLatam mañana, ¿qué perdería en la práctica?",
    seguimientos: [
      "Si no menciona resultados concretos: ¿Recuerda alguna situación del último año en la que estar en la red haya hecho una diferencia para la firma?",
      "Si menciona un contacto o referido, pero no su resultado: ¿En qué terminó esa oportunidad? ¿Llegó a convertirse en trabajo para la firma?",
      "Si no queda claro el aporte de la red: ¿Cree que eso habría ocurrido de todas maneras o fue posible gracias a ComplianceLatam?",
      "Si no explica cómo se registra el valor: ¿Tienen alguna forma de registrar esos resultados o quedan en conocimiento de quienes participaron?",
    ],
    titulo: "Valor de la red",
  }),
  armarSeccion({
    descripcion:
      "Nos interesa saber qué tanto se conoce ComplianceLatam dentro de su firma y quiénes participan en la red.",
    instrucciones:
      "En esta sección, prioriza cubrir la participación de otros equipos. Si ese tema ya surgió, usa los seguimientos para profundizar en otros aspectos.",
    pregunta: "¿Qué tanto se conoce ComplianceLatam dentro de su firma?",
    seguimientos: [
      "Prioritario, si no explica quiénes participan: Además de los socios que representan a la firma, ¿qué otros equipos participan en las actividades de la red y qué hacen concretamente?",
      "Si no precisa qué conocen: ¿Diría que conocen solo el nombre o también lo que ofrece la red y cómo pueden aprovecharla?",
      "Si no distingue entre personas o áreas: ¿Ese conocimiento está extendido entre los socios y equipos o se concentra en quienes participan directamente?",
      "Si no habla del valor percibido por otros: Por lo que ha conversado con otros socios, ¿qué valor le ven a pertenecer a la red?",
      "Si no explica cómo se demuestra ese valor: ¿Qué resultados han podido mostrar dentro de la firma y qué reacción han generado?",
      "Si no explica cómo circula la información: Cuando ocurre algo valioso en la red, ¿cómo se enteran los demás?",
    ],
    titulo: "Conocimiento y participación dentro de la firma",
  }),
  armarSeccion({
    descripcion:
      "Veremos cómo aprovechan hoy la membresía y qué les dificulta sacarle más provecho.",
    instrucciones:
      "En esta sección, prioriza cubrir el uso de herramientas de la red. Si ese tema ya surgió, usa los seguimientos para profundizar en otros aspectos.",
    pregunta:
      "¿Cómo están aprovechando hoy la membresía y qué les dificulta sacarle más provecho?",
    seguimientos: [
      "Prioritario, si no describe el uso de herramientas: ¿Qué medios o herramientas de ComplianceLatam utilizan para coordinar su participación? Cuénteme cómo los usaron la última vez.",
      "Si dice que no utilizan esas herramientas y no explica por qué: ¿Qué explica que no las estén utilizando?",
      "Si responde en términos generales: Pensemos en la última actividad u oportunidad en la que no participaron. ¿Qué pasó?",
      "Si no queda claro cuánto usan la red: ¿Cuál fue la última vez que alguien de la firma recurrió a ComplianceLatam y para qué?",
      "Si no distingue qué tendría que cambiar: Para resolver eso, ¿qué necesitarían de ComplianceLatam y qué tendrían que ajustar ustedes?",
      "Si considera que ya la aprovechan bien: ¿Qué les ha funcionado para mantener esa participación? ¿Hay algo que todavía quisieran aprovechar más?",
    ],
    titulo: "Uso y barreras",
  }),
  armarSeccion({
    descripcion:
      "Hablaremos del compromiso que cabe esperar de una firma socia y de cómo se compara con lo que hacen hoy.",
    instrucciones:
      "En esta sección, prioriza cubrir los aportes de contenido o iniciativas. Si ese tema ya surgió, usa los seguimientos para profundizar en otros aspectos.",
    pregunta:
      "¿Qué compromiso sería razonable esperar de una firma que pertenece a ComplianceLatam y cómo se compara eso con lo que ustedes hacen hoy?",
    seguimientos: [
      "Prioritario, si no menciona aportes para dar visibilidad a la firma: Durante el último año, ¿qué contenido o iniciativas han compartido para que se difundan a través de ComplianceLatam?",
      "Si responde en términos generales: En la práctica, ¿qué debería aportar cualquier firma socia, incluso en un período de mucho trabajo?",
      "Si no aterriza la respuesta a su firma: De eso que menciona, ¿qué están haciendo ustedes y qué les está costando sostener?",
      "Si no concreta un compromiso posible: Pensando en los próximos tres meses, ¿qué podrían comprometerse a aportar y quién se encargaría?",
      "Si no aborda el seguimiento de oportunidades: Cuando reciben un referido o hacen una conexión, ¿cómo podrían compartir qué pasó después sin que se vuelva una carga?",
    ],
    titulo: "Responsabilidades y compromiso",
  }),
  armarSeccion({
    descripcion:
      "Para terminar, conversaremos sobre la renovación de la membresía y su precio.",
    instrucciones: `Al cerrar esta última sección, después de la conversación, di: ${CIERRE}`,
    pregunta:
      "Si hoy tuviera que defender el pago de la membresía frente a sus socios, ¿cuál sería su argumento más fuerte y dónde le costaría más convencerlos?",
    seguimientos: [
      "Si no explica cómo se decide: ¿Quién tiene la última palabra sobre la renovación y qué pesa más para esa persona?",
      "Si no identifica evidencia o materiales necesarios: ¿Qué le ayudaría a llegar mejor preparado a esa conversación: cifras, casos concretos, un resumen de resultados u otra cosa?",
      "Si no menciona otras prioridades: ¿Con qué otras alianzas o gastos se compara la membresía cuando se discute el presupuesto?",
      "Si no evalúa la cuota actual: Con lo que reciben hoy, ¿cómo sienten el monto que pagan? ¿Qué les hace verlo así?",
      "Si no aborda el criterio para fijar tarifas: Si hubiera que definir las cuotas entre las firmas, ¿qué tendría sentido tener en cuenta para que fueran justas?",
    ],
    titulo: "Renovación y precio",
  }),
];

export function minutosSiEsGuionClFase2(titulos: string[]) {
  const esperados = GUION_CL_FASE_2.map((item) => item.titulo);
  if (titulos.join("\n") !== esperados.join("\n")) {
    return null;
  }
  return MINUTOS_CL_FASE_2;
}

export function seccionesDeGuionClFase2(): SeccionEntrevista[] {
  return GUION_CL_FASE_2.map((seccionGuion) => ({
    descripcion: seccionGuion.descripcion,
    id: crypto.randomUUID(),
    ...(seccionGuion.instrucciones
      ? { instrucciones: seccionGuion.instrucciones }
      : {}),
    preguntas: [...seccionGuion.preguntas],
    seguimientos: [...seccionGuion.seguimientos],
    titulo: seccionGuion.titulo,
  }));
}
