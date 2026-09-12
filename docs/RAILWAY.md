# Deploying to Railway

This deploys three things into one Railway project: a managed Postgres, the
`@tracker/backend` API, and the `@tracker/mobile` web build. (The iOS app is
unaffected — it's a separate EAS build, not part of this.)

Everything in this doc is done in Railway's dashboard (or CLI) — no code
changes are needed beyond what's already in this repo.

## Prerequisites

- A [Railway](https://railway.app) account.
- This repo pushed to GitHub — Railway deploys by connecting a GitHub repo.
- `openssl` available locally, to generate a real auth secret (any machine
  with it works: `openssl rand -base64 32`).

## 1. Create the project and add Postgres

1. Railway dashboard → **New Project** → **Empty Project**.
2. Inside it, **New** → **Database** → **Add PostgreSQL**. Railway
   provisions it and exposes a `DATABASE_URL` variable on that service —
   you'll reference it from the backend service below, never copy it by
   hand.

## 2. Add the backend service

1. **New** → **GitHub Repo** → pick this repo.
2. In the new service's **Settings**:
   - **Root Directory**: `/` (the repo root — required so `npm install`
     sees the npm workspaces; the backend imports `@tracker/core` as a
     workspace package).
   - **Build Command**: `npm ci && npm run build --workspace @tracker/backend`
   - **Start Command**: `npm run start --workspace @tracker/backend`
   - **Healthcheck Path**: `/health`
3. In **Variables**, add:
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = a reference to the Postgres service — click the
     variable picker and select the Postgres service's `DATABASE_URL`
     (renders as `${{Postgres.DATABASE_URL}}`), not a pasted value.
   - `BETTER_AUTH_SECRET` = output of `openssl rand -base64 32` — a real
     secret, **not** the `dev-insecure-secret-change-me` default.
   - `BETTER_AUTH_URL` = leave a placeholder for now (e.g.
     `http://localhost`) — you'll fix this in step 4 once this service has a
     real domain, since it needs to know its own public URL.
   - Do **not** set `PORT` — Railway injects it, and the app already reads
     `process.env.PORT`.
4. Deploy. Once it's up, go to **Settings → Networking → Generate Domain**
   to get a public URL (e.g. `tracker-backend-production.up.railway.app`).
   Come back to **Variables** and set `BETTER_AUTH_URL` to that URL
   (`https://...`, no trailing slash), then redeploy.
5. Check the deploy logs for `Applied migrations: ...` (or
   `No pending migrations.` on a later deploy) — migrations run
   automatically on every boot (`server.ts`), nothing manual needed here.

## 3. Add the frontend (web) service

1. **New** → **GitHub Repo** → this repo again (a second service in the same
   project).
2. **Settings**:
   - **Root Directory**: `/`
   - **Build Command**: `npm ci && npm run build --workspace @tracker/mobile`
   - **Start Command**: `npm run start --workspace @tracker/mobile`
3. **Variables**:
   - `EXPO_PUBLIC_API_URL` = the backend's domain from step 2.4
     (`https://tracker-backend-production.up.railway.app`, no trailing
     slash). **This must be set before the first build** — Metro inlines
     `EXPO_PUBLIC_*` vars into the JS bundle at build time, not read at
     runtime. If you set or change it later, you must trigger a new deploy
     (not just a restart) for it to take effect.
4. Deploy, then **Settings → Networking → Generate Domain** for this service
   too (e.g. `tracker-web-production.up.railway.app`).

## 4. Close the loop: point the backend at the frontend

Back on the **backend** service's Variables:

- `WEB_ORIGIN` = the frontend's domain from step 3.4
  (`https://tracker-web-production.up.railway.app`, no trailing slash).
  This feeds both CORS and Better Auth's trusted-origins check — sign-in
  will fail with a CORS or "untrusted origin" error until this is set
  correctly.

Redeploy the backend after setting it.

(If you'd rather not hand-copy domains: Railway supports cross-service
variable references like `${{<service name>.RAILWAY_PUBLIC_DOMAIN}}`, which
auto-updates if a domain ever changes. Either works — the ordering above
just describes the simplest first pass.)

## 5. Verify

1. `curl https://<backend-domain>/health` → `{"status":"ok"}`.
2. Open `https://<frontend-domain>` in a browser, sign up a fresh account.
   Open dev tools and confirm no CORS errors. **Refresh the page** — you
   should stay signed in. (This specifically exercises the cross-site
   cookie fix — `apps/backend/src/auth.ts`'s `advanced.defaultCookieAttributes`.
   If sign-in appears to work but a refresh signs you out, that fix isn't
   taking effect — double check `NODE_ENV=production` is actually set on
   the backend service.)
3. Create a habit, log it, edit its start date, archive it, unarchive it —
   basic smoke test.
4. While on a nested page (e.g. a habit's edit screen or its logs list),
   hit browser refresh. It should reload correctly, not 404 or blank-page.
   (This exercises the static server's SPA fallback —
   `apps/mobile`'s `serve -s dist` — for Expo Router's client-side-resolved
   dynamic routes.)

## Troubleshooting

- **Sign-in works but doesn't survive a refresh, or fails with a cookie/CORS
  error in the browser console**: almost always `WEB_ORIGIN` (backend) or
  `BETTER_AUTH_URL` not matching the real domain exactly (scheme + host,
  no trailing slash), or `NODE_ENV` not set to `production` on the backend.
- **Frontend calls `localhost:4000` in production** (visible in the
  Network tab): `EXPO_PUBLIC_API_URL` wasn't set at build time. Set it, then
  trigger a fresh deploy — a restart alone won't re-run the build.
- **A direct link or refresh to a nested page 404s**: confirm the frontend's
  Start Command is actually `serve -s dist -l $PORT` (the `-s` flag is what
  makes unmatched paths fall back to `index.html`) and that the build step
  actually ran (`npm run build --workspace @tracker/mobile`) before start.
- **Build picks an unexpected Node version**: set a
  `NIXPACKS_NODE_VERSION` variable (e.g. `22`) on the affected service to
  pin it explicitly.

## Optional follow-ups (not required for a working deploy)

- **Custom domains**: Railway supports attaching your own domain per
  service. If you later put both services under one root domain (e.g.
  `app.example.com` + `api.example.com`), the cross-site cookie fix above
  still works as-is — no further change needed.
- **Auto-deploy on push**: enabled by default when a service is connected to
  a GitHub branch; each service's **Settings → Source** shows/controls this.
