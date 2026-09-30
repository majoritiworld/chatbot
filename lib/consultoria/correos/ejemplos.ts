import {
  evaluarAsignacionCorreo,
  type FilasAsignacionCorreo,
} from "@/lib/consultoria/correos/asignacion";
import {
  crearEnlaceAcceso,
  type ModoAcceso,
} from "@/lib/consultoria/correos/enlace-acceso";
import {
  type CorreoPreparado,
  correoConfirmacion,
  correoInvitacion,
  type TipoCorreo,
} from "@/lib/consultoria/correos/variantes";

/** Fictitious data for local previews only. Nothing here is a real person. */

const ENTREVISTA_EJEMPLO = "30000000-0000-4000-8000-000000000001";
const PROYECTO_EJEMPLO = "30000000-0000-4000-8000-000000000002";
const BARRA_FINAL = /\/$/;

type Ejemplo = {
  etiqueta: string;
  filas: FilasAsignacionCorreo;
  id: string;
  logo: string | null;
};

function filas({
  fase,
  proyecto,
  stakeholder,
}: {
  fase?: FilasAsignacionCorreo["fase"];
  proyecto: Omit<NonNullable<FilasAsignacionCorreo["proyecto"]>, "id">;
  stakeholder: { apellido?: string; email: string; nombre: string };
}): FilasAsignacionCorreo {
  return {
    entrevistaId: ENTREVISTA_EJEMPLO,
    fase: fase ? { ...fase, proyecto_id: PROYECTO_EJEMPLO } : null,
    plantillaProyectoId: PROYECTO_EJEMPLO,
    proyecto: { ...proyecto, id: PROYECTO_EJEMPLO },
    stakeholder: { ...stakeholder, proyecto_id: PROYECTO_EJEMPLO },
  };
}

export const EJEMPLOS_CORREO: Ejemplo[] = [
  {
    etiqueta: "ComplianceLatam",
    filas: filas({
      fase: {
        bloque_comercial:
          "Esta entrevista fue diseñada junto a Majoriti.\n\n¿Se imagina escuchar así a sus clientes, equipos o socios? Conozca cómo convertir sus experiencias en información para decidir mejor.",
        bloque_comercial_etiqueta: "Conocer Majoriti",
        bloque_comercial_url: "https://majoriti.world",
        minutos: 15,
      },
      proyecto: {
        color_principal: "#0f4c81",
        contacto_email: "equipo@compliancelatam.example",
        contacto_nombre: "Equipo ComplianceLatam",
        logo_path: "ejemplo.png",
        nombre_publico: "ComplianceLatam",
        slug: "compliance-latam-ejemplo",
        titulo_iniciativa: "Estudio de cumplimiento 2026",
      },
      stakeholder: {
        apellido: "Ejemplo",
        email: "ana.ejemplo@example.com",
        nombre: "Ana",
      },
    }),
    id: "compliance-latam",
    logo: "/images/correos-ejemplo/compliance-latam.svg",
  },
  {
    etiqueta: "Andes Retail",
    filas: filas({
      fase: { minutos: 20 },
      proyecto: {
        color_principal: "#c2410c",
        contacto_email: "personas@andesretail.example",
        contacto_nombre: "Marta Prueba",
        logo_path: "ejemplo.png",
        nombre_publico: "Andes Retail",
        slug: "andes-retail-ejemplo",
        titulo_iniciativa: "Voz de las tiendas",
      },
      stakeholder: { email: "luis.ejemplo@example.com", nombre: "Luis" },
    }),
    id: "otro-cliente",
    logo: "/images/correos-ejemplo/andes-retail.svg",
  },
  {
    etiqueta: "Cliente sin logo ni color",
    filas: filas({
      proyecto: {
        cliente: "Cooperativa del Sur",
        contacto_email: "contacto@cooperativadelsur.example",
        nombre_publico: null,
        slug: "cooperativa-del-sur-ejemplo",
      },
      stakeholder: { email: "sofia.ejemplo@example.com", nombre: "Sofía" },
    }),
    id: "sin-logo",
    logo: null,
  },
  {
    etiqueta: "Nombre y contenido largos",
    filas: filas({
      fase: {
        correo_cuerpo:
          "Queremos agradecerle muy especialmente el tiempo y la dedicación que puso en esta conversación. Sus respuestas son parte central del diagnóstico que estamos construyendo junto a las distintas áreas de la organización en los ocho países de la región.\n\nEn las próximas semanas consolidaremos todas las entrevistas, prepararemos un informe con los hallazgos principales y lo compartiremos con los equipos directivos para definir prioridades de trabajo para el próximo ciclo.",
        invitacion_cuerpo:
          "La Federación Latinoamericana de Asociaciones de Empresas de Servicios Profesionales está preparando un diagnóstico amplio sobre prácticas de gestión, cultura y colaboración en sus organizaciones miembro, y su experiencia es muy valiosa para ese trabajo.\n\nLa conversación es confidencial y sus respuestas se analizarán en conjunto con las del resto de participantes.",
        minutos: 25,
      },
      proyecto: {
        color_principal: "#f5d547",
        contacto_email:
          "coordinacion.diagnostico.regional@federacion-latinoamericana.example",
        contacto_nombre: "Coordinación del Diagnóstico Regional",
        nombre_publico:
          "Federación Latinoamericana de Asociaciones de Empresas de Servicios Profesionales",
        slug: "federacion-ejemplo",
        titulo_iniciativa:
          "Diagnóstico regional de prácticas de gestión, cultura organizacional y colaboración 2026",
      },
      stakeholder: {
        apellido: "de los Ríos Etcheverry",
        email: "maria.fernanda.ejemplo@example.com",
        nombre: "María Fernanda <b>Prueba</b>",
      },
    }),
    id: "largo",
    logo: null,
  },
];

