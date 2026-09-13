import Form from "next/form";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/auth";
import { Button } from "@/components/ui/button";

async function signOutAction() {
  "use server";
  await signOut();
  redirect("/login");
}

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
