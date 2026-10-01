import type {
  EscuchaEntrevista,
  SeccionEntrevista,
  TratoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import type { InicioEnChat } from "@/lib/consultoria/inicio-en-chat";

/** ETM Tuesday on the Majoriti portal. Approved five-question conversation. */

export const SLUG_ETM_TUESDAY = "etm-tuesday";

export const NOMBRE_PUBLICO_ETM = "ETM Tuesday";

export const CLIENTE_ETM = "Emprendetumente";

/** Approved: tú, close and professional. */
export const TRATO_ETM: TratoEntrevista = "tu";

export const MAX_SEGUIMIENTOS_ETM = 1;

export const NOMBRE_FASE_MENTORES = "Mentores ETM Tuesday";

export const NOMBRE_FASE_MENTOREADOS = "Mentoreados ETM Tuesday";

export const NOMBRE_FASE_SPONSORS = "Sponsors ETM Tuesday";

export const FASES_ETM_TUESDAY = [
  NOMBRE_FASE_MENTORES,
  NOMBRE_FASE_MENTOREADOS,
  NOMBRE_FASE_SPONSORS,
] as const;

export type AudienciaEtm = "mentores" | "mentoreados" | "sponsors";

export const NOMBRE_PLANTILLA_MENTORES = "Mentores ETM Tuesday";

export const NOMBRE_PLANTILLA_MENTOREADOS = "Mentoreados ETM Tuesday";

export const NOMBRE_PLANTILLA_SPONSORS = "Sponsors ETM Tuesday";

export const TITULO_INICIATIVA_ETM = "Después de ETM Tuesday";

export const CONTACTO_NOMBRE_ETM = "Equipo ETM Tuesday";

export const CONTACTO_EMAIL_ETM = "seba@majoriti.world";

export const TEXTO_BIENVENIDA_MENTORES =
  "Queremos conocer tu experiencia como mentor o mentora en EtM Tuesday: qué te motivó, cómo resultó la conversación y qué ayudaría a que futuras mentorías sean más útiles para ambos.";

export const TEXTO_BIENVENIDA_MENTOREADOS =
  "Queremos conocer cómo viviste tu mentoría en EtM Tuesday: qué necesitabas, qué te llevaste de la conversación y qué podríamos mejorar para otros emprendedores.";

export const TEXTO_BIENVENIDA_SPONSORS =
  "Queremos conocer cómo viviste tu participación como sponsor de EtM Tuesday: qué valor tuvo para tu organización, cómo funcionó la coordinación y qué podríamos mejorar. Conversaremos sobre cinco preguntas breves.";

export function bienvenidaEtm(audiencia: AudienciaEtm) {
  if (audiencia === "mentores") {
    return TEXTO_BIENVENIDA_MENTORES;
  }
  if (audiencia === "mentoreados") {
    return TEXTO_BIENVENIDA_MENTOREADOS;
  }
  return TEXTO_BIENVENIDA_SPONSORS;
}

/** Project fallback. Each phase replaces it with the audience welcome. */
export const TEXTO_BIENVENIDA_ETM = TEXTO_BIENVENIDA_MENTORES;

/**
 * Shown before the person accepts. Names stay attached. The anonymity option
 * from the meeting is described as unavailable, not as a switch.
 */
export const AVISO_RESPUESTAS_ETM = [
  "Tus respuestas quedan asociadas a tu nombre y pueden ser consultadas por Majoriti, que conduce estas entrevistas.",
  "Esta entrevista no es anónima.",
].join("\n");

const ASUNTOS_INVITACION_ETM: Record<AudienciaEtm, string> = {
  mentoreados: "ETM Tuesday: cuéntanos cómo te fue en la mentoría",
  mentores: "ETM Tuesday: cuéntanos cómo te fue como mentor o mentora",
  sponsors: "ETM Tuesday: cuéntanos cómo vivieron su participación",
};

export function asuntoInvitacionEtm(audiencia: AudienciaEtm) {
  return ASUNTOS_INVITACION_ETM[audiencia];
}

/** Project fallback. Each phase sets its own audience subject. */
export const ASUNTO_INVITACION_ETM = ASUNTOS_INVITACION_ETM.mentores;

export const ASUNTO_RECORDATORIO_ETM =
  "ETM Tuesday — te queda pendiente la conversación";

export const ASUNTO_AGRADECIMIENTO_ETM =
  "ETM Tuesday — recibimos tus respuestas";

export const CUERPO_AGRADECIMIENTO_ETM = [
  "Gracias por tomarte el tiempo de conversar con nosotros sobre ETM Tuesday. Recibimos tus respuestas y nos ayudarán a mejorar las próximas ediciones.",
].join("\n\n");

export const CUERPO_RECORDATORIO_ETM = [
  "Te escribimos porque tu conversación sobre ETM Tuesday sigue pendiente.",
  "Puedes retomarla desde el mismo enlace personal, donde la dejaste.",
].join("\n\n");

export const INSTRUCCIONES_AGENTE_ETM = [
  "Habla de tú, cercano y profesional. Una pregunta por turno.",
  "Los seguimientos son ejemplos, no un menú. Formula el seguimiento desde lo que la persona acaba de contar, dentro del objetivo de la pregunta.",
  "Como máximo un seguimiento por pregunta, y solo si la respuesta fue vaga. Una respuesta completa, aunque sea breve, no se profundiza. No insistas solo porque es corta. Si pide aclaración, reformula y no añadas después otra profundización de ese punto.",
  "Si ya respondió un objetivo en un turno anterior, recógelo y no repitas la pregunta. Las cinco preguntas son objetivos de información.",
  "Un «buena pregunta» no es una respuesta. Ayuda a concretar una sola vez, sin abrir un bucle.",
  "Si no sabe, no recuerda o no quiere responder, respétalo y continúa.",
  "No presupongas resultados positivos, participación, contactos ni beneficios.",
  "Distingue lo ya ocurrido, las expectativas y los próximos pasos. No inventes datos para llenar vacíos.",
  "Si al agotar el seguimiento siguen faltando datos, registra esa limitación y avanza. No digas que la información es suficiente solo porque se acabó el cupo.",
  "No repitas «entiendo», «perfecto» ni parafrasees cada respuesta.",
  "No prometas anonimato. Las respuestas quedan asociadas al nombre.",
  "Todas las preguntas son abiertas. No pidas notas, puntuaciones, escalas ni recomendaciones numéricas.",
  "No digas que la entrevista terminó ni que puede enviarla. Eso queda solo para el turno de cierre, cuando ya no hay otra pregunta.",
].join(" ");

type ObjetivoEtm = {
  ejemplo: string;
  nota?: string;
  pregunta: string;
};

const OBJETIVOS: Record<
  AudienciaEtm,
  { nota: string; objetivos: ObjetivoEtm[] }
> = {
  mentoreados: {
    nota: "",
    objetivos: [
      {
        ejemplo: "¿Pudiste trabajar ese tema durante la conversación?",
        pregunta:
          "¿Qué necesitabas resolver o explorar cuando llegaste a la mentoría?",
      },
      {
        ejemplo:
          "¿Qué hizo que te sintieras bien acompañado o que te faltara apoyo?",
        pregunta: "¿Cómo encajó tu mentor o mentora con lo que necesitabas?",
      },
      {
        ejemplo:
          "¿Te abrió acceso a algún conocimiento, contacto u oportunidad que antes no tenías?",
        pregunta: "¿Qué fue lo más valioso que te llevaste de la conversación?",
      },
      {
        ejemplo:
          "¿Quedó acordado algún contacto o seguimiento con tu mentor para avanzar?",
        pregunta:
          "Después de la mentoría, ¿qué decisión o próximo paso te quedó más claro, si alguno?",
      },
      {
        ejemplo: "¿Qué sería lo más importante para ti?",
        pregunta:
          "¿Qué tendría que mantenerse o cambiar para que recomendaras esta experiencia a otro emprendedor?",
      },
    ],
  },
  mentores: {
    nota: "Recoge señales concretas de utilidad. No atribuyas un impacto posterior en el emprendimiento que el mentor todavía no puede conocer.",
    objetivos: [
      {
        ejemplo: "¿Encontraste en la experiencia lo que buscabas?",
        pregunta:
          "¿Qué te motivó a participar como mentor o mentora en este EtM Tuesday?",
      },
      {
        ejemplo:
          "¿Puedes contar un momento que muestre ese encaje o desajuste?",
        pregunta:
          "¿Cómo encajó tu experiencia con lo que necesitaba la persona que acompañaste?",
      },
      {
        ejemplo: "¿Qué dijo o hizo que te dio esa impresión?",
        pregunta:
          "¿En qué momento sentiste que la conversación fue más útil para la persona que acompañaste, si hubo alguno?",
      },
      {
        ejemplo: "¿Cómo habría cambiado la conversación contar con eso?",
        pregunta:
          "¿Qué dificultó la mentoría o te habría ayudado a aportar más?",
      },
      {
        ejemplo: "¿Qué sería lo principal que EtM debería mantener o cambiar?",
        pregunta:
          "¿Qué influiría en tu decisión de volver a participar como mentor o mentora?",
      },
    ],
  },
  sponsors: {
    nota: "La entrevista se enviará al día siguiente. La difusión posterior en redes podría no haber ocurrido; distingue lo observado de lo esperado y no pidas evaluarla como si ya hubiera sucedido.",
    objetivos: [
      {
        ejemplo: "¿Qué ocurrió que te hizo sentir así?",
        pregunta:
          "¿Qué buscaban conseguir al participar como sponsors y cómo se compara la experiencia con esa expectativa?",
      },
      {
        ejemplo:
          "¿Hubo algún contacto, reunión u oportunidad concreta que valga la pena destacar?",
        pregunta:
          "¿Qué fue lo más valioso que se llevaron de su participación?",
      },
      {
        ejemplo:
          "¿Qué tuvo más valor para ustedes: la presencia en el evento, las conversaciones o la difusión en redes?",
        pregunta:
          "¿Qué aportó el evento a cómo quieren posicionarse en el ecosistema de emprendimiento, innovación e inversión?",
      },
      {
        ejemplo:
          "¿Hubo algún momento en que la coordinación o la información les dificultara las cosas?",
        pregunta:
          "¿Cómo fue trabajar con el equipo de EtM para preparar y realizar su participación?",
      },
      {
        ejemplo: "¿Qué les permitiría conseguir ese cambio?",
        pregunta:
          "Si pudieras cambiar una sola cosa para que la próxima participación fuera más valiosa, ¿cuál sería?",
      },
    ],
  },
};

const INVITACION_ETM: Record<AudienciaEtm, string> = {
  mentoreados:
    "En ETM Tuesday queremos conocer cómo viviste tu mentoría: qué necesitabas, qué te llevaste de la conversación y qué podríamos mejorar para otros emprendedores.",
  mentores:
    "En ETM Tuesday queremos conocer tu experiencia como mentor o mentora: qué te motivó a participar, cómo resultó la conversación y qué te habría ayudado a aportar más.",
  sponsors:
    "En ETM Tuesday queremos conocer cómo vivieron su participación como sponsors: qué valor tuvo para tu organización, cómo funcionó la coordinación y qué podríamos mejorar.",
};

export function cuerpoInvitacionEtm(audiencia: AudienciaEtm) {
  return [
    INVITACION_ETM[audiencia],
    "Son cinco preguntas, una por vez, con el asistente de entrevistas de ETM Tuesday. Puedes guardar tu avance y continuar más adelante desde el mismo enlace, o terminar cuando quieras.",
    "Tus respuestas quedan asociadas a tu nombre y pueden ser consultadas por Majoriti, que conduce estas entrevistas.",
  ].join("\n\n");
}

const PROPOSITO_ETM: Record<AudienciaEtm, string> = {
  mentoreados:
    "Queremos conocer cómo viviste la mentoría, qué te llevaste y qué podríamos mejorar.",
  mentores:
    "Queremos conocer tu experiencia como mentor o mentora: qué te motivó, cómo resultó la conversación y qué te habría ayudado a aportar más.",
  sponsors:
    "Queremos conocer cómo vivieron su participación como sponsors: qué valor tuvo para tu organización, cómo funcionó la coordinación y qué podríamos mejorar.",
};

/** What a bare "no participé" can refer to, and the objectives it voids. */
const EXPERIENCIA_ETM: Record<
  AudienciaEtm,
  { actividad: string; requierenExperiencia: number[] }
> = {
  mentoreados: {
    actividad: "la conversación de mentoría",
    requierenExperiencia: [1, 2, 3, 4],
  },
  mentores: {
    actividad: "la conversación de mentoría",
    requierenExperiencia: [1, 2, 3],
  },
  sponsors: {
    actividad: "participación en el evento",
    requierenExperiencia: [1, 2],
  },
};

/** Duration stays unset until timed with real people. Nothing here promises anonymity. */
export function inicioEnChatEtm(audiencia: AudienciaEtm): InicioEnChat {
  return {
    asistente: "el asistente de entrevistas de EtM Tuesday",
    duracionMinutos: null,
    ia: [
      {
        icono: "asistente",
        texto:
          "Te hace las preguntas y conversa contigo por escrito. No es una persona.",
        titulo: "Hablas con un asistente de IA",
      },
      {
        icono: "pauta",
        texto:
          "Las preguntas vienen de una guía preparada para EtM Tuesday. El asistente adapta las repreguntas a lo que cuentas.",
        titulo: "Sigue una pauta de EtM Tuesday",
      },
      {
        icono: "corregir",
        texto:
          "Puede interpretar mal algo de lo que dijiste. Si pasa, corrígelo en tu siguiente respuesta.",
        titulo: "Puede equivocarse",
      },
      {
        icono: "guardado",
        texto:
          "Puedes guardar y volver desde el mismo enlace, o terminar antes. Nada se envía sin que lo confirmes.",
        titulo: "Tú decides cuándo terminar",
      },
    ],
    privacidad: [
      {
        icono: "personas",
        texto:
          "Pueden ser consultadas por Majoriti, que conduce estas entrevistas y guarda la conversación en su plataforma.",
        titulo: "Quién ve tus respuestas",
      },
      {
        icono: "nombre",
        texto:
          "Tus respuestas quedan vinculadas a tu nombre. Esta entrevista no es anónima.",
        titulo: "Asociadas a tu nombre",
      },
      {
        icono: "guardado",
        texto:
          "Se guarda el texto de la conversación, para entender tu experiencia y mejorar las próximas ediciones.",
        titulo: "Qué se guarda y para qué",
      },
      {
        icono: "asistente",
        texto:
          "Para conducir la conversación, lo que escribes se procesa con modelos de IA de terceros (xAI y OpenAI) a través de Vercel. Si respondes con la voz, OpenAI transcribe el audio.",
        titulo: "Quién procesa el texto",
      },
    ],
    proposito: PROPOSITO_ETM[audiencia],
    respuestaFuncionamiento:
      "Soy un asistente de IA. Te haré cinco preguntas breves, una por vez, y a veces una repregunta corta. Puedes guardar y seguir desde este enlace, o terminar cuando quieras. Al final te pediré confirmar el envío. Tienes más detalle en «Cómo funciona la IA», bajo el campo de respuesta.",
    respuestaPrivacidad:
      "Tus respuestas quedan asociadas a tu nombre y pueden ser consultadas por Majoriti, que conduce estas entrevistas. No es anónima. Tienes más detalle en «Tu privacidad», bajo el campo de respuesta.",
    usoRespuestas:
      "Al comenzar, aceptas que tus respuestas queden asociadas a tu nombre y que puedan ser consultadas por Majoriti.",
  };
}

/** Listening mode with pinned models, so ETM does not move with the global chat model. */
export const ESCUCHA_ETM: EscuchaEntrevista = {
  modeloAgente: "xai/grok-4.1-fast-non-reasoning",
  modeloLectura: "openai/gpt-5.4-mini",
};

export function seccionesDeGuionEtm(
  audiencia: AudienciaEtm
): SeccionEntrevista[] {
  const guion = OBJETIVOS[audiencia];
  return [
    {
      ...EXPERIENCIA_ETM[audiencia],
      conversacionContinua: true,
      descripcion: "",
      escucha: { ...ESCUCHA_ETM },
      etiquetaOrganizacion: "empresa",
      id: crypto.randomUUID(),
      inicioEnChat: inicioEnChatEtm(audiencia),
      instrucciones: guion.nota,
      maxSeguimientos: MAX_SEGUIMIENTOS_ETM,
      preguntas: guion.objetivos.map((objetivo) => objetivo.pregunta),
      seguimientos: guion.objetivos.map((objetivo) => objetivo.ejemplo),
      titulo: "Conversación",
    },
  ];
}

export function preguntasPrincipalesEtm(audiencia: AudienciaEtm) {
  return OBJETIVOS[audiencia].objetivos.map((objetivo) => objetivo.pregunta);
}

export function faseDeAudiencia(audiencia: AudienciaEtm) {
  if (audiencia === "mentores") {
    return {
      nombre: NOMBRE_FASE_MENTORES,
      orden: 1,
      plantilla: NOMBRE_PLANTILLA_MENTORES,
    };
  }
  if (audiencia === "mentoreados") {
    return {
      nombre: NOMBRE_FASE_MENTOREADOS,
      orden: 2,
      plantilla: NOMBRE_PLANTILLA_MENTOREADOS,
    };
  }
  return {
    nombre: NOMBRE_FASE_SPONSORS,
    orden: 3,
    plantilla: NOMBRE_PLANTILLA_SPONSORS,
  };
}
