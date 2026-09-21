/** Explicit references let Next inline only these public values in the browser. */
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!(url && anonKey)) {
    throw new Error("Falta la configuración pública de Supabase");
  }
  return { anonKey, url };
}
