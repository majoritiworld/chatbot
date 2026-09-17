"use client";

import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

export function MinutaMarkdown({
  className,
  markdown,
}: {
  className?: string;
  markdown: string;
}) {
  return (
    <Streamdown
      className={cn(
        "text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      {markdown}
    </Streamdown>
  );
}
