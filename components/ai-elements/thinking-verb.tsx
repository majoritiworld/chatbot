"use client";

import { Shimmer } from "@/components/ai-elements/shimmer";

export function ThinkingVerb({ label }: { label: string }) {
  return (
    <>
      <span className="sr-only">{label}</span>
      <Shimmer as="span" className="font-medium" duration={2}>
        {`${label}…`}
      </Shimmer>
    </>
  );
}
