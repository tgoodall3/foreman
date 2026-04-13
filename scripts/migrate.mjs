/**
 * Migration runner for Foreman.
 *
 * Reads all .sql files from supabase/migrations/ in alphabetical order,
 * tracks which have been applied in a _migrations table, and runs the rest.
 *
 * Requires DATABASE_URL in your environment (direct Postgres connection string).
 * Get it from: Supabase Dashboard → Settings → Database → Connection string (URI mode).
 * Add it to .env.local as: DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
 *
 * Run with: npm run migrate
 */

import { createRequire } from "module";
import { readdir, readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Load .env.local
config({ path: join(root, ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "\nMissing DATABASE_URL. Add it to .env.local:\n" +
    "  DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres\n\n" +
    "Find it in: Supabase Dashboard → Settings → Database → Connection string (URI)\n"
  );
  process.exit(1);
}

// Dynamically require pg (avoids needing it as a hard dependency)
let pg;
try {
  const require = createRequire(import.meta.url);
  pg = require("pg");
} catch {
  console.error(
    "\nMissing dependency. Install it once:\n  npm install --save-dev pg\n"
  );
  process.exit(1);
}

const { Client } = pg;
const client = new Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();

  // Create tracking table if it doesn't exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Load already-applied migrations
  const { rows: applied } = await client.query("SELECT filename FROM _migrations ORDER BY filename");
  const appliedSet = new Set(applied.map((r) => r.filename));

  // Read migration files
  const migrationsDir = join(root, "supabase", "migrations");
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = files.filter((f) => !appliedSet.has(f));

  if (pending.length === 0) {
    console.log("All migrations already applied. Nothing to do.");
    await client.end();
    return;
  }

  console.log(`Applying ${pending.length} migration(s)...`);

  for (const filename of pending) {
    const sql = await readFile(join(migrationsDir, filename), "utf-8");
    process.stdout.write(`  ${filename} ... `);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.log("done");
    } catch (err) {
      await client.query("ROLLBACK");
      console.log("FAILED");
      console.error(`\nError in ${filename}:\n${err.message}\n`);
      console.error("Migration rolled back. Fix the error and run again.");
      await client.end();
      process.exit(1);
    }
  }

  console.log("\nAll migrations applied successfully.");
  await client.end();
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
