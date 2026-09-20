import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { VistaPreviaEntrevistaCliente } from "./vista-previa-entrevista-cliente";

export default function VistaPreviaEntrevista() {
  return (
    <Suspense>
      <VistaPreviaEntrevistaDinamica />
    </Suspense>
  );
}

async function VistaPreviaEntrevistaDinamica() {
  await connection();

  if (process.env.PLAYWRIGHT_ISOLATED !== "1") {
    notFound();
  }

  return <VistaPreviaEntrevistaCliente />;
}
