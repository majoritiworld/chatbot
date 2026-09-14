import type { RolPortal } from "@/lib/consultoria/roles";

const OPCIONES = [
  {
    detalle:
      "Entra directo a su entrevista. Firmas socias y otros invitados externos.",
    titulo: "Stakeholder",
    value: "stakeholder",
  },
  {
    detalle:
      "Ve todas las fases y quién ya completó. El equipo interno del proyecto.",
    titulo: "Cliente",
    value: "cliente",
  },
] as const satisfies ReadonlyArray<{
  detalle: string;
  titulo: string;
  value: RolPortal;
}>;

export function RolPortalOpciones({
  defaultValue,
  descripcion,
  idPrefix,
  ocultarLeyenda = false,
}: {
  defaultValue: RolPortal;
  descripcion?: string;
  idPrefix: string;
  ocultarLeyenda?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={ocultarLeyenda ? "sr-only" : "font-medium text-sm"}>
        Acceso al portal
      </legend>
      {descripcion ? (
        <p className="text-muted-foreground text-xs">{descripcion}</p>
      ) : null}
      {OPCIONES.map((opcion) => {
        const id = `${idPrefix}-${opcion.value}`;

        return (
          <label
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm"
            htmlFor={id}
            key={opcion.value}
          >
            <input
              className="mt-1"
              defaultChecked={defaultValue === opcion.value}
              id={id}
              name="rol"
              type="radio"
              value={opcion.value}
            />
            <span>
              <span className="font-medium">{opcion.titulo}</span>
              <span className="block text-muted-foreground text-xs">
                {opcion.detalle}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
