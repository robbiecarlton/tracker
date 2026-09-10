import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import { env, isPglite } from "../env";
import { schema } from "./schema";

/**
 * One Drizzle `pg` dialect, two drivers chosen from DATABASE_URL:
 *   pglite://<path|memory://>  -> in-process WASM Postgres (dev + tests)
 *   postgres://...             -> hosted Postgres (production)
 *
 * `rawClient` exposes the lowest-common-denominator operations the plain-SQL
 * migration runner needs, so it works identically on both drivers.
 */

export interface RawClient {
  exec(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(sql: string): Promise<T[]>;
  close(): Promise<void>;
}

function createPglite() {
  const target = env.DATABASE_URL.slice("pglite://".length) || "memory://";
  // PGlite doesn't create parent directories for a filesystem data dir.
  const isVirtual = target === "memory://" || target.startsWith("idb://");
  if (!isVirtual) {
    mkdirSync(target, { recursive: true });
  }
  const client = new PGlite(target);
  const db = drizzlePglite(client, { schema });
  const rawClient: RawClient = {
    async exec(sql) {
      await client.exec(sql);
    },
    async query<T>(sql: string) {
      const result = await client.query<T>(sql);
      return result.rows;
    },
    close: () => client.close(),
  };
  return { db, rawClient };
}

function createNodePg() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzleNodePg(pool, { schema });
  const rawClient: RawClient = {
    async exec(sql) {
      await pool.query(sql);
    },
    async query<T>(sql: string) {
      const result = await pool.query(sql);
      return result.rows as T[];
    },
    close: () => pool.end(),
  };
  return { db, rawClient };
}

const created = isPglite ? createPglite() : createNodePg();

export const db = created.db;
export const rawClient: RawClient = created.rawClient;
