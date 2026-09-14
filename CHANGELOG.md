# Changelog — Tracker (unified)

Unified log across the monorepo. Per-package detail lives in
`apps/backend/CHANGELOG.md`, `apps/mobile/CHANGELOG.md`, and
`packages/core/CHANGELOG.md`.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## 2026-09-13 — Fix web drag-to-reorder and scroll

**`@tracker/mobile` 0.6.1**: `react-native-draggable-flatlist` broke both
dragging and ordinary scrolling on the web build (its gesture-handler stack
has no real web support). Web now uses native HTML5 drag-and-drop instead;
iOS is unaffected, still on the original library. Also: the heatmap's
legend now shows its unit ("Day"/"Week"/"Month") instead of the word
"Heatmap".

## 2026-09-12 — Custom sort order + heatmap view

Habits can now be dragged into whatever order you like (top-level, or
within one parent's subhabits), and gain a sixth view type: a
GitHub/Anki-style calendar heatmap with a configurable day/week/month box
size.

### Added

- **`@tracker/core` 0.7.0**: `Habit.sortOrder`, `reorderHabitsSchema`;
  `HeatmapResult`/`computeHeatmap`/`countLogsByUnit`, `"heatmap"` added to
  `ViewKind`.
- **`@tracker/backend` 0.5.0**: `habit.sort_order` (migration `0005`),
  `PATCH /api/habits/reorder`; every create/reparent path appends to the
  end of the new sibling group.
- **`@tracker/mobile` 0.6.0**: drag-to-reorder on the dashboard (new
  `react-native-gesture-handler`/`reanimated`/`draggable-flatlist`
  dependencies); a `Heatmap` view kind selectable on the habit form,
  rendered as a full-width calendar grid on `HabitCard`.

## 2026-09-12 — Version badge

### Added

- **`@tracker/mobile` 0.5.0**: a small `v<version>` label pinned top-right
  on every screen, auth pages included — reads the app's own
  `package.json` version at build time.

## 2026-09-12 — Nested habits

A habit can now have subhabits, arbitrarily nested (e.g. "Bad habits" →
"Smoking"/"Drinking", or "Exercise" → "Run"/"Lift"). Logging a subhabit
counts toward every ancestor's view calculations; a parent can optionally
disable being logged directly, requiring all logging to go through its
children. See `docs/DOMAIN.md`'s "Nested habits".

### Added

- **`@tracker/core` 0.6.0**: `Habit.parentId`/`allowDirectLogging`, and a new
  `habit-tree.ts` module (`childrenOf`, `getDescendants`, `wouldCreateCycle`,
  `aggregatedLogs`, `buildDashboardRows`) shared by the backend and mobile.
- **`@tracker/backend` 0.4.0**: `habit.parent_id`/`allow_direct_logging`
  (migration `0004`), parent/cycle/subhabit-count validation on
  create/patch, `direct_logging_disabled` on a gated log attempt, and a
  `childrenAction` (`cascade`/`top_level`/`grandparent`) query param on
  delete and archive for habits with active subhabits.
- **`@tracker/mobile` 0.4.0**: a parent-habit picker and direct-logging
  toggle on the create/edit form; the dashboard renders subhabits indented
  under their parent with a persisted (local-only) expand/collapse control;
  a new direct **Archive** action alongside Delete, both prompting how to
  resolve active subhabits; the per-habit log list gains an "All logs" /
  "This habit only" filter with source-habit badges on rolled-up logs.

## 2026-09-12 — Railway deployment

Added `docs/RAILWAY.md`, a full runbook for deploying the backend + web
frontend + a managed Postgres to Railway as two separate services.

### Fixed

- **`@tracker/backend` 0.3.1**: cross-site sign-in — the web frontend and
  this API are separate Railway services on different domains, and Better
  Auth's cookie default (`sameSite: "lax"`) isn't sent on a cross-site
  `fetch`. Fixed with an env-gated `advanced.defaultCookieAttributes` in
  `auth.ts` (stays `"lax"` in local dev).

### Added

- **`@tracker/mobile` 0.3.3**: a production `start` script (`serve -s dist`)
  — nothing previously served the static web export outside local dev.

## 2026-09-12 — Post-Phase-4 fixes

### Fixed

- **`@tracker/mobile` 0.3.1**: a new habit's default start date used
  `new Date().toISOString()` — UTC's current date, not the user's — so
  anyone west of UTC in the evening got "tomorrow" as the default. Fixed
  with a new `todayInZone()` helper.

### Added

- **`@tracker/mobile` 0.3.1**: back buttons on the habit form, the per-habit
  logs page, and the archived-habits page.
- **`@tracker/mobile` 0.3.2**: extended the same back button to the log form
  (add and edit).

## 2026-09-12 — Phase 4 log management

### Added

- **`@tracker/core` 0.5.0**: `HabitStartDateChange` (an immutable audit
  record of a habit's start-date edits) and `updateLogSchema`; tightened
  `createLogSchema.timestamp` validation to the same strict-parse standard as
  `habitFormSchema.startDate`.
- **`@tracker/backend` 0.3.0**: a `habit_start_date_change` table (migration
  `0003`) — `PATCH /api/habits/:id` now auto-records history whenever
  `startDate` changes, which is the entire "keep" path from
  `docs/DOMAIN.md`'s "Start-date changes". Per-log edit/delete endpoints;
  habit archive/unarchive/archive-and-clone (the last archives a habit
  exactly as it stood — logs included, never moved — and creates a fresh one
  from the submitted config).
- **`@tracker/mobile` 0.3.0**: a per-habit log list merging logs with
  start-date-history markers, with "Archive log" badges for logs predating
  the current start date; a merged add/edit log form (retiring the separate
  "log with notes" screen); an Archive-vs-Keep prompt when editing a start
  date past existing logs; an archived-habits area with unarchive, and a
  matching dashboard filter/link. A one-tap "+ note" link on each habit card,
  restoring the Phase 3 quick-log-with-notes shortcut alongside the new logs
  list.

### Fixed

- **`@tracker/backend` 0.2.1** (retroactively recorded — this shipped without
  a version bump at the time, in commit `be64c1f`): `@fastify/cors` defaults
  to `GET, HEAD, POST` only, silently blocking `PATCH`/`DELETE` (habit
  edit/delete) from the browser via a failed CORS preflight. Fixed by
  explicitly listing `methods` in the CORS config.
- **`@tracker/mobile` 0.3.0**: `Alert.alert` is a complete no-op on web
  (`react-native-web`), silently breaking every confirmation dialog —
  deleting a habit or a log, and the entire Archive-vs-Keep start-date
  prompt. Replaced with a custom `Modal`-backed confirm dialog
  (`lib/confirm.tsx`), which `react-native-web` implements for real.

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
