import { nombreCompleto } from "@/lib/consultoria/nombre";

const EMAIL_SIMPLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MARCA_ACENTO = /\p{M}/gu;
const ESPACIOS = /\s+/u;
const PALABRA_FIRMA = /\p{L}{4,}/gu;
const ACENTO_AGUDO = /\u00b4/u;
const SEPARA_LOCAL = /[^a-z0-9]+/u;
const NO_ALFANUMERICO = /[^a-z0-9]/gu;

const PAISES_A_REVISAR = new Map<string, string>([
  ["Panama", "La grafía habitual es Panamá. Se conserva «Panama»."],
  [
    "Republica Dominicana",
    "La grafía habitual es República Dominicana. Se conserva el texto entregado.",
  ],
]);

export type RolCuenta = "stakeholder" | "cliente" | "majoriti" | "comite";

export type ParticipanteCarga = {
  cargo: string;
  correo: string;
  firma: string;
  nombre: string;
  pais: string;
};

export type EntrevistaConocida = {
  faseId: string;
  id: string;
  plantillaId: string | null;
};

export type IdentidadConocida = {
  apellido: string | null;
  cargo?: string | null;
  correo: string;
  entrevistas: EntrevistaConocida[];
  firma: string | null;
  nombre: string;
  pais?: string | null;
  rol: RolCuenta | null;
  stakeholderId: string;
};

export type DestinoCarga = {
  faseId: string;
  plantillaId: string | null;
  plantillaNombre: string;
};

export type AlmacenCarga = {
  cargo: boolean;
  pais: boolean;
};

export type AccionCarga =
  | { tipo: "conservar_acceso"; rol: RolCuenta }
  | { tipo: "crear_acceso_stakeholder" }
  | { tipo: "crear_entrevista" }
  | { tipo: "crear_persona" }
  | { motivo: string; tipo: "omitir_entrevista" }
  | { stakeholderId: string; tipo: "reutilizar_persona" };

export type FilaCarga = {
  acceso: "conservar" | "crear_stakeholder";
  acciones: AccionCarga[];
  entrevista: "crear" | "omitir";
  entrevistasIntactas: string[];
  identidad: "crear" | "duplicada" | "invalida" | "reutilizar";
  participante: ParticipanteCarga;
  revisiones: string[];
  rolConservado: RolCuenta | null;
  senalarRol: boolean;
};

export type PresenciaFirma = {
  firma: string;
  pais: string;
  personas: number;
};

export type PlanCarga = {
  almacen: AlmacenCarga;
  avisos: string[];
  correosEnviados: 0;
  destino: DestinoCarga;
  escrito: false;
  filas: FilaCarga[];
  firmas: string[];
  personas: number;
  presencias: PresenciaFirma[];
};

export function claveCorreo(correo: string) {
  return correo.trim().toLowerCase();
}

function quitarAcentos(valor: string) {
  return valor.normalize("NFD").replace(MARCA_ACENTO, "");
}

function compacto(valor: string) {
  return quitarAcentos(valor).toLowerCase().replace(NO_ALFANUMERICO, "");
}

function palabrasNombre(nombre: string) {
  return nombre
    .trim()
    .split(ESPACIOS)
    .filter((parte) => parte.length > 0);
}

function revisarCorreo(correo: string) {
  if (EMAIL_SIMPLE.test(correo.trim())) {
    return null;
  }
  return "El correo no tiene formato de email. No preparo a esta persona.";
}

function revisarApellidoEnCorreo(participante: ParticipanteCarga) {
  if (!EMAIL_SIMPLE.test(participante.correo.trim())) {
    return null;
  }
  const apellido = palabrasNombre(participante.nombre).at(-1) ?? "";
  const apellidoCompacto = compacto(apellido);
  if (apellidoCompacto.length < 3) {
    return null;
  }
  const local = compacto(participante.correo.split("@").at(0) ?? "");
  if (local.includes(apellidoCompacto)) {
    return null;
  }
  return `El correo no coincide con el apellido «${apellido}». Se conservan ambos textos.`;
}

function revisarTokensExtra(participante: ParticipanteCarga) {
  if (!EMAIL_SIMPLE.test(participante.correo.trim())) {
    return null;
  }
  const local = quitarAcentos(
    participante.correo.split("@").at(0) ?? ""
  ).toLowerCase();
  if (!SEPARA_LOCAL.test(local)) {
    return null;
  }
  const partesNombre = palabrasNombre(participante.nombre).map((parte) =>
    compacto(parte)
  );
  const nombreCompacto = compacto(participante.nombre);
  const extras = local.split(SEPARA_LOCAL).filter((token) => {
    if (token.length < 5 || nombreCompacto.includes(token)) {
      return false;
    }
    return !partesNombre.some(
      (parte) => parte.length >= 3 && token.includes(parte)
    );
  });
  const extra = extras.at(0);
  if (!extra) {
    return null;
  }
  return `El correo incluye «${extra}», que no está en el nombre entregado. Se conserva el correo.`;
}

