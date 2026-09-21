import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { rutaEntrevistaPermitida } from "@/lib/consultoria/destino-entrevista";

type LoginParams = Promise<{ error?: string; next?: string }>;

export default function LoginPage({
  searchParams,
}: {
  searchParams: LoginParams;
}) {
  return (
    <Suspense fallback={<LoginForm />}>
      <LoginConAviso searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginConAviso({ searchParams }: { searchParams: LoginParams }) {
  const { error, next } = await searchParams;

  return (
    <LoginForm
      enlaceInvalido={error === "auth"}
      nextDestino={rutaEntrevistaPermitida(next)}
    />
  );
}
