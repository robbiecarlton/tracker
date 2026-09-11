# @tracker/backend

Fastify API for the habit tracker.

## Stack

- **Fastify 5** HTTP server
- **Better Auth** — email + password, sessions (cookie for web, bearer token for
  the Expo app via `@better-auth/expo`)
- **Drizzle ORM**, `pg` dialect. The driver is chosen at runtime from
  `DATABASE_URL`:
  - `pglite://./.data/dev` — on-disk PGlite (in-process, no server) for local dev
  - `pglite://memory://` — in-memory PGlite, used by the tests
  - `postgres://…` — hosted Postgres in production
- **Plain-SQL migrations** in [`drizzle/`](./drizzle) with matching `.up.sql` /
  `.down.sql` files, applied by a small journaled runner (`src/db/migrator.ts`).
  Chosen over drizzle-kit's forward-only migrations so the schema rolls both
  ways; can be swapped for Atlas/drizzle-kit later without touching app code.

## Run

```bash
cp .env.example .env            # optional — every var has a dev default
npm run db:migrate              # create tables in the local PGlite db
npm run dev                     # tsx watch on http://localhost:4000
```

`npm run dev` also runs pending migrations on boot.

## Endpoints

| Method | Path                   | Auth | Notes                                                              |
| ------ | ---------------------- | ---- | ------------------------------------------------------------------ |
| GET    | `/health`              | no   | `{ "status": "ok" }`                                               |
| \*     | `/api/auth/*`          | —    | Better Auth (sign-up, sign-in, etc.)                               |
| GET    | `/api/me`              | yes  | current user; `401` when unauthorized                              |
| GET    | `/api/habits`          | yes  | the caller's habits, each with nested `views`/`logs`               |
| POST   | `/api/habits`          | yes  | create; empty/omitted `views` gets the default view set            |
| PATCH  | `/api/habits/:id`      | yes  | update; `views` is replaced wholesale; `404` if not the caller's   |
| DELETE | `/api/habits/:id`      | yes  | hard delete, cascades to its views/logs; `404` if not the caller's |
| POST   | `/api/habits/:id/logs` | yes  | create a log (simple or with `notes`); `404` if not the caller's   |

Request bodies are validated with `@tracker/core`'s `habit-schemas.ts` — the
same schemas the mobile app's forms use. View calculations (cumulative,
streak, percentage, days, since) are **not** computed here; the client
computes them from the raw data via `@tracker/core`.

## Database commands

```bash
npm run db:generate -- add_habits   # scaffold drizzle/NNNN_add_habits.{up,down}.sql
npm run db:migrate                  # apply pending .up.sql migrations
npm run db:rollback                 # revert the most recent migration (.down.sql)
npm run db:reset                    # delete .data/ and re-migrate (PGlite only)
```

When you change `src/db/schema.ts`, write the matching SQL in a new migration
pair — the SQL files are the source of truth for the DDL.

## Test / check / build

```bash
npm test           # vitest (in-memory PGlite)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # tsup -> dist/ (bundles @tracker/core)
```
