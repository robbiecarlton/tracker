# Domain model & view calculations

Status: **implemented** in `@tracker/core` (Phase 2) — see `packages/core/src/{time,views,targets,highlight}.ts`.
Persistence (habit/view/log DB tables + CRUD API) lands in Phase 3.
Source of the requirements: `INITIALSPEC.md`.

## Entities

### Habit

| Field           | Notes                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `name`          |                                                                                                |
| `startDate`     | Current start date. Prior start dates are retained on the timeline.                            |
| `views`         | One or more (see below). Switchable any time; multiple active.                                 |
| per-view config | streak unit; cumulation goal; percentage unit/target/target-type; days unit/target/target-type |
| `archivedAt`    | Archived habits leave the dashboard but keep their config.                                     |
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

## Offline (Phase 5)

Lightweight outbox: a local queue of mutations (log/edit/delete) applied
optimistically and replayed on reconnect. Server authoritative; conflicts
resolved last-write-wins by `updatedAt`. Reads need a recent pull (on app open /
focus). No bidirectional sync engine in v1.
