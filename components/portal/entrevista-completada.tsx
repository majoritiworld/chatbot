import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EntrevistaCompletada({
  mostrarPortal = true,
}: {
  mostrarPortal?: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="size-6" />
      </span>
      <p className="max-w-md text-balance font-medium text-lg">
        Listo — Majoriti te contactará pronto para continuar con el proceso.
      </p>
      {mostrarPortal ? (
        <Button asChild variant="outline">
          <Link href="/portal">Volver a las fases</Link>
        </Button>
      ) : null}
    </div>
  );
}
