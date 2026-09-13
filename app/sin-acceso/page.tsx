import { CerrarSesionButton } from "@/components/auth/cerrar-sesion-button";

export default function SinAccesoPage() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-semibold text-xl tracking-tight">
          No tienes acceso al portal
        </h1>
        <p className="max-w-md text-muted-foreground text-sm">
          Tu cuenta no está asignada a un proyecto de cliente. Si crees que es un
          error, contacta a Majoriti.
        </p>
      </div>
      <CerrarSesionButton variant="outline" />
    </main>
  );
}
