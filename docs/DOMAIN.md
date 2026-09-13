# Domain model & view calculations

Status: **implemented**. View calculations, target evaluation, and highlight
mapping live in `@tracker/core` (Phase 2) — see
`packages/core/src/{time,views,targets,highlight}.ts`. Persistence
(`habit`/`habit_view`/`habit_log` tables + CRUD API) and the dashboard/forms
that use it landed in Phase 3 — see `apps/backend/src/routes/habits.ts` and
`apps/mobile/src/components/{HabitCard,HabitForm}.tsx`. Log
management, start-date archive/keep-with-history, and the archived-habits
area (below) landed in Phase 4 — see `apps/backend/src/db/schema.ts`'s
`habit_start_date_change` table and `apps/mobile/src/app/(app)/habits/`'s
`logs/` and `archived.tsx` screens. Nested habits (below) landed after
Phase 4 — see `packages/core/src/habit-tree.ts`. Source of the
requirements: `INITIALSPEC.md`.

## Entities

### Habit

| Field           | Notes                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `name`          |                                                                                                |
| `startDate`     | Current start date. Prior start dates are retained on the timeline.                            |
| `views`         | One or more (see below). Switchable any time; multiple active.                                 |
| per-view config | streak unit; cumulation goal; percentage unit/target/target-type; days unit/target/target-type |
| `archivedAt`    | Archived habits leave the dashboard but keep their config.                                     |
| `parentId`      | Nested habits (below). `null` = top-level.                                                     |
| `allowDirectLogging` | Nested habits (below). Defaults `true`.                                                   |
| logs            | Zero or more.                                                                                  |

### Log

| Field       | Notes                                                   |
| ----------- | ------------------------------------------------------- |
| `timestamp` | When the habit was performed. Multiple per day allowed. |
| `notes`     | Optional. Added via "log with notes".                   |

Logs can be added for past times, edited, and deleted from a per-habit log view.

## Views

Units: `hour` \| `day` \| `week` \| `month`. Unit defaults to `day`.
A new habit defaults to two views: **Cumulative** and **Days out of 7**.

| View           | Value                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cumulative** | Total number of logs since the start date. Optional cumulation goal.                                                                                           |
| **Streak**     | Consecutive `unit`s (each with ≥1 log) ending now.                                                                                                             |
| **Percentage** | `unitsWithAtLeastOneLog / totalUnitsSinceStartDate * 100%`.                                                                                                    |
| **Days**       | The Percentage **rate** × `N` (N = day count, default 7), shown as `X out of N`. Integer by default; 2 decimals when the setting is on (e.g. `5.14 out of 7`). |
| **Since**      | Number of `unit`s since the most recent log.                                                                                                                   |

All unit-boundary math is done in the user's IANA timezone (`user.timezone`,
captured at signup).

### Streak warning

The edit form shows this when Streak is selected:

> Be careful, tracking streaks has mixed benefits and can actually long term
> demotivate you. We suggest using cumulative and percentage or days instead.

## Targets (Days & Percentage only)

Optional `target` value plus `targetType`:

| `targetType` | Meaning                      |
| ------------ | ---------------------------- |
| `at_least`   | do better than / more than X |
| `at_most`    | stay under X                 |
| `exactly`    | hit X, no more no less       |

The dashboard tile highlight interpolates **green → orange → red** by how the
current value compares to the target, with the "good" direction determined by
`targetType`.

## Start-date changes

If the start date moves and logs exist before the new date, prompt the user:

- **Archive** the current habit and create a fresh one with identical config; or
- **Keep** it — the log view then shows every past start date inline with the
  logs, and any log older than the current start date is visually marked as an
  "archive log".

## Nested habits

A habit can have subhabits, arbitrarily deep (e.g. a "Bad habits" parent
with "Smoking"/"Drinking" children, or "Exercise" with "Run"/"Lift"). Each
habit has at most one parent (`parentId`, `null` = top-level); reparenting
to a habit's own descendant is rejected (would create a cycle).

- **Logging rolls up transitively.** Logging a subhabit counts as a log for
  every ancestor's view calculations too — an ancestor's views run over its
  own logs plus every non-archived descendant's (`@tracker/core`'s
  `aggregatedLogs`). Archiving a habit stops *its* logs (and its own
  descendants', recursively) from counting toward anything above it — the
  same "archived leaves the active view" rule as a top-level habit, applied
  to the whole subtree at once.
- **Direct logging can be disabled** (`allowDirectLogging`) once a habit has
  ≥1 non-archived subhabit — logging is then only possible via a child.
  Can't be turned off with zero subhabits (there'd be no way to log it at
  all), and reverts to meaningless-but-harmless if its last subhabit is
  later archived/moved away (the flag itself isn't auto-reset — the habit
  just can't be logged until either a new subhabit exists or the flag is
  turned back on).
- **Deleting or archiving a habit with active (non-archived) subhabits**
  prompts how to resolve its **direct** children (grandchildren and below
  always stay exactly where they are — only their immediate parent's
  identity ever changes):
  - Apply the same action to the whole subtree too (delete/archive
    everything below it), or
  - **Promote** them to top-level, or
  - **Rehome** them under this habit's own parent (only offered when this
    habit itself has one — otherwise identical to promoting).
- **Dashboard**: nothing is hidden by default — a parent renders normally,
  followed by an expand/collapse control (default expanded) and its visible
  subhabits indented directly beneath, each its own bordered card. Collapse
  state is local-only (not synced across devices).
- **Log list**: defaults to showing a habit's own logs plus every
  descendant's (labeled with its source habit), with a filter to narrow to
  just this habit's own.

## Offline (Phase 5)

Lightweight outbox: a local queue of mutations (log/edit/delete) applied
optimistically and replayed on reconnect. Server authoritative; conflicts
resolved last-write-wins by `updatedAt`. Reads need a recent pull (on app open /
focus). No bidirectional sync engine in v1.