function revisarNombreLargo(nombre: string) {
  if (palabrasNombre(nombre).length < 3) {
    return null;
  }
  return "El nombre tiene más de dos palabras. No separo nombre y apellido.";
}

function revisarLopez(nombre: string) {
  const marcado = palabrasNombre(nombre).find(
    (token) => token === "Lopéz" || token === "lopéz"
  );
  if (!marcado) {
    return null;
  }
  return `«${marcado}» lleva la tilde en la e. Se conserva tal como viene.`;
}

function revisarFirma(firma: string) {
  const notas: string[] = [];
  if (ACENTO_AGUDO.test(firma)) {
    notas.push(
      `La firma usa el carácter ´, no un apóstrofo. Se conserva «${firma}».`
    );
  }
  const palabras = firma.match(PALABRA_FIRMA) ?? [];
  const hayTitulo = palabras.some((palabra) => {
    const inicial = palabra.charAt(0);
    return (
      inicial === inicial.toLocaleUpperCase("es") &&
      inicial !== inicial.toLocaleLowerCase("es")
    );
  });
  if (!hayTitulo) {
    return notas;
  }
  const minuscula = palabras.find(
    (palabra) =>
      palabra === palabra.toLocaleLowerCase("es") &&
      palabra !== palabra.toLocaleUpperCase("es")
  );
  if (minuscula) {
    notas.push(
      `La firma trae «${minuscula}» en minúscula. Se conserva el texto entregado.`
    );
  }
  return notas;
}

function revisarPais(pais: string) {
  return PAISES_A_REVISAR.get(pais) ?? null;
}

export function revisarParticipante(participante: ParticipanteCarga) {
  return [
    revisarCorreo(participante.correo),
    revisarApellidoEnCorreo(participante),
    revisarTokensExtra(participante),
    revisarNombreLargo(participante.nombre),
    revisarLopez(participante.nombre),
    ...revisarFirma(participante.firma),
    revisarPais(participante.pais),
  ].filter((nota): nota is string => nota !== null);
}

function avisoRol(rol: RolCuenta) {
  if (rol === "cliente") {
    return "Ya tiene acceso como cliente. No cambio ese permiso.";
  }
  if (rol === "majoriti") {
    return "Ya tiene acceso como Majoriti. No cambio ese permiso.";
  }
  if (rol === "comite") {
    return "Ya tiene acceso de comité. No cambio ese permiso.";
  }
  return null;
}

function entrevistaYaAsignada(
  entrevistas: EntrevistaConocida[],
  destino: DestinoCarga
) {
  return entrevistas.some((entrevista) => {
    if (entrevista.faseId === destino.faseId) {
      return true;
    }
    return (
      destino.plantillaId !== null &&
      entrevista.plantillaId === destino.plantillaId
    );
  });
}

function diferenciasDeFicha(
  participante: ParticipanteCarga,
  existente: IdentidadConocida
) {
  const notas: string[] = [];
  const guardado = nombreCompleto(existente.nombre, existente.apellido);
  if (guardado !== participante.nombre) {
    notas.push(
      `La ficha guardada se llama «${guardado}». La lista dice «${participante.nombre}». No modifico la ficha.`
    );
  }
  if ((existente.firma ?? "") !== participante.firma) {
    const firmaGuardada = existente.firma ? `«${existente.firma}»` : "vacía";
    notas.push(
      `La firma guardada está ${firmaGuardada}. La lista dice «${participante.firma}». No la cambio.`
    );
  }
  return notas;
}

function filaDuplicada(participante: ParticipanteCarga): FilaCarga {
  return {
    acceso: "conservar",
    acciones: [
      {
        motivo: "El correo ya aparece antes en la lista.",
        tipo: "omitir_entrevista",
      },
    ],
    entrevista: "omitir",
    entrevistasIntactas: [],
    identidad: "duplicada",
    participante,
    revisiones: [
      "Este correo ya aparece antes en la lista. No preparo otra entrevista.",
    ],
    rolConservado: null,
    senalarRol: false,
  };
}

