# Changelog

All notable changes to `@tracker/backend` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
