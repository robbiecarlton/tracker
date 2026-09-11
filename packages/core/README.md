# @tracker/core

Shared domain layer for the habit tracker — imported by both the backend and the
Expo app so the rules live in one place.

## What's here

| Module          | Exports                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `units`         | `UNITS`, `Unit`, `DEFAULT_UNIT`, `isUnit()`                                                                                                                 |
| `domain`        | `Habit`, `HabitView`, `HabitLog`, `ViewKind`, `TargetType` (types), `DEFAULT_HABIT_VIEWS`                                                                   |
| `auth-schemas`  | `signUpSchema`, `signInSchema`, `emailSchema`, `passwordSchema`                                                                                             |
| `habit-schemas` | `habitFormSchema`, `habitViewInputSchema`, `createLogSchema` — shared by the backend's request validation and the mobile app's habit/log forms              |
| `time`          | `TimeContext`, timezone-aware unit-boundary helpers (`startOfUnit`, `endOfUnit`, `addUnits`, `unitsElapsedBetween`, …)                                      |
| `views`         | The five view calculations (`computeCumulative`, `computeStreak`, `computePercentage`, `computeDays`, `computeSince`) and the `computeHabitView` dispatcher |
| `targets`       | `evaluateTarget` — `at_least` / `at_most` / `exactly` target evaluation                                                                                     |
| `highlight`     | `ratioToColor`, `computeHighlight` — the dashboard's green→orange→red mapping                                                                               |

The calculations are pure, timezone-aware (via Luxon), and unit-tested. As of
Phase 3, `Habit`/`HabitView`/`HabitLog` are real, individually-addressable DB
rows persisted by `@tracker/backend` (habit/habit_view/habit_log tables) —
this package still holds no database code itself, just the shared types,
validation, and math. The spec these implement is in
[`docs/DOMAIN.md`](../../docs/DOMAIN.md).

## Consumption

The package is consumed as TypeScript source (`main` points at `src/index.ts`),
so there is no build step during development. `npm run build` emits `dist/` for
the backend's bundled production build.

## Commands

```bash
npm run test       # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```
