import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { FastifyInstance } from "fastify";
import {
  childrenOf,
  createHabitSchema,
  createLogSchema,
  DEFAULT_HABIT_VIEWS,
  getDescendants,
  habitFormSchema,
  reorderHabitsSchema,
  updateLogSchema,
  wouldCreateCycle,
  type Habit,
  type HabitLog,
  type HabitNode,
  type HabitStartDateChange,
  type HabitView,
  type HabitViewInput,
} from "@tracker/core";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "../db";
import { habit, habitLog, habitStartDateChange, habitView } from "../db/schema";
import { toWebHeaders } from "../http";
import { parseBody } from "../lib/validate";

type ApiHabit = Habit & { logs: HabitLog[]; startDateHistory: HabitStartDateChange[] };

/** How to resolve a habit's active (non-archived) subhabits when it's deleted or archived. */
type ChildrenAction = "cascade" | "top_level" | "grandparent";

function isChildrenAction(value: unknown): value is ChildrenAction {
  return value === "cascade" || value === "top_level" || value === "grandparent";
}

export async function habitsRoutes(app: FastifyInstance): Promise<void> {
  async function getSessionUserId(request: {
    headers: IncomingHttpHeaders;
  }): Promise<string | null> {
    const session = await auth.api.getSession({ headers: toWebHeaders(request.headers) });
    return session?.user.id ?? null;
  }

  app.get("/api/habits", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const habits = await listHabitsForUser(userId);
    return { habits };
  });

  app.post("/api/habits", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const parsed = parseBody(request, createHabitSchema);
    if ("error" in parsed) return reply.status(parsed.error.status).send(parsed.error.body);

    const parentId = parsed.data.parentId ?? null;
    if (parentId !== null && !(await findOwnedHabit(userId, parentId))) {
      return reply.status(400).send({ error: "invalid_parent" });
    }

    const now = new Date();
    const habitId = randomUUID();
    const viewsInput: readonly HabitViewInput[] =
      parsed.data.views && parsed.data.views.length > 0 ? parsed.data.views : DEFAULT_HABIT_VIEWS;

    await db.transaction(async (tx) => {
      const sortOrder = await nextSortOrder(tx, userId, parentId);
      await tx.insert(habit).values({
        id: habitId,
        userId,
        name: parsed.data.name,
        startDate: new Date(parsed.data.startDate),
        archivedAt: null,
        parentId,
        // A brand-new habit can't have subhabits yet, so there's nothing to
        // gate this on — always starts loggable directly.
        allowDirectLogging: true,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });

      await insertHabitViews(tx, habitId, viewsInput, now);
    });

    const [created] = await listHabitsForUser(userId, habitId);
    return reply.status(201).send({ habit: created });
  });

  app.patch("/api/habits/reorder", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const parsed = parseBody(request, reorderHabitsSchema);
    if ("error" in parsed) return reply.status(parsed.error.status).send(parsed.error.body);

    const { parentId, orderedIds } = parsed.data;
    // Archived siblings are excluded — the dashboard never shows or drags
    // them (`buildDashboardRows` hides archived habits at every level), so
    // the client's `orderedIds` never includes one either. Matching that
    // scope here is what `orderedIds` is actually a permutation *of*;
    // requiring archived siblings too would reject every reorder in a
    // group that has one.
    const siblingRows = await db
      .select({ id: habit.id })
      .from(habit)
      .where(
        parentId === null
          ? and(eq(habit.userId, userId), isNull(habit.parentId), isNull(habit.archivedAt))
          : and(eq(habit.userId, userId), eq(habit.parentId, parentId), isNull(habit.archivedAt)),
      );
    const siblingIds = new Set(siblingRows.map((r) => r.id));

    // `orderedIds` must be exactly a permutation of the current
    // (non-archived) sibling group — same count, no duplicates, every id
    // actually a member — guarding against a stale client sending a group
    // that's since changed (a habit deleted/moved/archived/added since the
    // client last fetched).
    const isValidPermutation =
      orderedIds.length === siblingRows.length &&
      new Set(orderedIds).size === orderedIds.length &&
      orderedIds.every((id) => siblingIds.has(id));
    if (!isValidPermutation) {
      return reply.status(400).send({ error: "invalid_reorder" });
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(habit)
          .set({ sortOrder: i, updatedAt: now })
          .where(and(eq(habit.id, orderedIds[i]!), eq(habit.userId, userId)));
      }
    });

    const habits = await listHabitsForUser(userId);
    return { habits };
  });

  app.patch("/api/habits/:id", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const { id } = request.params as { id: string };
    const existing = await findOwnedHabit(userId, id);
    if (!existing) return reply.status(404).send({ error: "not_found" });

    const parsed = parseBody(request, habitFormSchema);
    if ("error" in parsed) return reply.status(parsed.error.status).send(parsed.error.body);

    if (parsed.data.parentId !== existing.parentId) {
      if (parsed.data.parentId !== null) {
        if (!(await findOwnedHabit(userId, parsed.data.parentId))) {
          return reply.status(400).send({ error: "invalid_parent" });
        }
        const nodes = await listHabitNodesForUser(userId);
        if (wouldCreateCycle(id, parsed.data.parentId, nodes)) {
          return reply.status(400).send({ error: "invalid_parent" });
        }
      }
    }

    if (parsed.data.allowDirectLogging === false) {
      const nodes = await listHabitNodesForUser(userId);
      const hasActiveChild = childrenOf(id, nodes).some((c) => !c.archivedAt);
      if (!hasActiveChild) return reply.status(400).send({ error: "no_subhabits" });
    }

    const now = new Date();
    const newStartDate = new Date(parsed.data.startDate);
    const startDateChanged = newStartDate.getTime() !== existing.startDate.getTime();

    await db.transaction(async (tx) => {
      // Only recompute sortOrder when the parent is actually changing —
      // otherwise leave it exactly where it is within its current group
      // (an ordinary name/startDate/views edit shouldn't silently bump a
      // habit to the end of its sibling list).
      const sortOrder =
        parsed.data.parentId !== existing.parentId
          ? await nextSortOrder(tx, userId, parsed.data.parentId)
          : existing.sortOrder;

      await tx
        .update(habit)
        .set({
          name: parsed.data.name,
          startDate: newStartDate,
          parentId: parsed.data.parentId,
          allowDirectLogging: parsed.data.allowDirectLogging,
          sortOrder,
          updatedAt: now,
        })
        .where(eq(habit.id, id));

      // Views are fully replaced on every edit (delete-all/insert-all) rather
      // than diffed by id — simpler, and nothing depends on view-id stability
      // across edits yet.
      await tx.delete(habitView).where(eq(habitView.habitId, id));
      await insertHabitViews(tx, id, parsed.data.views, now);

      // Record start-date history unconditionally whenever it actually
      // changes — this is the entire "keep" path from docs/DOMAIN.md's
      // "Start-date changes": no separate endpoint, no gating on whether any
      // logs predate the new date. The client decides whether to prompt the
      // user at all; once it lets a plain PATCH through, history is kept.
      if (startDateChanged) {
        await tx.insert(habitStartDateChange).values({
          id: randomUUID(),
          habitId: id,
          previousStartDate: existing.startDate,
          newStartDate,
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    const [updated] = await listHabitsForUser(userId, id);
    return { habit: updated };
  });

  app.delete("/api/habits/:id", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const { id } = request.params as { id: string };
    const owned = await findOwnedHabit(userId, id);
    if (!owned) return reply.status(404).send({ error: "not_found" });

    const nodes = await listHabitNodesForUser(userId);
    const allDescendants = getDescendants(id, nodes);
    const activeDescendants = allDescendants.filter((d) => !d.habit.archivedAt);

    const now = new Date();

    if (activeDescendants.length === 0) {
      // Nothing active to ask the user about. If every descendant here is
      // already archived (rare), silently promote its direct children to
      // top-level rather than cascading — non-destructive, and avoids the
      // self-FK's ON DELETE RESTRICT tripping on a still-referencing row.
      const directChildIds = allDescendants.filter((d) => d.depth === 1).map((d) => d.habit.id);
      await db.transaction(async (tx) => {
        await reparentHabits(tx, userId, directChildIds, null, now);
        await tx.delete(habit).where(and(eq(habit.id, id), eq(habit.userId, userId)));
      });
      return reply.status(204).send();
    }

    const action = (request.query as { childrenAction?: string }).childrenAction;
    if (!isChildrenAction(action)) {
      return reply.status(400).send({ error: "children_action_required" });
    }
    if (action === "grandparent" && owned.parentId === null) {
      return reply.status(400).send({ error: "invalid_children_action" });
    }

    await db.transaction(async (tx) => {
      if (action === "cascade") {
        // The whole subtree, active or already-archived — "delete
        // everything" means everything below it, not just the active part.
        const ids = [id, ...allDescendants.map((d) => d.habit.id)];
        await tx.delete(habit).where(inArray(habit.id, ids));
        return;
      }

      // top_level / grandparent: reparent every DIRECT child (active or
      // archived — an archived one still references `id` via the FK, so it
      // has to move too, even though only active ones drove this prompt).
      // Grandchildren and below are untouched: only their immediate
      // parent's identity changes.
      const newParentId = action === "grandparent" ? owned.parentId : null;
      const directChildIds = allDescendants.filter((d) => d.depth === 1).map((d) => d.habit.id);
      await reparentHabits(tx, userId, directChildIds, newParentId, now);
      await tx.delete(habit).where(and(eq(habit.id, id), eq(habit.userId, userId)));
    });

    return reply.status(204).send();
  });

  app.post("/api/habits/:id/logs", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const { id } = request.params as { id: string };
    const owned = await findOwnedHabit(userId, id);
    if (!owned) return reply.status(404).send({ error: "not_found" });
    if (!owned.allowDirectLogging) {
      return reply.status(400).send({ error: "direct_logging_disabled" });
    }

    const parsed = parseBody(request, createLogSchema);
    if ("error" in parsed) return reply.status(parsed.error.status).send(parsed.error.body);

    const now = new Date();
    const logId = randomUUID();
    const [log] = await db
      .insert(habitLog)
      .values({
        id: logId,
        habitId: id,
        timestamp: parsed.data.timestamp ? new Date(parsed.data.timestamp) : now,
        notes: parsed.data.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return reply.status(201).send({ log: log ? toHabitLog(log) : null });
  });

  app.patch("/api/habits/:habitId/logs/:logId", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const { habitId, logId } = request.params as { habitId: string; logId: string };
    const owned = await findOwnedHabit(userId, habitId);
    if (!owned) return reply.status(404).send({ error: "not_found" });

    const existingLog = await findHabitLog(habitId, logId);
    if (!existingLog) return reply.status(404).send({ error: "not_found" });

    const parsed = parseBody(request, updateLogSchema);
    if ("error" in parsed) return reply.status(parsed.error.status).send(parsed.error.body);

    const now = new Date();
    const [updated] = await db
      .update(habitLog)
      .set({
        timestamp: new Date(parsed.data.timestamp),
        notes: parsed.data.notes,
        updatedAt: now,
      })
      .where(eq(habitLog.id, logId))
      .returning();

    return { log: updated ? toHabitLog(updated) : null };
  });

  app.delete("/api/habits/:habitId/logs/:logId", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const { habitId, logId } = request.params as { habitId: string; logId: string };
    const owned = await findOwnedHabit(userId, habitId);
    if (!owned) return reply.status(404).send({ error: "not_found" });

    const deleted = await db
      .delete(habitLog)
      .where(and(eq(habitLog.id, logId), eq(habitLog.habitId, habitId)))
      .returning();
    if (deleted.length === 0) return reply.status(404).send({ error: "not_found" });

    return reply.status(204).send();
  });

  app.post("/api/habits/:id/archive", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const { id } = request.params as { id: string };
    const owned = await findOwnedHabit(userId, id);
    if (!owned) return reply.status(404).send({ error: "not_found" });

    const nodes = await listHabitNodesForUser(userId);
    const activeDescendants = getDescendants(id, nodes).filter((d) => !d.habit.archivedAt);

    const now = new Date();
    if (activeDescendants.length === 0) {
      // Nothing active depends on `id` staying put — unlike delete, `id`
      // keeps existing here, so any already-archived descendants can just
      // stay pointed at it with no FK concern at all.
      await db.update(habit).set({ archivedAt: now, updatedAt: now }).where(eq(habit.id, id));
      const [updated] = await listHabitsForUser(userId, id);
      return { habit: updated };
    }

    const action = (request.query as { childrenAction?: string }).childrenAction;
    if (!isChildrenAction(action)) {
      return reply.status(400).send({ error: "children_action_required" });
    }
    if (action === "grandparent" && owned.parentId === null) {
      return reply.status(400).send({ error: "invalid_children_action" });
    }

    await db.transaction(async (tx) => {
      if (action === "cascade") {
        const ids = [id, ...activeDescendants.map((d) => d.habit.id)];
        await tx.update(habit).set({ archivedAt: now, updatedAt: now }).where(inArray(habit.id, ids));
        return;
      }

      // top_level / grandparent: only the currently-active direct children
      // need moving — an already-archived direct child can safely keep
      // pointing at `id`, since `id` isn't going anywhere.
      const newParentId = action === "grandparent" ? owned.parentId : null;
      const activeDirectChildIds = activeDescendants
        .filter((d) => d.depth === 1)
        .map((d) => d.habit.id);
      await reparentHabits(tx, userId, activeDirectChildIds, newParentId, now);
      await tx.update(habit).set({ archivedAt: now, updatedAt: now }).where(eq(habit.id, id));
    });

    const [updated] = await listHabitsForUser(userId, id);
    return { habit: updated };
  });

  app.post("/api/habits/:id/unarchive", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const { id } = request.params as { id: string };
    const owned = await findOwnedHabit(userId, id);
    if (!owned) return reply.status(404).send({ error: "not_found" });

    const now = new Date();
    await db.update(habit).set({ archivedAt: null, updatedAt: now }).where(eq(habit.id, id));

    const [updated] = await listHabitsForUser(userId, id);
    return { habit: updated };
  });

  app.post("/api/habits/:id/archive-and-clone", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const { id } = request.params as { id: string };
    const owned = await findOwnedHabit(userId, id);
    if (!owned) return reply.status(404).send({ error: "not_found" });

    // The old habit is archived under its *own* id here, so its children
    // (if any) would be left pointing at a now-archived habit rather than
    // the freshly-cloned one that replaces it — not supported yet (see
    // docs/DOMAIN.md's "Nested habits"). Require the caller to resolve them
    // first via the plain archive/delete actions' childrenAction choices.
    const nodes = await listHabitNodesForUser(userId);
    const hasActiveChildren = childrenOf(id, nodes).some((c) => !c.archivedAt);
    if (hasActiveChildren) {
      return reply.status(400).send({ error: "has_active_subhabits" });
    }

    const parsed = parseBody(request, habitFormSchema);
    if ("error" in parsed) return reply.status(parsed.error.status).send(parsed.error.body);

    const newParentId = parsed.data.parentId;
    if (newParentId !== null && !(await findOwnedHabit(userId, newParentId))) {
      return reply.status(400).send({ error: "invalid_parent" });
    }

    const now = new Date();
    const newHabitId = randomUUID();

    await db.transaction(async (tx) => {
      // The old habit is archived exactly as it stood — name/startDate/views
      // untouched, logs stay right where they are. No start-date-history row
      // either: its own startDate never changed.
      await tx.update(habit).set({ archivedAt: now, updatedAt: now }).where(eq(habit.id, id));

      const sortOrder = await nextSortOrder(tx, userId, newParentId);
      await tx.insert(habit).values({
        id: newHabitId,
        userId,
        name: parsed.data.name,
        startDate: new Date(parsed.data.startDate),
        archivedAt: null,
        parentId: newParentId,
        allowDirectLogging: parsed.data.allowDirectLogging,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });
      await insertHabitViews(tx, newHabitId, parsed.data.views, now);
    });

    const [[archivedHabit], [newHabit]] = await Promise.all([
      listHabitsForUser(userId, id),
      listHabitsForUser(userId, newHabitId),
    ]);
    return reply.status(201).send({ archivedHabit, newHabit });
  });
}

