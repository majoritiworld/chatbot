import Link from "next/link";
import { AdminSeccion } from "@/components/admin/admin-seccion";
import { BotonEnvioInvitaciones } from "@/components/admin/boton-envio-invitaciones";
import { siteUrl } from "@/lib/consultoria/auth";
import {
  MENSAJES_BLOQUEO,
  type MotivoBloqueoCorreo,
} from "@/lib/consultoria/correos/asignacion";
import {
  filasDeProyectoParaVistaPrevia,
  permitirOrigenLocal,
} from "@/lib/consultoria/correos/asignacion-servidor";
import { correoParaVistaPrevia } from "@/lib/consultoria/correos/ejemplos";

/** Preview with a fictitious participant, and the send button (server-gated). */
export async function InvitacionFaseAdmin({
  faseId,
  proyectoId,
  soloCorreo,
}: {
  faseId: string;
  proyectoId: string;
  soloCorreo: boolean;
}) {
  if (soloCorreo) {
    return (
      <AdminSeccion
        descripcion="Las personas asignadas entran escribiendo su correo en la página del proyecto, sin código. Esta fase no envía invitaciones desde el portal."
        titulo="Invitación"
      >
        <p className="text-muted-foreground text-sm">
          Correo y código siguen disponibles en la misma página, con «Entrar con
          correo y código de verificación».
        </p>
      </AdminSeccion>
    );
  }
  const base = await filasDeProyectoParaVistaPrevia(proyectoId, faseId);
  const correo = base
    ? correoParaVistaPrevia({
        filasAsignacion: base.filas,
        imagenes: true,
        logo: undefined,
        permitirLocal: permitirOrigenLocal(),
        site: siteUrl(),
        tipo: "invitacion",
      })
    : { error: "sin_entrevista" };
  const personal = base?.filas.fase?.acceso_enlace_personal === true;
  const vistaCompleta = `/admin/correos?${new URLSearchParams({
    fase: faseId,
    proyecto: proyectoId,
    tipo: "invitacion",
  }).toString()}`;

  return (
    <AdminSeccion
      descripcion={
        personal
          ? "Acceso con enlace personal: abre la entrevista sin correo ni código. Correo y código siguen como alternativa."
          : "Acceso con correo y código."
      }
      titulo="Invitación"
    >
      <div className="flex flex-col gap-4">
        {base?.faltaMigracion ? (
          <p className="text-amber-700 text-sm">
            Falta aplicar la migración con los textos y el modo de acceso de la
            invitación. Se muestran los valores predeterminados.
          </p>
        ) : null}
        {"error" in correo ? (
          <p className="text-destructive text-sm">
            {correo.error in MENSAJES_BLOQUEO
              ? MENSAJES_BLOQUEO[correo.error as MotivoBloqueoCorreo]
              : "El sitio no tiene un origen autorizado para los enlaces."}
          </p>
        ) : (
          <>
            <p className="text-sm">
              <span className="text-muted-foreground">Asunto: </span>
              {correo.subject}
            </p>
            <iframe
              className="h-[40rem] w-full rounded-xl border bg-white"
              sandbox=""
              srcDoc={correo.html}
              title="Vista previa de la invitación"
            />
          </>
        )}
        <Link
          className="text-sm underline-offset-4 hover:underline"
          href={vistaCompleta}
        >
          Abrir la vista previa completa
        </Link>
        <BotonEnvioInvitaciones faseId={faseId} />
        <p className="text-muted-foreground text-sm">
          El servidor rechaza el envío mientras las invitaciones no estén
          habilitadas o la fase esté retenida. Ahora no sale ningún correo.
        </p>
      </div>
    </AdminSeccion>
  );
}
