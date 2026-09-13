import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

type LoginParams = Promise<{ error?: string }>;

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
  const { error } = await searchParams;

  return <LoginForm enlaceInvalido={error === "auth"} />;
}