/** Fetches a habit row scoped to its owner, or null if it doesn't exist / isn't theirs. */
async function findOwnedHabit(
  userId: string,
  habitId: string,
): Promise<typeof habit.$inferSelect | null> {
  const rows = await db
    .select()
    .from(habit)
    .where(and(eq(habit.id, habitId), eq(habit.userId, userId)));
  return rows[0] ?? null;
}

/**
 * Lightweight `{id, parentId, archivedAt}` projection of every habit a user
 * owns — everything `@tracker/core`'s `habit-tree.ts` helpers need for cycle
 * checks and descendant walks, without pulling every column for every habit
 * on every write.
 */
async function listHabitNodesForUser(userId: string): Promise<HabitNode[]> {
  const rows = await db
    .select({ id: habit.id, parentId: habit.parentId, archivedAt: habit.archivedAt })
    .from(habit)
    .where(eq(habit.userId, userId));
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
  }));
}

/**
 * The `sortOrder` to give a new (or newly-reparented) habit — appended to
 * the end of its sibling group (everyone else sharing `parentId`). Callers
 * pass either the plain `db` or an open `tx`, so this composes into a
 * transaction alongside the write it's for.
 */
async function nextSortOrder(
  dbOrTx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  parentId: string | null,
): Promise<number> {
  const siblings = await dbOrTx
    .select({ sortOrder: habit.sortOrder })
    .from(habit)
    .where(
      parentId === null
        ? and(eq(habit.userId, userId), isNull(habit.parentId))
        : and(eq(habit.userId, userId), eq(habit.parentId, parentId)),
    );
  const max = siblings.reduce((m, s) => Math.max(m, s.sortOrder), -1);
  return max + 1;
}

