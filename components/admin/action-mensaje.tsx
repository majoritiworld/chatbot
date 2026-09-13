import type { ActionState } from "@/app/(admin)/admin/actions";
import { cn } from "@/lib/utils";

export function ActionMensaje({
  state,
  className,
}: {
  state: ActionState;
  className?: string;
}) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={cn(
        "text-sm",
        state.status === "error" ? "text-destructive" : "text-muted-foreground",
        className
      )}
    >
      {state.message}
    </p>
  );
}
