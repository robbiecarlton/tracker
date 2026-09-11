# @tracker/core

Shared domain layer for the habit tracker — imported by both the backend and the
Expo app so the rules live in one place.

## What's here

| Module         | Exports                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `units`        | `UNITS`, `Unit`, `DEFAULT_UNIT`, `isUnit()`                                                                                                                 |
| `domain`       | `Habit`, `HabitView`, `HabitLog`, `ViewKind`, `TargetType` (types)                                                                                          |
| `auth-schemas` | `signUpSchema`, `signInSchema`, `emailSchema`, `passwordSchema`                                                                                             |
| `time`         | `TimeContext`, timezone-aware unit-boundary helpers (`startOfUnit`, `endOfUnit`, `addUnits`, `unitsElapsedBetween`, …)                                      |
| `views`        | The five view calculations (`computeCumulative`, `computeStreak`, `computePercentage`, `computeDays`, `computeSince`) and the `computeHabitView` dispatcher |
| `targets`      | `evaluateTarget` — `at_least` / `at_most` / `exactly` target evaluation                                                                                     |
| `highlight`    | `ratioToColor`, `computeHighlight` — the dashboard's green→orange→red mapping                                                                               |

All of it is pure, timezone-aware (via Luxon), and unit-tested — no database or
persistence lives here yet. Habits/views/logs get real DB tables and a CRUD API
in Phase 3. The spec these implement is in [`docs/DOMAIN.md`](../../docs/DOMAIN.md).

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
