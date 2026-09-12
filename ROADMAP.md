# Roadmap

Reference only. Nothing here is worked on unless explicitly requested.

Full context: `docs/DOMAIN.md`, `docs/decisions/`, and the planning notes.

## Phase 1 — skeleton ✅

Monorepo scaffold, auth wired end to end, DB + reversible migrations, CI. No
habit features.

## Phase 2 — domain core ✅

Implemented in `@tracker/core`, timezone-aware (Luxon), fully unit-tested (80
tests): the five view calculations (cumulative, streak, percentage, days,
since), target evaluation (`at_least` / `at_most` / `exactly`), and the
green→orange→red highlight mapping. Pure logic only — no DB schema yet; the
`Habit` / `HabitView` / `HabitLog` persistence schema is Phase 3's job, built
alongside the routes that need it.

## Phase 3 — habits & logs API + dashboard ✅

`Habit`/`HabitView`/`HabitLog` DB tables + migration; authenticated,
user-scoped CRUD for habits/views (including hard delete) and log creation
(`@tracker/backend`); the real dashboard, add/edit habit forms (with the
streak warning), and a log-with-notes screen (`@tracker/mobile`), all
computing view values and highlight colours client-side via `@tracker/core`.

## Phase 4 — log management ✅

A per-habit log list (`@tracker/mobile`) merging logs with start-date-history
markers, add/edit/delete per log, and "Archive log" badges for logs predating
the current start date. Start-date changes: editing past existing logs
prompts Archive-vs-Keep — Keep auto-records history via an extended
`PATCH /api/habits/:id` (`@tracker/backend`, a new `habit_start_date_change`
table); Archive uses a new archive-and-clone endpoint. An archived-habits
area with unarchive, filtered off the main dashboard.

## Phase 5 — offline outbox (current)

- local cache + mutation queue + reconnect replay + last-write-wins
- wired into logging and edits on web and native

## Phase 6 — targets & polish

- targets for days & percentage, 2-decimal display setting
- empty states, error states
- EAS build, App Store assets and submission
