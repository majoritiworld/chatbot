/**
 * The leftover chatbot template talks to a dedicated Postgres via Drizzle.
 * Consultoría lives on Supabase; POSTGRES_URL is optional. Never construct a
 * client at module load — a missing or malformed URL used to crash `next build`.
 */
export function getPostgresUrl(): string | null {
  const url = process.env.POSTGRES_URL?.trim();
  if (!url || url === "****") {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname || !parsed.protocol.startsWith("postgres")) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}
