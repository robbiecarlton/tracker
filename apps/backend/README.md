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

| Method | Path                                | Auth | Notes                                                                                                   |
| ------ | ----------------------------------- | ---- | ------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                           | no   | `{ "status": "ok" }`                                                                                    |
| \*     | `/api/auth/*`                       | —    | Better Auth (sign-up, sign-in, etc.)                                                                    |
| GET    | `/api/me`                           | yes  | current user; `401` when unauthorized                                                                   |
| GET    | `/api/habits`                       | yes  | the caller's habits, each with nested `views`/`logs`/`startDateHistory`                                 |
| POST   | `/api/habits`                       | yes  | create; empty/omitted `views` gets the default view set                                                 |
| PATCH  | `/api/habits/:id`                   | yes  | update; `views` replaced wholesale; records start-date history if it changed; `404` if not the caller's |
| DELETE | `/api/habits/:id`                   | yes  | hard delete, cascades to its views/logs; `404` if not the caller's                                      |
| POST   | `/api/habits/:id/logs`              | yes  | create a log (simple or with `notes`); `404` if not the caller's                                        |
| PATCH  | `/api/habits/:habitId/logs/:logId`  | yes  | edit a log; `404` if not the caller's, or `logId` doesn't belong to `habitId`                           |
| DELETE | `/api/habits/:habitId/logs/:logId`  | yes  | delete a log; same 404 scoping as edit                                                                  |
| POST   | `/api/habits/:id/archive`           | yes  | sets `archivedAt`; `404` if not the caller's                                                            |
| POST   | `/api/habits/:id/unarchive`         | yes  | clears `archivedAt`                                                                                     |
| POST   | `/api/habits/:id/archive-and-clone` | yes  | archives the habit as-is (logs stay put) and creates a fresh one from the submitted config              |

Request bodies are validated with `@tracker/core`'s `habit-schemas.ts` — the
same schemas the mobile app's forms use. View calculations (cumulative,
streak, percentage, days, since) are **not** computed here; the client
computes them from the raw data via `@tracker/core`. Archived habits are
returned unfiltered by `GET /api/habits` — the client decides what to show.

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
