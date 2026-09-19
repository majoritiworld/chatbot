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
