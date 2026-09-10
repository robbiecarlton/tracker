# Changelog

All notable changes to `@tracker/mobile` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-10

### Added

- Expo Router app targeting iOS and web from one codebase (SDK 57).
- Auth flow: sign-in and sign-up screens (Zod-validated via `@tracker/core`),
  Better Auth client with SecureStore-backed sessions on native, session-gated
  route groups `(auth)` / `(app)`.
- Device timezone captured at signup and sent to the backend.
- Placeholder authenticated dashboard with sign-out.
- Offline outbox interface stub (`src/offline/outbox.ts`) for Phase 5.
- Metro config for the npm-workspaces monorepo.
