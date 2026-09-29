import {
  type AlmacenCarga,
  type DestinoCarga,
  type IdentidadConocida,
  type ParticipanteCarga,
  planificarCarga,
} from "@/lib/consultoria/carga-participantes";
import { NOMBRE_PLANTILLA_CL_FASE_2 } from "@/lib/consultoria/guiones/compliance-latam-fase-2";

/**
 * Prepared roster for ComplianceLatam phase 2. Planning reads it.
 * Nothing here is written to the database.
 */
export const DESTINO_CL_FASE_2 = {
  faseNombre: "Entrevistas a Firmas Socias",
  faseOrden: 2,
  plantillaNombre: NOMBRE_PLANTILLA_CL_FASE_2,
} as const;

export const PARTICIPANTES_CL_FASE_2: ParticipanteCarga[] = [
  {
    cargo: "Socia",
    correo: "mlapetina@milchev.com",
    firma: "Miller & Chevalier",
    nombre: "María Lapetina",
    pais: "Estados Unidos",
  },
  {
    cargo: "Socio",
    correo: "mpinatte@cpb-abogados.com.pe",
    firma: "CPB Abogados",
    nombre: "Mario Pinatte",
    pais: "Perú",
  },
  {
    cargo: "Socio",
    correo: "piparraguirre@cpb-abogados.com.pe",
    firma: "CPB Abogados",
    nombre: "Pía Iparraguirre",
    pais: "Perú",
  },
  {
    cargo: "Socio",
    correo: "jtristan@blplegal.com",
    firma: "BLP",
    nombre: "Juan Carlos Tristan",
    pais: "Costa Rica",
  },
  {
    cargo: "Socio",
    correo: "alrojas@blplegal.com",
    firma: "BLP",
    nombre: "Alejandro Rojas",
    pais: "Costa Rica",
  },
  {
    cargo: "Socio",
    correo: "lweinstok@blplegal.com",
    firma: "BLP",
    nombre: "Leon Weinstok",
    pais: "Costa Rica",
  },
  {
    cargo: "Socia",
    correo: "cdiab@blplegal.com",
    firma: "BLP",
    nombre: "Carolina Diab",
    pais: "Guatemala",
  },
  {
    cargo: "Socio",
    correo: "barrios@blplegal.com",
    firma: "BLP",
    nombre: "Federico Barrios",
    pais: "Nicaragua",
  },
  {
    cargo: "Socio",
    correo: "lruiz@blplegal.com",
    firma: "BLP",
    nombre: "Luis Ruiz",
    pais: "Guatemala",
  },
  {
    cargo: "Socio",
    correo: "lvega@blplegal.com",
    firma: "BLP",
    nombre: "Luis Vega",
    pais: "El Salvador",
  },
  {
    cargo: "Managing Partner",
    correo: "mrfabara@bustamantefabara.com",
    firma: "Bustamante Fabara",
    nombre: "María Rosa Fabara",
    pais: "Ecuador",
  },
  {
    cargo: "Socio",
    correo: "dcastelo@bustamantefabara.com",
    firma: "Bustamante Fabara",
    nombre: "Daniel Castelo",
    pais: "Ecuador",
  },
  {
    cargo: "Socio",
    correo: "dramirez@bustamantefabara.com",
    firma: "Bustamante Fabara",
    nombre: "Diego Ramirez",
    pais: "Ecuador",
  },
  {
    cargo: "Socio",
    correo: "gpapeschi@beccarvarela.com",
    firma: "Beccar Varela",
    nombre: "Gustavo Papeschi",
    pais: "Argentina",
  },
  {
    cargo: "Socio",
    correo: "fgrosso@beccarvarela.com",
    firma: "Beccar Varela",
    nombre: "Francisco Grosso",
    pais: "Argentina",
  },
  {
    cargo: "Socio",
    correo: "jgonzalez@dra.com.ve",
    firma: "D´Empaire",
    nombre: "Jose Valentin Gonzalez",
    pais: "Venezuela",
  },
  {
    cargo: "Asociada Senior",
    correo: "gchaurio@dra.com.ve",
    firma: "D´Empaire",
    nombre: "Gabriela Chaurio",
    pais: "Venezuela",
  },
  {
    cargo: "Socio",
    correo: "ajaquez@rvhb.com",
    firma: "RV&HB",
    nombre: "Ariel Jazquez",
    pais: "Republica Dominicana",
  },
  {
    cargo: "Socio",
    correo: "lfernandez@rvhb.com",
    firma: "RV&HB",
    nombre: "Laura Fernandez",
    pais: "Republica Dominicana",
  },
  {
    cargo: "Socio",
    correo: "jlehtman@btlaw.com",
    firma: "Barnes & thornburg",
    nombre: "Jeff Lethman",
    pais: "Estados Unidos",
  },
  {
    cargo: "Asociado",
    correo: "fgaleano@btlaw.com",
    firma: "Barnes & thornburg",
    nombre: "Facundo Galeano",
    pais: "Estados Unidos",
  },
  {
    cargo: "Socio",
    correo: "jclombardia@bartolomebriones.com",
    firma: "Bartolome & Briones",
    nombre: "Juan Carlos Lombardía",
    pais: "España",
  },
  {
    cargo: "Socio",
    correo: "sbartolome@bartolomebriones.com",
    firma: "Bartolome & Briones",
    nombre: "Salvador Bartolome",
    pais: "España",
  },
  {
    cargo: "MKt y Comunicaciones",
    correo: "ibartolome@bartolomebriones.com",
    firma: "Bartolome & Briones",
    nombre: "Inés Bartolome",
    pais: "España",
  },
  {
    cargo: "Socio",
    correo: "lopez_de_silanes@basham.com.mx",
    firma: "Basham",
    nombre: "Juan José Lopéz",
    pais: "México",
  },
  {
    cargo: "Socio",
    correo: "gvaca@basham.com.mx",
    firma: "Basham",
    nombre: "Gerson Vaca",
    pais: "México",
  },
  {
    cargo: "Counsel",
    correo: "carellano@ferrere.com",
    firma: "Ferrere",
    nombre: "Carla Arellano",
    pais: "Uruguay",
  },
  {
    cargo: "Asociado Senior",
    correo: "dcastagno@ferrere.com",
    firma: "Ferrere",
    nombre: "Diego Castagno",
    pais: "Uruguay",
  },
  {
    cargo: "Socio",
    correo: "jpalza@ferrere.com",
    firma: "Ferrere",
    nombre: "Jorge Palza",
    pais: "Bolivia",
  },
  {
    cargo: "Socio",
    correo: "gjover@ferrere.com",
    firma: "Ferrere",
    nombre: "Guillermo Jover",
    pais: "Paraguay",
  },
  {
    cargo: "Socio",
    correo: "oscar.tutasaura@phrlegal.com",
    firma: "Posse Herrera Ruiz",
    nombre: "Oscar Tutasaura",
    pais: "Colombia",
  },
  {
    cargo: "Asociada Senior",
    correo: "natalia.alarcon@phrlegal.com",
    firma: "Posse Herrera Ruiz",
    nombre: "Natalia Alarcon",
    pais: "Colombia",
  },
  {
    cargo: "Socio",
    correo: "marcelo.coimbra@fcrlaw.com.br",
    firma: "FCR Law",
    nombre: "Marcelo Coimbra",
    pais: "Brasil",
  },
  {
    cargo: "Socio",
    correo: "david@mdulegal.com",
    firma: "MDU Legal",
    nombre: "David Mizrachi",
    pais: "Panama",
  },
  {
    cargo: "Socia",
    correo: "marlyn@mdulegal.com",
    firma: "MDU Legal",
    nombre: "Marlyn Narkiss",
    pais: "Panama",
  },
];

export function validarCargaComplianceLatamFase2({
  almacen,
  destino,
  existentes,
}: {
  almacen: AlmacenCarga;
  destino: DestinoCarga;
  existentes: IdentidadConocida[];
}) {
  return planificarCarga({
    almacen,
    destino,
    existentes,
    participantes: PARTICIPANTES_CL_FASE_2,
  });
}
