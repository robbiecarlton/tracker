# @tracker/core

Shared domain layer for the habit tracker — imported by both the backend and the
Expo app so the rules live in one place.

## What's here (Phase 1)

| Module         | Exports                                                            |
| -------------- | ------------------------------------------------------------------ |
| `units`        | `UNITS`, `Unit`, `DEFAULT_UNIT`, `isUnit()`                        |
| `domain`       | `Habit`, `HabitView`, `HabitLog`, `ViewKind`, `TargetType` (types) |
| `auth-schemas` | `signUpSchema`, `signInSchema`, `emailSchema`, `passwordSchema`    |

The five habit **view calculations** (cumulative, streak, percentage, days,
since), target evaluation, and the green→orange→red highlight mapping are **not**
implemented yet — they land in Phase 2. The spec for them is in
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
