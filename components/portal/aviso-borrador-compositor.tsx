export function AvisoBorradorCompositor({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <p
      className="px-1 pb-1 text-[11px] leading-tight text-muted-foreground"
      role="status"
    >
      Borrador sin enviar
    </p>
  );
}