export function ejemploCorreo(id: string | null | undefined) {
  return (
    EJEMPLOS_CORREO.find((ejemplo) => ejemplo.id === id) ??
    EJEMPLOS_CORREO.at(0)
  );
}

/** Never a stored token: the preview link does not open any interview. */
const TOKEN_VISTA_PREVIA = "vista-previa-enlace-personal";

export function correoParaVistaPrevia({
  acceso,
  filasAsignacion,
  imagenes,
  logo,
  permitirLocal,
  site,
  tipo,
}: {
  /** Defaults to what the phase is set to. */
  acceso?: ModoAcceso;
  filasAsignacion: FilasAsignacionCorreo;
  imagenes: boolean;
  logo: string | null | undefined;
  permitirLocal: boolean;
  site: string;
  tipo: TipoCorreo;
}): CorreoPreparado | { error: string } {
  const resultado = evaluarAsignacionCorreo(filasAsignacion, {
    permitirLocal,
    site,
  });
  if (!resultado.ok) {
    return { error: resultado.motivo };
  }
  const { asignacion } = resultado;
  const origen = site.replace(BARRA_FINAL, "");
  let { logoUrl } = asignacion.identidad;
  if (logo !== undefined) {
    logoUrl = logo ? `${origen}${logo}` : null;
  }
  if (!imagenes && logoUrl) {
    logoUrl = `${origen}/imagen-bloqueada.png`;
  }
  const identidad = { ...asignacion.identidad, logoUrl };

  if (tipo === "confirmacion") {
    return correoConfirmacion({
      destinatario: asignacion.destinatario,
      identidad,
      siguientePaso: asignacion.textos.siguientePaso,
      textos: asignacion.textos.confirmacion,
    });
  }
  const modo =
    acceso ?? (asignacion.accesoEnlacePersonal ? "enlace_personal" : "codigo");
  const enlace = crearEnlaceAcceso({
    entrevistaId: asignacion.entrevistaId,
    permitirLocal,
    site,
    slug: asignacion.slug,
    token: modo === "enlace_personal" ? TOKEN_VISTA_PREVIA : null,
  });
  if (!enlace) {
    return { error: "origen_no_autorizado" };
  }
  return correoInvitacion({
    destinatario: asignacion.destinatario,
    enlace,
    identidad,
    minutos: asignacion.minutos,
    textos: asignacion.textos.invitacion,
  });
}
