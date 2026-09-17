import type { ReactNode } from "react";

export function EntrevistaPantallaTransicion({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-y-auto px-6 py-12">
      <div className="m-auto flex w-full max-w-[38.4rem] flex-col gap-8 text-left">
        {children}
      </div>
    </div>
  );
}
