// Scaffolds a new plain-SQL migration pair in drizzle/.
// Usage: npm run db:generate -- <name>
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const name = process.argv[2];
if (!name) {
  console.error("Usage: npm run db:generate -- <name>");
  process.exit(1);
}

const dir = resolve(process.cwd(), "drizzle");
mkdirSync(dir, { recursive: true });

const existing = readdirSync(dir)
  .filter((f) => f.endsWith(".up.sql"))
  .map((f) => parseInt(f.slice(0, 4), 10))
  .filter((n) => !Number.isNaN(n));
const next = String((existing.length ? Math.max(...existing) : 0) + 1).padStart(4, "0");
const slug = name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_|_$/g, "");
const base = `${next}_${slug}`;

writeFileSync(resolve(dir, `${base}.up.sql`), `-- ${base} (up)\n\n`);
writeFileSync(resolve(dir, `${base}.down.sql`), `-- ${base} (down)\n\n`);
console.log(`Created drizzle/${base}.up.sql and drizzle/${base}.down.sql`);
