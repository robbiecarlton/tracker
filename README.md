# Tracker

A multi-habit tracker with a Fastify backend, and an Expo app that targets both
**iOS** and **web** from one codebase.

> **Phase 1 — skeleton.** Auth, database, migrations, and CI are wired up. There
> are no habit-tracking features yet; see [`ROADMAP.md`](./ROADMAP.md).

## Layout

| Path              | What                                                  |
| ----------------- | ----------------------------------------------------- |
| `apps/backend`    | Fastify API, Better Auth, Drizzle (`pg` dialect)      |
| `apps/mobile`     | Expo Router app — iOS + web                           |
| `packages/core`   | Shared domain model + (later) view calculations       |
| `packages/config` | Shared ESLint / Prettier / TS presets                 |
| `docs/DOMAIN.md`  | Entity model and view-calculation spec (for Phase 2+) |
| `docs/decisions/` | Architecture decision records                         |

Each app/package is versioned and changelogged independently; this file's
[`CHANGELOG.md`](./CHANGELOG.md) is the unified log.

## Prerequisites

- Node 20+ (Node 23 is what this repo was built on)
- npm 10+ (bundled with Node)
- Xcode + iOS Simulator, to run the app on iOS

No Docker, and no database to install — local dev and tests use
[PGlite](https://pglite.dev) (in-process Postgres).

## Setup

```bash
npm install
npm run db:migrate          # creates the local PGlite database (apps/backend/.data)
```

## Run

```bash
npm run dev                 # backend (:4000) + Expo dev server together
```

Then, for the app: press `w` for web, or `i` for the iOS Simulator, in the Expo
CLI. You can also run one side at a time:

```bash
npm run dev --workspace @tracker/backend
npm run dev --workspace @tracker/mobile
```

### Try the auth round-trip

1. Open the web app, go to **Create account**, sign up.
2. You land on the placeholder dashboard showing your email and timezone.
3. `curl http://localhost:4000/health` → `{"status":"ok"}`.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build               # backend bundle + Expo web export
```

## Database commands

```bash
npm run db:generate -- <name>   # scaffold a new migration pair
npm run db:migrate              # apply pending migrations
npm run db:rollback             # revert the most recent migration
npm run db:reset                # wipe local PGlite data and re-migrate
```

## Conventions

Semantic versioning; "Keep a Changelog" format; unit tests alongside logic; no
integration / UI-driving / snapshot tests. Don't have tooling start or stop the
apps — run them yourself.
