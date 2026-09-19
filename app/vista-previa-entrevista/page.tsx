import { MicIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { EntrevistaShell } from "@/components/portal/entrevista-shell";
import { Button } from "@/components/ui/button";

const AISLADA = process.env.PLAYWRIGHT_ISOLATED === "1";

export default function VistaPreviaEntrevista() {
  if (!AISLADA) {
    notFound();
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <EntrevistaShell
        mostrarPortal={false}
        seccion="Tema 1 de 4: Diagnóstico"
        titulo="Entrevista"
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="mx-auto flex min-h-full min-w-0 w-full max-w-[760px] flex-col gap-6 px-3 py-8 md:gap-8 md:px-4">
            <div className="w-fit max-w-[min(92%,42rem)] rounded-3xl rounded-bl-md bg-card/90 px-4 py-2.5 text-base leading-[1.7] shadow-[var(--shadow-card)]">
              Hola, Alex. Para empezar: ¿qué cambió en el último trimestre?
            </div>
            <div className="ml-auto w-fit max-w-[min(88%,40rem)] overflow-hidden break-words rounded-3xl rounded-br-md border border-border/30 bg-gradient-to-br from-secondary to-muted px-4 py-2.5 text-base leading-[1.7] shadow-[var(--shadow-card)]">
              Cerramos dos cuentas y el comité pidió más claridad en membresías.
            </div>
          </div>
          <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-[760px] gap-2 bg-background px-3 pb-3 md:px-4 md:pb-4">
            <div className="w-full [&>div]:rounded-[1.75rem]">
              <div className="rounded-[1.75rem] border border-border/30 bg-card/70 shadow-[var(--shadow-composer)]">
                <label className="sr-only" htmlFor="vista-previa-respuesta">
                  Escribe tu respuesta
                </label>
                <textarea
                  className="min-h-28 w-full resize-none bg-transparent px-4 pt-3.5 pb-1.5 text-base leading-[1.7] outline-none placeholder:text-muted-foreground/35"
                  id="vista-previa-respuesta"
                  placeholder="Escribe tu respuesta…"
                />
                <div className="flex items-center justify-between gap-2 px-3 pb-3">
                  <Button
                    className="h-7 min-w-[8.25rem] gap-1.5 rounded-xl px-2.5 font-medium text-xs"
                    disabled
                    type="button"
                    variant="outline"
                  >
                    <MicIcon className="size-3.5" />
                    Hablar
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button size="xs" type="button" variant="outline">
                      Siguiente tema (cierra este)
                    </Button>
                    <Button size="xs" type="button">
                      Enviar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </EntrevistaShell>
    </div>
  );
}
