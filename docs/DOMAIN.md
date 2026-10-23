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
`logs/` and `archived.tsx` screens. Nested habits, custom sort order, and
the Heatmap view (all below) landed after Phase 4 — see
`packages/core/src/habit-tree.ts` and `packages/core/src/views.ts`'s
`computeHeatmap`. Source of the requirements: `INITIALSPEC.md`.

## Entities

### Habit

| Field                | Notes                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `name`               |                                                                                                |
| `startDate`          | Current start date. Prior start dates are retained on the timeline.                            |
| `views`              | One or more (see below). Switchable any time; multiple active.                                 |
| per-view config      | streak unit; cumulation goal; percentage unit/target/target-type; days unit/target/target-type |
| `archivedAt`         | Archived habits leave the dashboard but keep their config.                                     |
| `parentId`           | Nested habits (below). `null` = top-level.                                                     |
| `allowDirectLogging` | Nested habits (below). Defaults `true`.                                                        |
| `sortOrder`          | Custom sort order (below). Relative to other habits sharing `parentId` only.                   |
| `pointsKind/Value`   | Points & sprints (below). Both `null` (no points) or both set.                                 |
| logs                 | Zero or more.                                                                                  |

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
| **Heatmap**    | A GitHub/Anki-style calendar grid — see "Heatmap" below.                                                                                                       |

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
habit with "Smoking"/"Drinking" subhabits, or "Exercise" with "Run"/"Lift").
Each habit has at most one parent habit (`parentId`, `null` = top-level);
reparenting to a habit's own descendant is rejected (would create a cycle).

- **Logging rolls up transitively.** Logging a subhabit counts as a log for
  every ancestor's view calculations too — an ancestor's views run over its
  own logs plus every non-archived descendant's (`@tracker/core`'s
  `aggregatedLogs`). Archiving a habit stops _its_ logs (and its own
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
  - **Rehome** them under this habit's own parent habit (only offered when
    this habit itself has one — otherwise identical to promoting).
- **Dashboard**: nothing is hidden by default — a parent habit renders
  normally, followed by an expand/collapse control (default expanded,
  counting every descendant, not just direct children) and its visible
  subhabits nested _inside its own bordered box_ (not just indented
  alongside it — the border visually contains them, arbitrarily deep),
  with an "Add subhabit" link to create one already parented here. A
  second, independent toggle next to a habit's name collapses _that
  habit's own_ tiles/heatmap/actions (keeping just its drag handle, name,
  and the toggle) while its subhabits keep showing nested underneath —
  "just show me the children." Both collapse states are local-only (not
  synced across devices). Drag-to-reorder (below) is always scoped to one
  level of nesting at a time — a habit's direct subhabits reorder among
  themselves, independently of their own parent's siblings. Each nested
  box's background subtly alternates (plain white / very pale gray) by
  nesting depth, purely visual.
- **Search**: a box at the top of the dashboard fuzzy-matches (ordered
  subsequence, case-insensitive — e.g. `"exru"`/`"xrun"`/`"ru"` all match
  "Be Healthy → Exercise → Run") against a habit's own name plus every
  ancestor's (`@tracker/core`'s `searchHabits`). Matches render as a
  **flat** list (never nested), grouped by nesting depth ascending — a
  less-nested match always shows above its own matching children — each
  with a small ancestor breadcrumb, the full normal habit card (Log,
  `+note`, Edit, Add subhabit, tiles/heatmap), and its subhabit count.
  Archived habits (and their subtrees) are excluded, matching the rest of
  the dashboard. The search is ephemeral — cleared on leaving the
  dashboard and via an explicit clear button — never persisted.
- **Log list**: defaults to showing a habit's own logs plus every
  descendant's (labeled with its source habit), with a filter to narrow to
  just this habit's own.

## Custom sort order

Habits can be dragged into whatever order the user likes — either among
top-level habits, or among one parent's direct subhabits. `sortOrder` is
only meaningful relative to other habits sharing the same `parentId`;
comparing it across different `parentId` groups is meaningless. Dragging
never re-parents a habit — reparenting stays the edit form's job — so a
drag only ever changes relative order within one existing sibling group.

New/reparented habits (via create, edit, or the nested-habits
delete/archive reparenting above) are appended to the end of their sibling
group, never inserted at an arbitrary position.

## Heatmap

