import Link from "next/link";
import { RecuperarSintesisButton } from "@/components/portal/recuperar-sintesis-button";
import {
  TEXTO_TURNO_SILENTE,
  type TurnoEntrevista,
} from "@/lib/consultoria/entrevista-contenido";
import type { SintesisConsulta } from "@/lib/consultoria/sintesis-consulta";

function etiquetaTurno(rol: TurnoEntrevista["rol"]) {
  return rol === "entrevistador" ? "Entrevistador" : "Participante";
}

function ResumenConsulta({
  consulta,
  entrevistaId,
  enviada,
}: {
  consulta: SintesisConsulta | null;
  entrevistaId: string;
  enviada: boolean;
}) {
  if (!enviada) {
    return (
      <p className="text-muted-foreground text-sm">
        Esta entrevista todavía no está enviada, así que no hay resumen.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium text-base">Resumen</h2>
      {consulta ? (
        <p className="whitespace-pre-line text-sm leading-relaxed">
          {consulta.sintesis}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm leading-relaxed">
            El resumen está pendiente. La entrevista ya está enviada y la
            transcripción está disponible.
          </p>
          <RecuperarSintesisButton entrevistaId={entrevistaId} />
        </div>
      )}
    </section>
  );
}

export function EntrevistaLectura({
  consulta,
  entrevistaId,
  enviada,
  nombre,
  turnos,
}: {
  consulta: SintesisConsulta | null;
  entrevistaId: string;
  enviada: boolean;
  nombre: string | null;
  turnos: TurnoEntrevista[];
}) {
  const visibles = turnos.filter(
    (turno) => turno.texto.trim() !== "" && turno.texto !== TEXTO_TURNO_SILENTE
  );

  return (
    <div className="flex flex-col gap-8 px-6 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl tracking-tight">
          {nombre ?? "Entrevista"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Solo consulta. No puedes responder ni modificar esta entrevista.
        </p>
      </div>

      <ResumenConsulta
        consulta={consulta}
        entrevistaId={entrevistaId}
        enviada={enviada}
      />

      {consulta && consulta.citas.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium text-base">Citas memorables</h2>
          <ul className="flex flex-col gap-3">
            {consulta.citas.map((cita) => (
              <li key={cita}>
                <blockquote className="border-border border-l-2 pl-3 text-sm leading-relaxed">
                  {cita}
                </blockquote>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details>
        <summary className="cursor-pointer font-medium text-base">
          Transcripción completa
        </summary>
        <div className="pt-4">
          {visibles.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Esta entrevista todavía no tiene conversación guardada.
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {visibles.map((turno) => (
                <li className="flex flex-col gap-1" key={turno.id}>
                  <span className="font-medium text-muted-foreground text-xs">
                    {etiquetaTurno(turno.rol)}
                  </span>
                  <p className="text-sm leading-relaxed">{turno.texto}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </details>

      <Link className="w-fit font-medium text-primary text-sm" href="/portal">
        Volver a las fases
      </Link>
    </div>
  );
}
