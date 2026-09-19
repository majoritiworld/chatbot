import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/** Real PostgreSQL engine in memory. Only Supabase-owned auth/storage
 * infrastructure is stubbed; every application migration runs unchanged. */
export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE SCHEMA storage;
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY, email text,
      raw_app_meta_data jsonb DEFAULT '{}',
      raw_user_meta_data jsonb DEFAULT '{}'
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
    CREATE TABLE storage.objects (id uuid PRIMARY KEY, bucket_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA auth, public, storage TO authenticated, anon, service_role;
    CREATE PUBLICATION supabase_realtime;
  `);
  const directory = join(process.cwd(), "supabase/migrations");
  const files = (await readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: migrations must run in chronological order
      await db.exec(await readFile(join(directory, file), "utf8"));
    } catch (error) {
      await db.close();
      throw new Error(`Migration failed: ${file}`, { cause: error });
    }
  }
  // Match the Data API's table privileges; RLS must enforce authorization.
  await db.exec(
    "GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role; GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;"
  );
  return db;
}

export async function actAs(db: PGlite, id: string, email: string) {
  await db.exec("RESET ROLE");
  await db.query(
    "SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)",
    [id, JSON.stringify({ email, sub: id })]
  );
  await db.exec("SET ROLE authenticated");
}
