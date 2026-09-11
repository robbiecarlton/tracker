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

## Phase 3 — habits & logs API + dashboard (current)

- `Habit` / `HabitView` / `HabitLog` DB tables + migration
- CRUD for habits and their views
- logging: simple + with notes
- dashboard rendering each view's value and highlight colour
- add / edit habit forms, including the streak warning text

## Phase 4 — log management

- per-habit log list: add past logs, edit, delete
- start-date changes: archive-and-clone or keep-with-inline-history
- archived habits area

## Phase 5 — offline outbox

- local cache + mutation queue + reconnect replay + last-write-wins
- wired into logging and edits on web and native

## Phase 6 — targets & polish

- targets for days & percentage, 2-decimal display setting
- empty states, error states
- EAS build, App Store assets and submission