function filaInvalida(
  participante: ParticipanteCarga,
  revisiones: string[]
): FilaCarga {
  return {
    acceso: "conservar",
    acciones: [
      {
        motivo: "El correo no tiene formato de email.",
        tipo: "omitir_entrevista",
      },
    ],
    entrevista: "omitir",
    entrevistasIntactas: [],
    identidad: "invalida",
    participante,
    revisiones,
    rolConservado: null,
    senalarRol: false,
  };
}

function armarFilaNueva(
  participante: ParticipanteCarga,
  revisiones: string[],
  existente: IdentidadConocida | null,
  destino: DestinoCarga
): FilaCarga {
  const rol = existente?.rol ?? null;
  const privilegio = rol ? avisoRol(rol) : null;
  const yaAsignada = existente
    ? entrevistaYaAsignada(existente.entrevistas, destino)
    : false;
  const acciones: AccionCarga[] = [];
  const notas = [...revisiones];

  if (existente) {
    acciones.push({
      stakeholderId: existente.stakeholderId,
      tipo: "reutilizar_persona",
    });
    notas.push(...diferenciasDeFicha(participante, existente));
  } else {
    acciones.push({ tipo: "crear_persona" });
  }

  if (privilegio && rol) {
    acciones.push({ rol, tipo: "conservar_acceso" });
    notas.push(privilegio);
  } else if (rol === "stakeholder") {
    acciones.push({ rol, tipo: "conservar_acceso" });
  } else {
    acciones.push({ tipo: "crear_acceso_stakeholder" });
  }

  if (yaAsignada) {
    acciones.push({
      motivo: "Ya tiene una entrevista en esta fase.",
      tipo: "omitir_entrevista",
    });
  } else {
    acciones.push({ tipo: "crear_entrevista" });
  }

  let acceso: FilaCarga["acceso"] = "crear_stakeholder";
  if (privilegio || rol === "stakeholder") {
    acceso = "conservar";
  }

  return {
    acceso,
    acciones,
    entrevista: yaAsignada ? "omitir" : "crear",
    entrevistasIntactas: existente
      ? existente.entrevistas.map((entrevista) => entrevista.id)
      : [],
    identidad: existente ? "reutilizar" : "crear",
    participante,
    revisiones: notas,
    rolConservado: privilegio ? rol : null,
    senalarRol: privilegio !== null,
  };
}

function avisosDelPlan(almacen: AlmacenCarga, destino: DestinoCarga) {
  const avisos: string[] = [];
  if (!almacen.pais) {
    avisos.push(
      "El plan conserva el país, pero stakeholder no tiene columna país."
    );
  }
  if (!almacen.cargo) {
    avisos.push(
      "El plan conserva el cargo, pero stakeholder no tiene columna cargo."
    );
  }
  if (!destino.plantillaId) {
    avisos.push(
      `La plantilla «${destino.plantillaNombre}» no está creada. La asignación queda preparada.`
    );
  }
  return avisos;
}

function presenciasDe(filas: FilaCarga[]) {
  const cuentas = new Map<string, PresenciaFirma>();
  for (const fila of filas) {
    if (fila.identidad === "duplicada" || fila.identidad === "invalida") {
      continue;
    }
    const { firma, pais } = fila.participante;
    const clave = `${firma}\u0000${pais}`;
    const previa = cuentas.get(clave);
    if (previa) {
      previa.personas += 1;
    } else {
      cuentas.set(clave, { firma, pais, personas: 1 });
    }
  }
  return [...cuentas.values()];
}

function firmasDe(presencias: PresenciaFirma[]) {
  const firmas: string[] = [];
  for (const presencia of presencias) {
    if (!firmas.includes(presencia.firma)) {
      firmas.push(presencia.firma);
    }
  }
  return firmas;
}

export function planificarCarga({
  almacen,
  destino,
  existentes,
  participantes,
}: {
  almacen: AlmacenCarga;
  destino: DestinoCarga;
  existentes: IdentidadConocida[];
  participantes: readonly ParticipanteCarga[];
}): PlanCarga {
  const vistos = new Set<string>();
  const filas: FilaCarga[] = [];

  for (const participante of participantes) {
    const clave = claveCorreo(participante.correo);
    if (vistos.has(clave)) {
      filas.push(filaDuplicada(participante));
      continue;
    }
    vistos.add(clave);

    const revisiones = revisarParticipante(participante);
    if (!EMAIL_SIMPLE.test(participante.correo.trim())) {
      filas.push(filaInvalida(participante, revisiones));
      continue;
    }

    const coincidencias = existentes.filter(
      (candidato) => claveCorreo(candidato.correo) === clave
    );
    const existente = coincidencias.at(0) ?? null;
    const notas =
      coincidencias.length > 1
        ? [
            ...revisiones,
            "Hay más de una ficha con este correo. Reutilizo la primera y no creo otra.",
          ]
        : revisiones;
    filas.push(armarFilaNueva(participante, notas, existente, destino));
  }

  const presencias = presenciasDe(filas);
  return {
    almacen,
    avisos: avisosDelPlan(almacen, destino),
    correosEnviados: 0,
    destino,
    escrito: false,
    filas,
    firmas: firmasDe(presencias),
    personas: filas.filter((fila) => fila.identidad !== "duplicada").length,
    presencias,
  };
}

