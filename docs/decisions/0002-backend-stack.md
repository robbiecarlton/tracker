# 2. Node/TypeScript backend on Fastify

Date: 2026-09-10
Status: accepted

## Context

The valuable, tricky logic in this app is the habit view math (streak,
percentage, days, since) plus target evaluation. It is identical on the server
and every client and is timezone-sensitive.

## Decision

Backend is Node + TypeScript using **Fastify**. Domain logic lives in
`@tracker/core` and is imported by both the backend and the Expo app, so there is
one implementation of the view math.

Fastify over NestJS: lighter, less ceremony, sufficient for this scale.

## Consequences

- One language across the stack; shared types and Zod schemas.
- View calculations can run server-side on read and client-side for offline /
  optimistic updates from the same source.
- If backend scale needs change later, Fastify is easy to move off of; the
  domain package is framework-agnostic.
