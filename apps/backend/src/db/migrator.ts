import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { rawClient } from "./index";

/**
 * Minimal forward/backward SQL migration runner.
 *
 * Migrations live in `drizzle/` as pairs:
 *   NNNN_name.up.sql    applied by `runMigrations()`
 *   NNNN_name.down.sql  applied by `rollbackLast()`
 *
 * Applied ids are journaled in `__migrations`. Runs identically on PGlite and
 * hosted Postgres because it only uses `rawClient.exec` / `.query`.
 *
 * Resolved from cwd: every entry point (`db:migrate`, `db:rollback`, `dev`,
 * `start`, vitest) runs with the backend package as the working directory.
 */
const MIGRATIONS_DIR = resolve(process.cwd(), "drizzle");

async function ensureJournal(): Promise<void> {
  await rawClient.exec(
    `CREATE TABLE IF NOT EXISTS "__migrations" (
       "id" text PRIMARY KEY,
       "applied_at" timestamptz NOT NULL DEFAULT now()
     );`,
  );
}

function migrationIds(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".up.sql"))
    .map((f) => f.replace(/\.up\.sql$/, ""))
    .sort();
}

async function appliedIds(): Promise<string[]> {
  const rows = await rawClient.query<{ id: string }>(`SELECT id FROM "__migrations" ORDER BY id`);
  return rows.map((r) => r.id);
}

export async function runMigrations(): Promise<string[]> {
  await ensureJournal();
  const applied = new Set(await appliedIds());
  const pending = migrationIds().filter((id) => !applied.has(id));
  for (const id of pending) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, `${id}.up.sql`), "utf8");
    await rawClient.exec(sql);
    await rawClient.exec(`INSERT INTO "__migrations" ("id") VALUES ('${id}');`);
  }
  return pending;
}

export async function rollbackLast(): Promise<string | null> {
  await ensureJournal();
  const applied = await appliedIds();
  const last = applied.at(-1);
  if (!last) return null;
  const sql = readFileSync(resolve(MIGRATIONS_DIR, `${last}.down.sql`), "utf8");
  await rawClient.exec(sql);
  await rawClient.exec(`DELETE FROM "__migrations" WHERE id = '${last}';`);
  return last;
}