export type ResultadoAplicacion = {
  aplicado: boolean;
  correosEnviados: 0;
  motivos: string[];
  personas: IdentidadConocida[];
};

function clonarPersonas(personas: readonly IdentidadConocida[]) {
  return personas.map((persona) => ({
    ...persona,
    entrevistas: persona.entrevistas.map((entrevista) => ({ ...entrevista })),
  }));
}

/**
 * Applies a plan in memory. It does not open a database connection, send
 * mail, or change a stored name, firm, country, title, role, or interview.
 * A second pass finds the people and interviews already created and skips them.
 */
export function aplicarPlan(
  plan: PlanCarga,
  personas: readonly IdentidadConocida[]
): ResultadoAplicacion {
  if (plan.avisos.length > 0) {
    return {
      aplicado: false,
      correosEnviados: 0,
      motivos: plan.avisos,
      personas: clonarPersonas(personas),
    };
  }

  const siguientes = clonarPersonas(personas);

  for (const fila of plan.filas) {
    if (fila.identidad === "duplicada" || fila.identidad === "invalida") {
      continue;
    }

    const clave = claveCorreo(fila.participante.correo);
    let persona = siguientes.find(
      (candidata) => claveCorreo(candidata.correo) === clave
    );

    const debeCrear = fila.acciones.some(
      (accion) => accion.tipo === "crear_persona"
    );
    if (!persona && !debeCrear) {
      continue;
    }
    if (!persona) {
      persona = {
        apellido: null,
        cargo: fila.participante.cargo,
        correo: fila.participante.correo.trim(),
        entrevistas: [],
        firma: fila.participante.firma,
        nombre: fila.participante.nombre,
        pais: fila.participante.pais,
        rol: null,
        stakeholderId: `preparada:${clave}`,
      };
      siguientes.push(persona);
    }

    const creaAcceso = fila.acciones.some(
      (accion) => accion.tipo === "crear_acceso_stakeholder"
    );
    if (creaAcceso && persona.rol === null) {
      persona.rol = "stakeholder";
    }

    const creaEntrevista = fila.acciones.some(
      (accion) => accion.tipo === "crear_entrevista"
    );
    if (
      creaEntrevista &&
      !entrevistaYaAsignada(persona.entrevistas, plan.destino)
    ) {
      persona.entrevistas.push({
        faseId: plan.destino.faseId,
        id: `preparada:${clave}:${plan.destino.faseId}`,
        plantillaId: plan.destino.plantillaId,
      });
    }
  }

  return {
    aplicado: true,
    correosEnviados: 0,
    motivos: [],
    personas: siguientes,
  };
}

export function resumirPlan(plan: PlanCarga) {
  return {
    accesoStakeholderNuevo: plan.filas.filter((fila) =>
      fila.acciones.some((accion) => accion.tipo === "crear_acceso_stakeholder")
    ).length,
    avisos: plan.avisos,
    correosEnviados: plan.correosEnviados,
    entrevistasNuevas: plan.filas.filter((fila) => fila.entrevista === "crear")
      .length,
    entrevistasOmitidas: plan.filas.filter(
      (fila) => fila.entrevista === "omitir"
    ).length,
    escrito: plan.escrito,
    firmas: plan.firmas.length,
    personas: plan.personas,
    presencias: plan.presencias.length,
    presenciasDetalle: plan.presencias,
    reutilizadas: plan.filas.filter((fila) => fila.identidad === "reutilizar")
      .length,
    revisiones: plan.filas.flatMap((fila) =>
      fila.revisiones.map((texto) => ({
        correo: fila.participante.correo,
        nombre: fila.participante.nombre,
        texto,
      }))
    ),
    rolesSenalados: plan.filas
      .filter((fila) => fila.senalarRol)
      .map((fila) => ({
        correo: fila.participante.correo,
        nombre: fila.participante.nombre,
        rol: fila.rolConservado,
      })),
  };
}