/**
 * Reparents a batch of habits (e.g. a deleted/archived parent's direct
 * children) to `newParentId`, giving each a fresh sequential `sortOrder`
 * appended after that group's existing members — so a batch of
 * newly-arrived siblings lands together at the end in their prior relative
 * order, rather than colliding with (or interleaving into) whatever's
 * already there.
 */
async function reparentHabits(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  habitIds: readonly string[],
  newParentId: string | null,
  now: Date,
): Promise<void> {
  if (habitIds.length === 0) return;
  let nextOrder = await nextSortOrder(tx, userId, newParentId);
  for (const id of habitIds) {
    await tx
      .update(habit)
      .set({ parentId: newParentId, sortOrder: nextOrder, updatedAt: now })
      .where(and(eq(habit.id, id), eq(habit.userId, userId)));
    nextOrder += 1;
  }
}

/** Fetches a log row scoped to its (already-ownership-verified) habit. */
async function findHabitLog(
  habitId: string,
  logId: string,
): Promise<typeof habitLog.$inferSelect | null> {
  const rows = await db
    .select()
    .from(habitLog)
    .where(and(eq(habitLog.id, logId), eq(habitLog.habitId, habitId)));
  return rows[0] ?? null;
}

/** Inserts a habit's view rows — shared by create, update, and archive-and-clone. */
async function insertHabitViews(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  habitId: string,
  views: readonly HabitViewInput[],
  now: Date,
): Promise<void> {
  await tx.insert(habitView).values(
    views.map((v) => ({
      id: randomUUID(),
      habitId,
      kind: v.kind,
      unit: v.unit ?? null,
      days: v.days ?? null,
      cumulationGoal: v.cumulationGoal ?? null,
      target: v.target ?? null,
      targetType: v.targetType ?? null,
      heatmapPolarity: v.heatmapPolarity ?? null,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

/** Fetches a user's habits (optionally scoped to one habit id) with nested views + logs + start-date history. */
async function listHabitsForUser(userId: string, onlyHabitId?: string): Promise<ApiHabit[]> {
  const habitRows = await db
    .select()
    .from(habit)
    .where(
      onlyHabitId
        ? and(eq(habit.userId, userId), eq(habit.id, onlyHabitId))
        : eq(habit.userId, userId),
    )
    // Only relative order *within* a parentId group is meaningful (see
    // `sortOrder`'s doc comment in schema.ts) — a single global order-by is
    // sufficient since `childrenOf`/`buildDashboardRows` (`@tracker/core`)
    // filter-preserving-order per parentId from this array.
    .orderBy(asc(habit.sortOrder));
  if (habitRows.length === 0) return [];

  const habitIds = habitRows.map((h) => h.id);
  const [viewRows, logRows, historyRows] = await Promise.all([
    db.select().from(habitView).where(inArray(habitView.habitId, habitIds)),
    db.select().from(habitLog).where(inArray(habitLog.habitId, habitIds)),
    db.select().from(habitStartDateChange).where(inArray(habitStartDateChange.habitId, habitIds)),
  ]);

  const viewsByHabit = groupBy(viewRows, (v) => v.habitId);
  const logsByHabit = groupBy(logRows, (l) => l.habitId);
  const historyByHabit = groupBy(historyRows, (h) => h.habitId);

  return habitRows.map((h) => toHabit(h, viewsByHabit, logsByHabit, historyByHabit));
}

/**
 * `@tracker/core`'s domain types and Luxon-based calculations are
 * string-only — see `packages/core/src/time.ts` — so every `Date` column
 * coming back from Drizzle is converted to an ISO string here, once, at the
 * DB/API boundary. (Writes do the reverse: `new Date(isoString)`.)
 */
function toHabit(
  row: typeof habit.$inferSelect,
  viewsByHabit: Map<string, (typeof habitView.$inferSelect)[]>,
  logsByHabit: Map<string, (typeof habitLog.$inferSelect)[]>,
  historyByHabit: Map<string, (typeof habitStartDateChange.$inferSelect)[]>,
): ApiHabit {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    startDate: row.startDate.toISOString(),
    views: (viewsByHabit.get(row.id) ?? []).map(toHabitView),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    parentId: row.parentId,
    allowDirectLogging: row.allowDirectLogging,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    logs: (logsByHabit.get(row.id) ?? []).map(toHabitLog),
    startDateHistory: (historyByHabit.get(row.id) ?? []).map(toHabitStartDateChange),
  };
}

function toHabitView(row: typeof habitView.$inferSelect): HabitView {
  return {
    id: row.id,
    habitId: row.habitId,
    kind: row.kind as HabitView["kind"],
    unit: row.unit as HabitView["unit"],
    days: row.days ?? undefined,
    cumulationGoal: row.cumulationGoal ?? undefined,
    target: row.target ?? undefined,
    targetType: row.targetType as HabitView["targetType"],
    heatmapPolarity: (row.heatmapPolarity as HabitView["heatmapPolarity"]) ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toHabitLog(row: typeof habitLog.$inferSelect): HabitLog {
  return {
    id: row.id,
    habitId: row.habitId,
    timestamp: row.timestamp.toISOString(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toHabitStartDateChange(
  row: typeof habitStartDateChange.$inferSelect,
): HabitStartDateChange {
  return {
    id: row.id,
    habitId: row.habitId,
    previousStartDate: row.previousStartDate.toISOString(),
    newStartDate: row.newStartDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}
