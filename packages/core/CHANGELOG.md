# Changelog

All notable changes to `@tracker/core` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
