# Changelog

All notable changes to `@tracker/core` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
