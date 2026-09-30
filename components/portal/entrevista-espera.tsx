import { Spinner } from "@/components/ui/spinner";

export function EntrevistaEspera({ texto }: { texto: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
      <Spinner aria-label={texto} className="size-5 text-muted-foreground" />
      <p className="animate-pulse text-muted-foreground text-sm">{texto}</p>
    </div>
  );
}
