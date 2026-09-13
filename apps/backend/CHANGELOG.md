# Changelog

All notable changes to `@tracker/backend` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-09-12

### Added

- Nested habits: `habit` gains a self-referential `parent_id` (migration
  `0004_add_habit_nesting`, `ON DELETE RESTRICT` — app code always resolves
  a habit's children before removing it) and `allow_direct_logging`.
  `POST`/`PATCH /api/habits` validate `parentId` (must be an owned habit,
  no cycles) and `allowDirectLogging` (can only be `false` once the habit
  has ≥1 non-archived subhabit). `POST /api/habits/:id/logs` rejects a
  direct log with `direct_logging_disabled` once that's set.
- `DELETE /api/habits/:id` and `POST /api/habits/:id/archive` now handle a
  habit's active (non-archived) subhabits: with none, they behave as
  before; with some, they require `?childrenAction=cascade|top_level|
  grandparent` — apply the same action to the whole subtree, promote direct
  children to top-level, or (delete only, when the habit itself has a
  parent) rehome them under it. Grandchildren and below are never touched —
  only their immediate parent's identity changes.
- `POST /api/habits/:id/archive-and-clone` now rejects (`has_active_subhabits`)
  when the habit has any non-archived children — the clone gets a fresh id,
  so re-parenting them onto it isn't handled yet; resolve subhabits via the
  plain archive/delete actions first.

## [0.3.1] - 2026-09-12

### Fixed

- Sign-in would silently fail to persist once the web frontend and this API
  are deployed as separate services on different domains (e.g. two Railway
  subdomains) — a cross-*site* `fetch`, not just cross-origin like local
  dev's two localhost ports. Better Auth's cookie default
  (`sameSite: "lax"`) is same-site-only, so the browser wouldn't attach the
  session cookie there. Fixed with `auth.ts`'s `advanced.defaultCookieAttributes`,
  set to `"none"` only when `NODE_ENV=production` (must stay `"lax"` in dev,
  where `WEB_ORIGIN` is `http://` and a `SameSite=None` cookie without
  `Secure` is just dropped). See `docs/RAILWAY.md`.

## [0.3.0] - 2026-09-12

### Added

- `habit_start_date_change` table (migration `0003_add_start_date_history`):
  an immutable audit row per start-date edit, so the log view can show every
  past start date inline (`docs/DOMAIN.md`'s "keep" path). `PATCH
  /api/habits/:id` now records one automatically whenever the submitted
  `startDate` differs from the stored value — no separate endpoint needed for
  "keep".
- Per-log edit/delete: `PATCH` / `DELETE /api/habits/:habitId/logs/:logId`,
  scoped to both the owning habit and the specific log (404 covers wrong
  user, wrong log, or a log belonging to the user's *other* habit).
- Habit archiving: `POST /api/habits/:id/archive` and `.../unarchive` (the
  latter added proactively — an archive area with no way back is a dead
  end), and `POST /api/habits/:id/archive-and-clone` (one transaction:
  archives the existing habit exactly as it stood — logs included, never
  moved or copied — and creates a fresh habit from the submitted
  `{name, startDate, views}`).
- `GET /api/habits` responses now include `startDateHistory` per habit.
  Archived habits are **not** filtered out server-side — the client filters
  client-side at this app's scale.
- Vitest coverage in two new files (`habit-logs.test.ts`,
  `habit-archive.test.ts`), plus `habits.test.ts`'s shared auth helpers
  extracted to `test/helpers.ts`.

## [0.2.1] - 2026-09-11

### Fixed

- CORS: `@fastify/cors` defaults to allowing only `GET, HEAD, POST`
  cross-origin. `PATCH`/`DELETE` (habit edit/delete) aren't "simple" methods,
  so a cross-origin request triggers a preflight the browser then silently
  blocks when the server doesn't advertise the method — breaking habit
  edit/delete from web (native RN fetch doesn't enforce CORS, so this was
  web-only). Fixed by explicitly listing `methods` in the CORS config.
  (This fix shipped in commit `be64c1f` without a version bump at the time —
  recorded here for the record.)

## [0.2.0] - 2026-09-11

### Added

- `habit` / `habit_view` / `habit_log` tables (migration `0002_add_habits`),
  scoped by `user_id` with cascading deletes.
- CRUD routes for habits and their views, plus log creation, all authenticated
  and scoped to the requesting user (404, not 403, for another user's habit):
  `GET /api/habits`, `POST /api/habits`, `PATCH /api/habits/:id`,
  `DELETE /api/habits/:id`, `POST /api/habits/:id/logs`. Views are replaced
  wholesale on every `PATCH` rather than diffed by id. A new habit with no
  `views` in the request gets `@tracker/core`'s `DEFAULT_HABIT_VIEWS`.
  Request bodies validated with `@tracker/core`'s `habit-schemas.ts` via a new
  shared `parseBody` helper (`src/lib/validate.ts`) — needed because the raw
  JSON content-type parser used for Better Auth bypasses Fastify's normal
  automatic body parsing.
- View calculations are **not** done here — the backend returns raw
  habit/view/log data; `@tracker/mobile` computes each view's value and
  highlight color client-side via `@tracker/core`.
- Vitest coverage for the new routes: auth-gating, a full create → list →
  update → delete round trip, default-views-on-create, validation errors,
  cross-user isolation, and log creation.

## [0.1.0] - 2026-09-10

### Added

- Fastify server skeleton with `GET /health` and an authenticated `GET /api/me`.
- Better Auth (email + password) mounted at `/api/auth/*`, with a `timezone`
  field captured on the user at signup.
- Drizzle (`pg` dialect) with a runtime driver switch: PGlite for
  `pglite://` URLs (dev + tests), `node-postgres` for `postgres://` URLs.
- Plain-SQL forward/backward migration runner (`db:migrate`, `db:rollback`,
  `db:reset`, `db:generate`) journaled in `__migrations`; initial migration
  `0001_init` creates the Better Auth core tables.
- Vitest coverage for the healthcheck and the signup → `/api/me` round-trip
  (runs against in-memory PGlite).
