import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { FastifyInstance } from "fastify";
import {
  createHabitSchema,
  createLogSchema,
  DEFAULT_HABIT_VIEWS,
  habitFormSchema,
  updateLogSchema,
  type Habit,
  type HabitLog,
  type HabitStartDateChange,
  type HabitView,
  type HabitViewInput,
} from "@tracker/core";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "../db";
import { habit, habitLog, habitStartDateChange, habitView } from "../db/schema";
import { toWebHeaders } from "../http";
import { parseBody } from "../lib/validate";

type ApiHabit = Habit & { logs: HabitLog[]; startDateHistory: HabitStartDateChange[] };

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

    const now = new Date();
    const habitId = randomUUID();
    const viewsInput: readonly HabitViewInput[] =
      parsed.data.views && parsed.data.views.length > 0 ? parsed.data.views : DEFAULT_HABIT_VIEWS;

    await db.transaction(async (tx) => {
      await tx.insert(habit).values({
        id: habitId,
        userId,
        name: parsed.data.name,
        startDate: new Date(parsed.data.startDate),
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      await insertHabitViews(tx, habitId, viewsInput, now);
    });

    const [created] = await listHabitsForUser(userId, habitId);
    return reply.status(201).send({ habit: created });
  });

  app.patch("/api/habits/:id", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const { id } = request.params as { id: string };
    const existing = await findOwnedHabit(userId, id);
    if (!existing) return reply.status(404).send({ error: "not_found" });

    const parsed = parseBody(request, habitFormSchema);
    if ("error" in parsed) return reply.status(parsed.error.status).send(parsed.error.body);

    const now = new Date();
    const newStartDate = new Date(parsed.data.startDate);
    const startDateChanged = newStartDate.getTime() !== existing.startDate.getTime();

    await db.transaction(async (tx) => {
      await tx
        .update(habit)
        .set({
          name: parsed.data.name,
          startDate: newStartDate,
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
    const deleted = await db
      .delete(habit)
      .where(and(eq(habit.id, id), eq(habit.userId, userId)))
      .returning();
    if (deleted.length === 0) return reply.status(404).send({ error: "not_found" });

    return reply.status(204).send();
  });

  app.post("/api/habits/:id/logs", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const { id } = request.params as { id: string };
    const owned = await findOwnedHabit(userId, id);
    if (!owned) return reply.status(404).send({ error: "not_found" });

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

    const now = new Date();
    await db.update(habit).set({ archivedAt: now, updatedAt: now }).where(eq(habit.id, id));

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

    const parsed = parseBody(request, habitFormSchema);
    if ("error" in parsed) return reply.status(parsed.error.status).send(parsed.error.body);

    const now = new Date();
    const newHabitId = randomUUID();

    await db.transaction(async (tx) => {
      // The old habit is archived exactly as it stood — name/startDate/views
      // untouched, logs stay right where they are. No start-date-history row
      // either: its own startDate never changed.
      await tx.update(habit).set({ archivedAt: now, updatedAt: now }).where(eq(habit.id, id));

      await tx.insert(habit).values({
        id: newHabitId,
        userId,
        name: parsed.data.name,
        startDate: new Date(parsed.data.startDate),
        archivedAt: null,
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
    );
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
