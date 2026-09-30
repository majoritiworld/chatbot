import { claveCorreo } from "@/lib/consultoria/carga-participantes";

const EMAIL_SIMPLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export type FilaPlanilla = {
  apellido: string;
  cargo: string;
  correo: string;
  empresa: string;
  fechaIngreso: string;
  fila: number;
  hoja: string;
  industria: string;
  nombre: string;
  pais: string;
};

export type OrigenFila = {
  fila: number;
  hoja: string;
};

export type ParticipanteValido = {
  apellido: string;
  cargo: string;
  cargoDescartado: string | null;
  correo: string;
  empresa: string;
  industria: string;
  nombre: string;
  origenes: OrigenFila[];
  pais: string;
};

export type PendienteCarga = {
  detalle: string;
  fila: number;
  hoja: string;
  motivo: "sin_correo" | "correo_invalido" | "conflicto";
};

export type PlanColaboradores = {
  pendientes: PendienteCarga[];
  validos: ParticipanteValido[];
};

function fechaOrden(valor: string) {
  const partes = valor.trim().split(".");
  if (partes.length !== 3) {
    return 0;
  }
  const [dia, mes, anio] = partes;
  const numero = Date.parse(`${anio}-${mes}-${dia}`);
  return Number.isNaN(numero) ? 0 : numero;
}

function mismaPersona(filas: FilaPlanilla[]) {
  const [primera] = filas;
  if (!primera) {
    return false;
  }
  return filas.every(
    (fila) =>
      fila.nombre.trim().toLowerCase() ===
        primera.nombre.trim().toLowerCase() &&
      fila.apellido.trim().toLowerCase() ===
        primera.apellido.trim().toLowerCase() &&
      fila.empresa.trim().toLowerCase() ===
        primera.empresa.trim().toLowerCase() &&
      fila.pais.trim().toLowerCase() === primera.pais.trim().toLowerCase()
  );
}

export function planificarColaboradores(
  filas: FilaPlanilla[]
): PlanColaboradores {
  const pendientes: PendienteCarga[] = [];
  const porCorreo = new Map<string, FilaPlanilla[]>();

  for (const fila of filas) {
    const correo = claveCorreo(fila.correo);
    if (!correo) {
      pendientes.push({
        detalle: `${fila.nombre} ${fila.apellido}`.trim(),
        fila: fila.fila,
        hoja: fila.hoja,
        motivo: "sin_correo",
      });
      continue;
    }
    if (!EMAIL_SIMPLE.test(correo)) {
      pendientes.push({
        detalle: fila.correo,
        fila: fila.fila,
        hoja: fila.hoja,
        motivo: "correo_invalido",
      });
      continue;
    }
    const grupo = porCorreo.get(correo) ?? [];
    grupo.push({ ...fila, correo });
    porCorreo.set(correo, grupo);
  }

  const validos: ParticipanteValido[] = [];
  for (const [correo, grupo] of porCorreo) {
    if (!mismaPersona(grupo)) {
      for (const fila of grupo) {
        pendientes.push({
          detalle: `El correo ${correo} aparece con identidades distintas.`,
          fila: fila.fila,
          hoja: fila.hoja,
          motivo: "conflicto",
        });
      }
      continue;
    }
    const ordenadas = [...grupo].sort(
      (a, b) => fechaOrden(b.fechaIngreso) - fechaOrden(a.fechaIngreso)
    );
    const [elegida] = ordenadas;
    if (!elegida) {
      continue;
    }
    const otroCargo = ordenadas.find(
      (fila) => fila.cargo.trim() && fila.cargo.trim() !== elegida.cargo.trim()
    );
    validos.push({
      apellido: elegida.apellido.trim(),
      cargo: elegida.cargo.trim(),
      cargoDescartado: otroCargo ? otroCargo.cargo.trim() : null,
      correo,
      empresa: elegida.empresa.trim(),
      industria: elegida.industria.trim(),
      nombre: elegida.nombre.trim(),
      origenes: grupo.map((fila) => ({ fila: fila.fila, hoja: fila.hoja })),
      pais: elegida.pais.trim(),
    });
  }

  validos.sort((a, b) => a.correo.localeCompare(b.correo));
  return { pendientes, validos };
}
