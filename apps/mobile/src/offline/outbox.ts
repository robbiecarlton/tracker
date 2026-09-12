/**
 * Offline outbox — still a STUB as of Phase 4 (habit/log actions call the
 * API directly; see `api/habits.ts`).
 *
 * Phase 5 replaces this with a real implementation: a local queue of pending
 * mutations (log / edit / delete) applied optimistically and replayed on
 * reconnect, with the server authoritative and last-write-wins by `updatedAt`.
 * See `docs/DOMAIN.md` and `docs/decisions/0006-offline-outbox.md`.
 *
 * The interface is defined now so feature code can depend on it without being
 * rewritten later.
 */

export interface OutboxMutation {
  id: string;
  kind:
    | "log.create"
    | "log.update"
    | "log.delete"
    | "habit.create"
    | "habit.update"
    | "habit.delete"
    | "habit.archive"
    | "habit.unarchive";
  // No "habit.archiveAndClone" kind yet — it's a composite server-side
  // operation, and Phase 5's actual mutation-queue/replay design doesn't
  // exist yet to guess its shape correctly. Left for that phase.
  payload: unknown;
  queuedAt: string;
}

export interface Outbox {
  enqueue(mutation: Omit<OutboxMutation, "id" | "queuedAt">): Promise<void>;
  pending(): Promise<OutboxMutation[]>;
  flush(): Promise<{ sent: number; failed: number }>;
}

/** No-op outbox: everything goes straight to the network in Phase 1. */
export const outbox: Outbox = {
  async enqueue() {
    /* no-op until Phase 5 */
  },
  async pending() {
    return [];
  },
  async flush() {
    return { sent: 0, failed: 0 };
  },
};
