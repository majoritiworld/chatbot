export function AvisoVoz({ texto }: { texto: string }) {
  return (
    <p
      className="rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed text-neutral-800"
      role="note"
    >
      {texto}
    </p>
  );
}
