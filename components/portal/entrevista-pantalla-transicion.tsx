import type { ReactNode } from "react";

export function EntrevistaPantallaTransicion({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="grid h-full min-h-0 w-full flex-1 grid-rows-[minmax(4rem,1fr)_auto_minmax(4rem,2fr)] overflow-y-auto px-6 py-12">
      <div className="col-start-1 row-start-2 mx-auto flex w-full max-w-[38.4rem] flex-col gap-8 text-left">
        {children}
      </div>
    </div>
  );
}