A GitHub/Anki-style calendar heatmap — one small colored cell per
unit-bucket, color intensity scaled by that bucket's log count. Box size
(`unit`) is day, week, or month — never hour.

- **Window**: a fixed number of buckets ending at "now", giving every unit
  roughly the same visual footprint — day → 182 (26 weeks), week → 52,
  month → 24.
- **Day-unit alignment**: aligned to 26 _complete_ ISO-Monday weeks (not
  simply "182 days back"), so it renders as a real calendar grid — 26
  columns (weeks) × 7 rows (Monday–Sunday), matching this app's existing
  Monday week-start convention. Week/month units have no day-of-week
  concept, so they're just the trailing N buckets with no calendar
  alignment.
- **Color**: a relative intensity scale (not fixed absolute thresholds) —
  zero logs is neutral, otherwise scaled by that bucket's count against
  the busiest bucket currently shown, in shades of one base color per the
  view's `heatmapPolarity` — `neutral` (default) the app's brand blue, no
  value judgment either way; `positive`, green, for a habit where logging
  more is good; `negative`, red, for one where logging more is bad. Picked
  per-view on the habit form, independent of the red/orange/green
  Days/Percentage target-highlight system (a heatmap has no target).
- Like every other view, a heatmap's counts include a habit's own logs
  plus every non-archived subhabit's (nested habits' rollup, above).

## Points & sprints

A habit can be worth points (`pointsKind` + `pointsValue`, a whole number
≥ 1), one kind at most:

- **`per_log`** — N points every time it's logged.
- **`clean_day`** — N points for every midnight (user's timezone) crossed
  with no log in the previous **24 hours** — a literal 24h window
  `[M − 24h, M)`, not "the previous calendar day", so on a DST day the
  window can reach back past local midnight. Midnights whose window starts
  before the habit's start date don't count.

A **Point Sprint** is a window `[startAt, endAt)` with a points `target`
(and an optional name). Any number may overlap. Everything below is
computed live, client-side, in `@tracker/core`'s `points.ts` — nothing
earned is stored, so editing a habit's point value retroactively changes
every sprint's total (the habit edit form warns first when any sprint is
active: "There are active sprints, are you sure you want to change this
total? (N sprints affected)").

- **Per-log points**: a log in the window earns its habit's value, and —
  logging rolls up, as with views — the value of every `per_log`
  ancestor too.
- **Clean-day points**: each midnight M with `startAt < M ≤ endAt` (and
  already passed) awards N if no log of the habit _or any descendant_
  falls in `[M − 24h, M)`. The 24h don't have to be inside the sprint.
- **Archived habits** still count, unlike views: their logs are facts,
  and archive-and-clone (a start-date change) shouldn't take points away
  mid-sprint. A clean-day habit stops earning at its own `archivedAt`.
- **Double counting**: any non-archived habit with points that has a
  non-archived ancestor or descendant with points is flagged — an orange
  "Double counting" label on both — since one log then counts for both.
- **Points needed per day** is conservative: remaining points
  (`target − total`, floored at 0) ÷ remaining **whole** days, rounded
  down — `floor((endAt − max(now, startAt)) / 24h)`, but at least 1 until
  the sprint ends.
- **Suggestions** (a sprint's own screen): for each remaining calendar
  day, a random set of point-earning habits whose points reach the daily
  average rounded **up** (overshooting is fine). Drawn uniformly; a log
  is worth its own plus its `per_log` ancestors' values and may repeat
  (shown "Run ×2"); habits with direct logging off are never suggested to
  log. A clean-day habit appears at most once, styled as a "Skip", and
  never alongside a log of itself or a descendant (that would break it).
  Not persisted — regenerated per visit and by **Reroll**.
- The home page shows a card per upcoming/active sprint (total vs
  target, per-day needed, dates, Edit); ended sprints move to **Past
  sprints** (final total, hit/missed). The home page can also be
  filtered to habits that earn points, or those that don't (by each
  habit's _own_ points only). Filtering flattens the dashboard exactly
  like search does — a flat list grouped by nesting depth, each with its
  ancestor breadcrumb — and combines with a search query when both are
  set.

## Offline (Phase 5)

Lightweight outbox: a local queue of mutations (log/edit/delete) applied
optimistically and replayed on reconnect. Server authoritative; conflicts
resolved last-write-wins by `updatedAt`. Reads need a recent pull (on app open /
focus). No bidirectional sync engine in v1.
