import Form from "next/form";
import { signOutAction } from "@/app/(auth)/sign-out-action";
import { Button } from "@/components/ui/button";

export function CerrarSesionButton({
  className,
  size = "sm",
  variant = "ghost",
}: {
  className?: string;
  size?: "xs" | "sm";
  variant?: "ghost" | "outline" | "link";
}) {
  return (
    <Form action={signOutAction}>
      <Button className={className} size={size} type="submit" variant={variant}>
        Cerrar sesión
      </Button>
    </Form>
  );
}
