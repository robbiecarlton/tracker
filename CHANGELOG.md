# Changelog — Tracker (unified)

Unified log across the monorepo. Per-package detail lives in
`apps/backend/CHANGELOG.md`, `apps/mobile/CHANGELOG.md`, and
`packages/core/CHANGELOG.md`.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## 2026-09-11 — Phase 3 habits & logs API + dashboard

### Added

- **`@tracker/core` 0.3.0**: `habit-schemas.ts` (shared Zod validation for the
  habit/view/log forms, used by both the backend and the mobile app) and
  `DEFAULT_HABIT_VIEWS`. **Breaking**: `HabitView` now carries `id`/`habitId`/
  `createdAt`/`updatedAt` — it's a real persisted row as of this phase, not
  just inline calculation config.
- **`@tracker/backend` 0.2.0**: `habit`/`habit_view`/`habit_log` tables
  (migration `0002_add_habits`); authenticated, user-scoped CRUD for habits
  and their views (including a hard delete) plus log creation. Pure
  persistence — no view-calculation logic here; the backend returns raw data
  and the client computes.
- **`@tracker/mobile` 0.2.0**: the real dashboard, replacing the placeholder —
  habit cards with per-view tiles computed client-side via `@tracker/core`
  (`computeHabitView` + `computeHighlight`), a log button, add/edit habit
  forms (with the streak warning), a log-with-notes screen, a new `src/api/`
  fetch layer, and a centralized UI theme.

## 2026-09-11 — Phase 2 domain core

### Added

- **`@tracker/core` 0.2.0**: the five habit view calculations (cumulative,
  streak, percentage, days, since), timezone-aware via Luxon and fully
  unit-tested (80 tests), including DST transitions; target evaluation
  (`at_least` / `at_most` / `exactly`); green → orange → red dashboard
  highlight color mapping. Core logic only — no persistence yet; habits/views/
  logs get DB tables in Phase 3 alongside the CRUD API.

## 2026-09-10 — Phase 1 skeleton

Initial scaffold. No habit-tracking features yet.

### Added

- **Monorepo**: npm workspaces + Turborepo; top-level `dev` / `build` / `test` /
  `lint` / `typecheck` / `db:*` commands; shared TS, ESLint, and Prettier config.
- **`@tracker/backend` 0.1.0**: Fastify server, `GET /health`, authenticated
  `GET /api/me`; Better Auth (email + password) at `/api/auth/*` with a
  `timezone` field on the user; Drizzle `pg` dialect with a PGlite/Postgres
  runtime driver switch; plain-SQL forward/backward migration runner and the
  `0001_init` migration; Vitest coverage for health and the signup round-trip.
- **`@tracker/mobile` 0.1.0**: Expo Router app for iOS + web; sign-in / sign-up
  screens with shared Zod validation; session-gated route groups; device
  timezone captured at signup; placeholder dashboard; offline outbox stub; Metro
  monorepo config.
- **`@tracker/core` 0.1.0**: `Unit` enum + guard, domain model type stubs, shared
  auth Zod schemas. No view calculations yet.
- **Docs**: `docs/DOMAIN.md` (view-calculation spec for later phases), seven ADRs
  in `docs/decisions/`, `ROADMAP.md`.
- **CI**: GitHub Actions running lint, typecheck, test, and build.
