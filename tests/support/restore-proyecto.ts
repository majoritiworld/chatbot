export async function withRestoredProyectoId({
  getProyectoId,
  setProyectoId,
  nextProyectoId,
  userId,
}: {
  getProyectoId: (userId: string) => Promise<string | null>;
  setProyectoId: (userId: string, proyectoId: string | null) => Promise<void>;
  nextProyectoId: string;
  userId: string;
}) {
  const original = await getProyectoId(userId);
  let attemptError: unknown;
  try {
    await setProyectoId(userId, nextProyectoId);
    const assigned = await getProyectoId(userId);
    if (assigned !== nextProyectoId) {
      throw new Error("Majoriti no pudo asignar el proyecto de prueba");
    }
  } catch (error) {
    attemptError = error;
  }
  await setProyectoId(userId, original);
  const restored = await getProyectoId(userId);
  if (restored !== original) {
    throw new Error(
      "No se restauró el proyecto_id original de la cuenta de prueba"
    );
  }
  if (attemptError) {
    throw attemptError;
  }
}

export type PerfilPrueba = {
  proyecto_id: string | null;
  rol: string;
};

export async function withRestoredRolYProyecto({
  during,
  getUsuario,
  next,
  setUsuario,
  userId,
}: {
  during?: () => Promise<void>;
  getUsuario: (userId: string) => Promise<PerfilPrueba>;
  next: PerfilPrueba;
  setUsuario: (userId: string, next: PerfilPrueba) => Promise<void>;
  userId: string;
}) {
  const original = await getUsuario(userId);
  let attemptError: unknown;
  try {
    await setUsuario(userId, next);
    const assigned = await getUsuario(userId);
    if (
      assigned.rol !== next.rol ||
      assigned.proyecto_id !== next.proyecto_id
    ) {
      throw new Error("No se pudo asignar el rol o proyecto de prueba");
    }
    if (during) {
      await during();
    }
  } catch (error) {
    attemptError = error;
  }
  await setUsuario(userId, original);
  const restored = await getUsuario(userId);
  if (
    restored.rol !== original.rol ||
    restored.proyecto_id !== original.proyecto_id
  ) {
    throw new Error(
      "No se restauró el rol o proyecto original de la cuenta de prueba"
    );
  }
  if (attemptError) {
    throw attemptError;
  }
}
