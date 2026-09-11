# Changelog

All notable changes to `@tracker/mobile` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-09-11

### Added

- Real dashboard (`(app)/index.tsx`): lists habits with computed view tiles
  (cumulative/streak/percentage/days/since, each computed client-side via
  `@tracker/core`'s `computeHabitView`) tinted by `computeHighlight`'s
  green→orange→red mapping. A simple-tap Log button per habit.
- Add/edit habit form (`HabitForm`) covering name, start date, and a
  repeatable view editor (kind, unit, days window, cumulation goal,
  target/target-type), including the streak demotivation warning
  (`StreakWarning`) and a delete action on the edit screen.
- Log-with-notes screen.
- `src/api/`: a thin fetch layer (`apiFetch`, `listHabits`/`createHabit`/
  `updateHabit`/`deleteHabit`/`createLog`) built on `authClient.$fetch`, which
  already authenticates transparently on both web (cookie) and native
  (SecureStore-backed bearer/cookie) — no platform-specific code needed.
- `useCurrentUser()` (centralizes the session→timezone cast) and `useHabits()`
  (plain-hooks list query + refetch; no data-fetching library, matching the
  app's existing minimalism — revisit in Phase 5's offline work).
- `src/lib/theme.ts`: centralizes the app's UI palette (previously hardcoded
  per-file); deliberately kept separate from `@tracker/core`'s highlight
  colors, which stay a distinct, opaque semantic system.
- `src/lib/view-format.ts`: display-only formatting for computed view results
  ("X out of N", %, unit pluralization) — kept out of `@tracker/core`, which
  stays pure math.
- `offline/outbox.ts`: added the missing `"habit.delete"` mutation kind
  (outbox itself still a no-op stub until Phase 5).

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
