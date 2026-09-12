# Changelog

All notable changes to `@tracker/mobile` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.3] - 2026-09-12

### Added

- A `start` script (`serve -s dist -l $PORT`) and a new `serve` dependency,
  so the static web export (`npm run build`) can actually be served in
  production — previously nothing did. `-s` is `serve`'s single-page-app
  flag: any not-found path falls back to `index.html`, which Expo Router's
  client-side history-based routing then resolves — needed because dynamic
  routes (`[id]`, `[logId]`) export as literal bracket-named files, not
  per-instance pages. See `docs/RAILWAY.md`.

## [0.3.2] - 2026-09-12

### Added

- Extended `0.3.1`'s back buttons to the log form (add and edit) as well —
  same `BackButton`, same reasoning.

## [0.3.1] - 2026-09-12

### Fixed

- A new habit's default start date used `new Date().toISOString().slice(0, 10)`
  — UTC's current date, not the user's. Anyone west of UTC in the evening got
  "tomorrow" as the default (e.g. 8pm in America/Denver is already the next
  day in UTC). Fixed with a new `todayInZone()` (`lib/date-format.ts`);
  `HabitForm` now takes a required `timeZone` prop to compute this default
  when creating a habit (an explicit `initialStartDate`, as when editing, is
  unaffected and still wins).

### Added

- Back buttons (`components/ui.tsx`'s new `BackButton`) on the habit form
  (add and edit), the per-habit logs page, and the archived-habits page —
  previously the only way off those screens was a swipe/hardware-back
  gesture or (on the form) successfully submitting.

## [0.3.0] - 2026-09-12

### Added

- Per-habit log list (`habits/[id]/logs/`): a reverse-chronological feed
  merging logs with start-date-change markers, each log older than the
  habit's current start date visually flagged with an "Archive log" badge;
  edit/delete per log.
- `LogForm` — merges what used to be two separate flows ("log with notes"
  and "add a past log") into one shared create/edit form; the old
  `habits/[id]/log.tsx` is retired.
- Start-date-change handling: editing a habit's start date past logs that
  predate it now prompts Archive-vs-Keep (`docs/DOMAIN.md`'s "Start-date
  changes") — Keep is an ordinary save (the backend auto-records history),
  Archive calls the new `archiveAndCloneHabit`.
- Archived-habits area (`habits/archived.tsx`) with an Unarchive action, and
  an "Archived" link on the dashboard, which now excludes archived habits
  from the main list.
- `lib/date-format.ts`: raw ISO ⇄ human display ⇄ user-typed local text for
  a log's timestamp (a different concern from `view-format.ts`, which
  formats computed view results, not raw dates). Adds `luxon` as a direct
  dependency (previously only reachable transitively via `@tracker/core`,
  which deliberately never exposes it across its own API).
- `api/habits.ts`: `updateLog`, `deleteLog`, `archiveHabit`, `unarchiveHabit`,
  `archiveAndCloneHabit`.
- `theme.ts`: a `badge` token for the "Archive log" marker and archived
  status.
- `offline/outbox.ts`: added `"habit.archive"`/`"habit.unarchive"` mutation
  kinds (outbox itself still a no-op stub until Phase 5).
- `HabitCard`: a one-tap "+ note" link back to `logs/new` alongside the plain
  Log button and the Logs list link (the Phase 3 "log with notes" shortcut,
  dropped when the logs list replaced it — restored per-habit, not just
  reachable from the list).

### Fixed

- **`Alert.alert` was a complete no-op on web** (`react-native-web` ships it
  as `static alert() {}`), silently swallowing every confirmation dialog:
  delete habit, delete log (both the list and the edit-log screen), and the
  entire Archive-vs-Keep start-date prompt. Replaced every `Alert.alert` call
  with a new `lib/confirm.tsx` (`confirmAlert` + `<ConfirmHost />`, mounted
  once at the app root) built on RN's `Modal`, which `react-native-web` does
  implement for real.

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
