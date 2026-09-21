import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function createClient() {
  return createBrowserClient(
    getSupabaseConfig().url,
    getSupabaseConfig().anonKey
  );
}
