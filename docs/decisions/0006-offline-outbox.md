# 6. Offline: lightweight outbox, not a sync engine

Date: 2026-09-10
Status: accepted (implemented in Phase 5)

## Context

Habit logging should work offline. Options range from a mutation queue to a full
local-first database with bidirectional sync (WatermelonDB, RxDB, PowerSync,
ElectricSQL).

## Decision

Ship a **lightweight outbox** in v1:

- Local cache of habits + logs (`expo-sqlite` on native, IndexedDB on web).
- A queue of pending mutations (log / edit / delete) applied optimistically and
  replayed on reconnect.
- Server is authoritative; conflicts resolved last-write-wins by `updatedAt`.
- Reads require a recent pull (on app open / focus).

No incremental bidirectional sync engine.

## Consequences

- Much less complexity and fewer edge cases than a sync engine.
- Not designed for indefinite multi-day offline use or heavy concurrent editing
  across devices — acceptable for a habit tracker.
- Phase 1 ships only the interface stub (`apps/mobile/src/offline/outbox.ts`);
  feature code depends on it now so it isn't restructured later.
