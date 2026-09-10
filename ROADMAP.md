# Roadmap

Reference only. Nothing here is worked on unless explicitly requested.

Full context: `docs/DOMAIN.md`, `docs/decisions/`, and the planning notes.

## Phase 1 — skeleton ✅ (current)

Monorepo scaffold, auth wired end to end, DB + reversible migrations, CI. No
habit features.

## Phase 2 — domain core

Implement in `@tracker/core`, timezone-aware, fully unit-tested:

- `Habit` / `HabitView` / `HabitLog` model and persistence schema
- the five view calculations: cumulative, streak, percentage, days, since
- target evaluation (`at_least` / `at_most` / `exactly`)
- green→orange→red highlight mapping

## Phase 3 — habits & logs API + dashboard

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
