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
  app/                 expo-router routes
    index.tsx          redirects by session state
    (auth)/            sign-in, sign-up  (redirects to app when authed)
    (app)/             authenticated area — placeholder dashboard
  components/ui.tsx    shared form primitives
  lib/
    auth.ts            Better Auth client (SecureStore on native, cookies on web)
    config.ts          EXPO_PUBLIC_API_URL
    forms.ts           Zod error -> field messages
    timezone.ts        device IANA timezone
  offline/outbox.ts    Phase 5 stub — no-op queue interface
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
