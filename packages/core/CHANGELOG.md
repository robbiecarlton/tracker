# Changelog

All notable changes to `@tracker/core` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.0] - 2026-09-14

### Added

- Fuzzy habit search: `fuzzySubsequenceMatch` (case-insensitive, ordered
  subsequence — fzf-style) and `searchHabits`, which matches a query
  against every habit's full ancestor path and returns matches grouped by
  nesting depth, ascending, each group already in normal tree order.

## [0.7.0] - 2026-09-12

### Added

- Custom habit sort order: `Habit.sortOrder` — relative position within
  habits sharing the same `parentId`, meaningless across different
  `parentId` groups. Managed exclusively by drag-to-reorder
  (`PATCH /api/habits/reorder`), never by the create/edit form; new
  `reorderHabitsSchema`/`ReorderHabitsInput`.
- Heatmap: a sixth `ViewKind`, a GitHub/Anki-style calendar heatmap with a
  configurable box size (`HabitView.unit`, restricted to day/week/month —
  no hour). `views.ts` gains `countLogsByUnit` (a counting sibling to the
  existing presence-only `bucketLogsByUnit`), `HeatmapResult`, and
  `computeHeatmap` — a fixed-length run of unit-buckets ending at "now"
  (182/52/24 for day/week/month), each carrying its log count. The `day`
  unit aligns its window to 26 complete ISO-Monday weeks so a UI can lay
  it out as a clean 26×7 grid.

## [0.6.0] - 2026-09-12

### Added

- Nested habits (subhabits): `Habit` gains `parentId` (self-referential,
  `null` = top-level) and `allowDirectLogging`. New `habit-tree.ts` module
  with pure tree helpers shared by the backend and mobile app: `childrenOf`,
  `getDescendants` (depth-tagged, arbitrarily deep), `wouldCreateCycle`,
  `aggregatedLogs` (a habit's own logs plus every non-archived descendant's,
  for view calculations to roll up through — an archived habit's whole
  subtree detaches from the rollup), and `buildDashboardRows` (depth-first,
  collapse-aware flattening for the dashboard). `habitFormSchema` and
  `createHabitSchema` gain matching `parentId`/`allowDirectLogging` fields.
  See `docs/DOMAIN.md`'s "Nested habits".

## [0.5.0] - 2026-09-12

### Added

- `HabitStartDateChange`: an immutable audit record of a habit's start-date
  edits, for Phase 4's "keep" path (`docs/DOMAIN.md`'s "Start-date changes") —
  the log view can now show every past start date inline with the logs.
- `updateLogSchema`: validation for editing an existing log (full-replace,
  unlike `createLogSchema`'s create-with-optional-fields shape — no "now"
  fallback for `timestamp`, `notes` required-but-nullable).

### Fixed

- `createLogSchema.timestamp` now validates with the same strict
  Luxon-parses-it check as `habitFormSchema.startDate` (previously just
  `.min(1)`), closing the same crash class before Phase 4 introduces the
  first caller that actually populates this field.

## [0.4.0] - 2026-09-12

### Changed

- **Percentage now gives instant feedback**, matching Streak/Days: logging
  the current (in-progress) unit counts as a hit right away, joining both
  the numerator and denominator, instead of being excluded until the unit
  is over. A missing log for the current unit is still forgiven — excluded,
  not counted as a miss. Previously Percentage was fully forgiving (the
  in-progress unit never counted either way), which made a freshly-logged
  "today" invisible in the rate until the next day — confusing in practice,
  so this was revisited and changed. Since keeps its existing fully-forgiving
  behavior (unaffected — a fresh log already reads as "0 units ago", so it
  was already immediate).

## [0.3.1] - 2026-09-11

### Fixed

- `habitFormSchema`'s `startDate` validation now requires strict `YYYY-MM-DD`
  and rejects anything else, instead of the previous lenient
  `!Number.isNaN(Date.parse(s))` check. Native `Date.parse` accepts many
  non-ISO shapes (e.g. SQL-style `"2026-08-11 00:00:00-07"`) that Luxon's
  stricter ISO 8601 parser in `time.ts`/`views.ts` rejects — those values were
  passing form/API validation and only failing much later inside
  `computeHabitView`, surfacing as an opaque "Invalid datetime" crash instead
  of a form error.

## [0.3.0] - 2026-09-11

### Added

- `habit-schemas.ts`: shared Zod validation for the habit/view/log create and
  edit forms (`habitFormSchema`, `habitViewInputSchema`, `createLogSchema`,
  plus the `viewKindSchema`/`targetTypeSchema`/`unitSchema` enums), reused by
  the backend's request validation and the mobile app's forms — same pattern
  as `auth-schemas.ts`.
- `DEFAULT_HABIT_VIEWS`: the two views a new habit gets by default (Cumulative,
  Days out of 7), shared by the backend's create-habit route and the mobile
  create-form's initial state.

### Changed

- **Breaking**: `HabitView` now carries `id`, `habitId`, `createdAt`,
  `updatedAt` — it's a real, individually-addressable persisted row as of
  Phase 3 (habit/view/log DB tables), not just inline calculation config.
  Existing `HabitView` object literals need these fields added.

## [0.2.0] - 2026-09-11

### Added

- Timezone-aware unit-boundary helpers (`time.ts`): `TimeContext`, `startOfUnit`,
  `endOfUnit`, `addUnits`, `unitsElapsedBetween`, `unitKey`, `isSameUnit`,
  `parseInZone`, `nowInZone`. Built on Luxon; ISO-Monday week start.
- The five habit view calculations (`views.ts`): `computeCumulative`,
  `computeStreak`, `computePercentage`, `computeDays`, `computeSince`, and the
  `computeHabitView` dispatcher. Streak and Days give instant feedback for the
  current (in-progress) unit — logging it counts as a hit right away, and a
  missing log never counts as a miss until the unit fully elapses. Percentage
  and Since exclude the in-progress unit entirely (lifetime-rate / most-recent
  reads, not live feedback).
- Target evaluation (`targets.ts`): `evaluateTarget` for `at_least` / `at_most`
  / `exactly`, producing a clamped 0..1 goodness ratio.
- Highlight color mapping (`highlight.ts`): `ratioToColor` (red → orange →
  green interpolation) and `computeHighlight` (view + value → color | null).

### Dependencies

- Added `luxon` (3.7.2) and `@types/luxon` (3.7.5, dev).

## [0.1.0] - 2026-09-10

### Added

- Package skeleton: `Unit` enum + guard, domain model type stubs (`Habit`,
  `HabitView`, `HabitLog`, `ViewKind`, `TargetType`), and shared Zod auth
  schemas (`signUpSchema`, `signInSchema`).
- No view calculations yet — those arrive in Phase 2 (see `docs/DOMAIN.md`).
