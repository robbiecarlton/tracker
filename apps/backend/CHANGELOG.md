# Changelog

All notable changes to `@tracker/backend` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
