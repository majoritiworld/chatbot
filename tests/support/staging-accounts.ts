export function dominioPruebaStaging() {
  return process.env.STAGING_TEST_EMAIL_DOMAIN ?? "example.test";
}

export function esEmailDePrueba(
  email: string,
  domain = dominioPruebaStaging()
) {
  const normalized = email.trim().toLowerCase();
  const suffix = `@${domain.trim().toLowerCase()}`;
  return normalized.endsWith(suffix) && normalized.length > suffix.length;
}

/** Staging checks only run against *@example.test (or STAGING_TEST_EMAIL_DOMAIN). */
export function exigirCuentasDePrueba({
  majoritiEmail,
  otherEmail,
  participantEmail,
}: {
  majoritiEmail: string;
  otherEmail: string;
  participantEmail: string;
}) {
  const domain = dominioPruebaStaging();
  if (
    !(
      esEmailDePrueba(participantEmail, domain) &&
      esEmailDePrueba(otherEmail, domain) &&
      esEmailDePrueba(majoritiEmail, domain)
    )
  ) {
    throw new Error(
      `Las pruebas autenticadas solo admiten cuentas *@${domain}. No uses correos de clientes.`
    );
  }
}
