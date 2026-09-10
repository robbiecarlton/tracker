# 4. Plain-SQL migrations with a small forward/backward runner

Date: 2026-09-10
Status: accepted

## Context

Project convention: the schema must roll **forward and back**. Drizzle Kit
generates forward-only migrations — no `down` step — so it doesn't meet that
requirement on its own. We still want Drizzle ORM for typed queries.

## Decision

Keep Drizzle ORM for queries. Manage schema with **plain-SQL migration pairs**:

```
apps/backend/drizzle/
  0001_init.up.sql
  0001_init.down.sql
```

A ~40-line runner (`src/db/migrator.ts`) applies pending `.up.sql` files in
order, journals applied ids in a `__migrations` table, and reverts the most
recent one with its `.down.sql`. It only uses `exec` / `query`, so it runs
identically on PGlite and hosted Postgres.

`src/db/schema.ts` mirrors the SQL for typed queries; the SQL files are the
source of truth for DDL. `npm run db:generate -- <name>` scaffolds the next pair.

## Consequences

- True `db:rollback`; `db:reset` for a clean rebuild.
- Schema drift between `schema.ts` and the SQL is a manual concern — keep them in
  the same commit.
- No schema-diffing / lint. If we want that later, Atlas (which does support
  versioned down migrations) can replace the runner without touching app code.
