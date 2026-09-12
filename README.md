# Tracker

A multi-habit tracker with a Fastify backend, and an Expo app that targets both
**iOS** and **web** from one codebase.

> **Phase 3 — habits & logs API + dashboard.** Auth, the domain logic (view
> calculations, targets, highlight colours), persistence, and the dashboard +
> forms are all wired up — you can sign up, add habits, log them, and see the
> dashboard update. Log editing, start-date history, offline support, and
> targets/polish are still ahead; see [`ROADMAP.md`](./ROADMAP.md).

## Layout

| Path              | What                                               |
| ----------------- | -------------------------------------------------- |
| `apps/backend`    | Fastify API, Better Auth, Drizzle (`pg` dialect)   |
| `apps/mobile`     | Expo Router app — iOS + web                        |
| `packages/core`   | Shared domain model, view calculations, validation |
| `packages/config` | Shared ESLint / Prettier / TS presets              |
| `docs/DOMAIN.md`  | Entity model and view-calculation spec             |
| `docs/decisions/` | Architecture decision records                      |

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

### Try it out

1. Open the web app, go to **Create account**, sign up.
2. You land on the dashboard — empty at first. Tap **+ New** to add a habit
   (it defaults to Cumulative + Days-out-of-7 views).
3. Tap **Log** on the habit card — the view tiles update immediately.
4. Tap **Edit** to change the habit, add a Streak view (see the warning), or
   set a target on a Days/Percentage view — the tile's colour interpolates
   green→orange→red against it.
5. `curl http://localhost:4000/health` → `{"status":"ok"}`.

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

## Deployment

Backend + web frontend deploy to Railway (with a managed Postgres) — see
[`docs/RAILWAY.md`](./docs/RAILWAY.md).

## Conventions

Semantic versioning; "Keep a Changelog" format; unit tests alongside logic; no
integration / UI-driving / snapshot tests. Don't have tooling start or stop the
apps — run them yourself.
