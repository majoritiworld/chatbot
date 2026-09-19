import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { getPostgresUrl } from "./connection";

config({
  path: ".env.local",
});

const runMigrate = async () => {
  // Consultoría schema is applied via supabase/migrations, not Drizzle.
  // Vercel Production currently lists POSTGRES_URL; never run this on deploy.
  if (process.env.VERCEL && process.env.RUN_DRIZZLE_MIGRATE !== "1") {
    console.log("Skipping Drizzle migrations on Vercel");
    process.exit(0);
  }

  const url = getPostgresUrl();
  if (!url) {
    console.log("POSTGRES_URL not defined or invalid, skipping migrations");
    process.exit(0);
  }

  const connection = postgres(url, { max: 1 });
  const db = drizzle(connection);

  console.log("Running migrations...");

  const start = Date.now();
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  const end = Date.now();

  console.log("Migrations completed in", end - start, "ms");
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("Migration failed");
  console.error(err);
  process.exit(1);
});
