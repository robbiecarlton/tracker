# @tracker/mobile

Expo app for the habit tracker — one codebase for **iOS** and **web** (React
Native + React Native Web), built with Expo Router.

## Run

```bash
cp .env.example .env          # point EXPO_PUBLIC_API_URL at the backend
npm run dev                   # expo start — press i for iOS, w for web
```

Start the backend first (`npm run dev` in `apps/backend`, or `npm run dev` at the
repo root to run both).

## Structure

```
src/
  app/                            expo-router routes
    index.tsx                     redirects by session state
    (auth)/                       sign-in, sign-up  (redirects to app when authed)
    (app)/                        authenticated area
      index.tsx                   dashboard — habit cards, excludes archived habits
      habits/new.tsx               create-habit form
      habits/archived.tsx          archived habits + unarchive
      habits/[id]/edit.tsx         edit-habit form, delete, Archive-vs-Keep prompt
      habits/[id]/logs/index.tsx   per-habit log list (+ start-date-history markers)
      habits/[id]/logs/new.tsx     add a log (merged log-with-notes / add-past-log)
      habits/[id]/logs/[logId].tsx edit a log, delete
  api/
    client.ts              apiFetch — authenticated fetch via authClient.$fetch
    habits.ts               listHabits/createHabit/updateHabit/deleteHabit/createLog/
                             updateLog/deleteLog/archiveHabit/unarchiveHabit/
                             archiveAndCloneHabit
    types.ts                ApiHabit (Habit & { logs, startDateHistory })
  components/
    ui.tsx                 shared form primitives (Screen, Field, PrimaryButton, ...)
    HabitCard.tsx           one habit's view tiles + log button + Logs link
    HabitForm.tsx           shared create/edit form (name, start date, views editor)
    LogForm.tsx             shared create/edit form for a single log
    ViewTile.tsx            one view's value, tinted by computeHighlight
    StreakWarning.tsx       the streak demotivation notice
  hooks/
    useCurrentUser.ts       session -> { email, timeZone }
    useHabits.ts            list query + refetch (plain hooks, no data-fetching lib)
  lib/
    auth.ts                Better Auth client (SecureStore on native, cookies on web)
    config.ts               EXPO_PUBLIC_API_URL
    date-format.ts           log-timestamp display/parsing (raw ISO <-> local text)
    forms.ts                Zod error -> field messages
    theme.ts                 app UI palette (separate from @tracker/core's highlight colors)
    timezone.ts              device IANA timezone
    view-format.ts           display formatting for computed view results
  offline/outbox.ts         Phase 5 stub — no-op queue interface
```

## Checks

```bash
npm test           # vitest — logic only (no RN renderer, no screen tests)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (eslint-config-expo)
npm run build       # expo export --platform web -> dist/
```

## Notes

- `@tracker/core` is consumed as TypeScript source; `metro.config.js` watches the
  workspace root so edits there hot-reload.
- Native iOS builds (EAS) and App Store submission come in a later phase.
