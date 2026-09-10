# 3. PGlite for dev, hosted Postgres for production — one dialect

Date: 2026-09-10
Status: accepted

## Context

We want Postgres in production but local Postgres setup is friction. Starting on
SQLite and migrating later costs a schema rewrite (Drizzle has separate SQLite
and Postgres dialects), a migration-history reset, Better Auth table
regeneration, and a tail of SQLite-ism bugs — and it lands right when we're
trying to ship features.

## Decision

Use the Drizzle **`pg` dialect everywhere**. The driver is chosen at runtime
from `DATABASE_URL`:

| URL                    | Driver                      | Used for          |
| ---------------------- | --------------------------- | ----------------- |
| `pglite://./.data/dev` | `drizzle-orm/pglite`        | local development |
| `pglite://memory://`   | `drizzle-orm/pglite`        | tests (in-memory) |
| `postgres://…`         | `drizzle-orm/node-postgres` | production        |

PGlite is real Postgres compiled to WASM, running in-process — an npm package,
no Docker, no daemon. Same schema, same migrations, no engine switch ever.

## Consequences

- Zero local database setup; `npm run db:migrate` just works.
- PGlite is single-connection and not for production load — that's fine, it is
  dev/test only.
- Production still needs a managed Postgres; provisioning is a deploy concern,
  out of scope for Phase 1.

## Related

See [0004 — migrations](0004-migrations.md).
