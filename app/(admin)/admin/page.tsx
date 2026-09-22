import { Suspense } from "react";
import { AdminAlta } from "@/components/admin/admin-seccion";
import { CrearProyectoForm } from "@/components/admin/crear-proyecto-form";
import { ProyectosLista } from "@/components/admin/proyectos-lista";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminUser } from "@/lib/consultoria/admin";
import { listProyectosConProgresoAdmin } from "@/lib/consultoria/stakeholders";

export default function AdminPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">Majoriti</span>
        <h1 className="font-semibold text-2xl tracking-tight">Clientes</h1>
      </header>

      <Suspense fallback={<AdminSkeleton />}>
        <AdminContenido />
      </Suspense>

      <AdminAlta etiqueta="Nuevo proyecto">
        <CrearProyectoForm />
      </AdminAlta>
    </main>
  );
}

async function AdminContenido() {
  await requireAdminUser();
  const proyectos = await listProyectosConProgresoAdmin();

  return <ProyectosLista proyectos={proyectos} />;
}

function AdminSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((index) => (
        <Skeleton className="h-28 w-full rounded-2xl" key={index} />
      ))}
    </div>
  );
}
