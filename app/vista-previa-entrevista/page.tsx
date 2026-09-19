import { notFound } from "next/navigation";
import { Suspense } from "react";
import { VistaPreviaEntrevistaCliente } from "./vista-previa-entrevista-cliente";

const AISLADA = process.env.PLAYWRIGHT_ISOLATED === "1";

export default function VistaPreviaEntrevista() {
  if (!AISLADA) {
    notFound();
  }

  return (
    <Suspense>
      <VistaPreviaEntrevistaCliente />
    </Suspense>
  );
}
