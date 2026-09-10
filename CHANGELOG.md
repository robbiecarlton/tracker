# Changelog — Tracker (unified)

Unified log across the monorepo. Per-package detail lives in
`apps/backend/CHANGELOG.md`, `apps/mobile/CHANGELOG.md`, and
`packages/core/CHANGELOG.md`.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
