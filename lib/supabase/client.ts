import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicEnv } from "@/lib/supabase/public-env";

export function createClient() {
  const { anonKey, url } = supabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
