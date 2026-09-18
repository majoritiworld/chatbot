const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseFechaOpcional(value: string | undefined): string | null {
  const fecha = value?.trim() ?? "";
  if (!fecha) {
    return null;
  }
  if (!FECHA_ISO.test(fecha)) {
    return null;
  }
  return fecha;
}

export function validarRangoFechas(
  inicio: string | null,
  cierre: string | null
): string | null {
  if (inicio && cierre && cierre < inicio) {
    return "La fecha de cierre debe ser igual o posterior a la de inicio.";
  }
  return null;
}

function partes(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  return {
    anio: date.getFullYear(),
    dia: String(date.getDate()).padStart(2, "0"),
    mes: String(date.getMonth() + 1).padStart(2, "0"),
  };
}

function formatCorto(iso: string, conAnio: boolean) {
  const { dia, mes, anio } = partes(iso);
  if (conAnio) {
    return `${dia}/${mes}/${anio}`;
  }
  return `${dia}/${mes}`;
}

function fechaHoyIso() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

export function fechaYaPaso(iso: string) {
  return iso < fechaHoyIso();
}

export function formatFechaCalendario(iso: string) {
  const weekday = new Intl.DateTimeFormat("es", { weekday: "long" }).format(
    new Date(`${iso}T00:00:00`)
  );
  const diaMes = formatCorto(iso, false);

  if (!weekday) {
    return diaMes;
  }

  return `${weekday.toLocaleUpperCase("es")}, ${diaMes}`;
}

function formatLargo(iso: string) {
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso}T00:00:00`));
}

export function formatRangoFechas(
  inicio: string | null,
  cierre: string | null,
  vacio = "Sin fecha estimada"
): string {
  if (inicio && cierre) {
    if (inicio === cierre) {
      return formatLargo(inicio);
    }

    const aniosDistintos = partes(inicio).anio !== partes(cierre).anio;
    return `${formatCorto(inicio, aniosDistintos)}-${formatCorto(cierre, aniosDistintos)}`;
  }

  if (inicio) {
    return formatLargo(inicio);
  }

  if (cierre) {
    return `Hasta ${formatCorto(cierre, true)}`;
  }

  return vacio;
}
