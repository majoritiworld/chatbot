import { NOMBRE_FASE_COLABORADORES } from "@/lib/consultoria/guiones/compliance-latam-colaboradores";

/** Stays false until an explicit later confirmation. Do not flip this to send. */
export function envioInvitacionesColaboradoresPermitido() {
  return false;
}

/** Holds invitations and the thank-you mail of this phase until confirmed. */
export function debeRetenerCorreoColaboradores(faseNombre: string | null) {
  return (
    faseNombre?.trim() === NOMBRE_FASE_COLABORADORES &&
    !envioInvitacionesColaboradoresPermitido()
  );
}
