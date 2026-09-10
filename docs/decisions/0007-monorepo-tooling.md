# 7. npm workspaces + Turborepo

Date: 2026-09-10
Status: accepted

## Context

The project is a monorepo (backend + Expo app + shared packages), per the
standing convention. The plan originally specified pnpm, but pnpm is not
installed on the development machine and its `corepack` provisioning is broken
(stale signing key).

## Decision

Use **npm workspaces** (npm 10, bundled with Node 23) for package management and
**Turborepo** for the task graph and caching.

Top-level commands: `npm run dev | build | test | lint | typecheck`, plus
`npm run db:*` which delegate to `@tracker/backend`.

## Consequences

- No global install required.
- Slightly slower installs and a flat `node_modules` vs pnpm's linked store.
- Switching to pnpm later is low-effort (add `pnpm-workspace.yaml`, adjust
  lockfile) if the environment allows it.
