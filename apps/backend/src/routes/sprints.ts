import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { FastifyInstance } from "fastify";
import { sprintFormSchema, type PointSprint } from "@tracker/core";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "../db";
import { pointSprint } from "../db/schema";
import { toWebHeaders } from "../http";
import { parseBody } from "../lib/validate";

/**
 * Point Sprints — pure persistence, like habits: totals, status, and the
 * daily average are all computed client-side by `@tracker/core`'s
 * `points.ts`. Every sprint is returned (upcoming, active, and ended); the
 * client splits them up.
 */
export async function sprintsRoutes(app: FastifyInstance): Promise<void> {
  async function getSessionUserId(request: {
    headers: IncomingHttpHeaders;
  }): Promise<string | null> {
    const session = await auth.api.getSession({ headers: toWebHeaders(request.headers) });
    return session?.user.id ?? null;
  }

  app.get("/api/sprints", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const rows = await db
      .select()
      .from(pointSprint)
      .where(eq(pointSprint.userId, userId))
      .orderBy(asc(pointSprint.startAt), asc(pointSprint.createdAt));
    return { sprints: rows.map(toSprint) };
  });

  app.post("/api/sprints", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const parsed = parseBody(request, sprintFormSchema);
    if ("error" in parsed) return reply.status(parsed.error.status).send(parsed.error.body);

    const now = new Date();
    const [created] = await db
      .insert(pointSprint)
      .values({
        id: randomUUID(),
        userId,
        name: parsed.data.name || null,
        startAt: new Date(parsed.data.startAt),
        endAt: new Date(parsed.data.endAt),
        target: parsed.data.target,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return reply.status(201).send({ sprint: toSprint(created!) });
  });

  app.patch("/api/sprints/:id", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const parsed = parseBody(request, sprintFormSchema);
    if ("error" in parsed) return reply.status(parsed.error.status).send(parsed.error.body);

    const { id } = request.params as { id: string };
    const [updated] = await db
      .update(pointSprint)
      .set({
        name: parsed.data.name || null,
        startAt: new Date(parsed.data.startAt),
        endAt: new Date(parsed.data.endAt),
        target: parsed.data.target,
        updatedAt: new Date(),
      })
      .where(and(eq(pointSprint.id, id), eq(pointSprint.userId, userId)))
      .returning();
    if (!updated) return reply.status(404).send({ error: "not_found" });
    return { sprint: toSprint(updated) };
  });

  app.delete("/api/sprints/:id", async (request, reply) => {
    const userId = await getSessionUserId(request);
    if (!userId) return reply.status(401).send({ error: "unauthenticated" });

    const { id } = request.params as { id: string };
    const owned = and(eq(pointSprint.id, id), eq(pointSprint.userId, userId));
    const [existing] = await db.select({ id: pointSprint.id }).from(pointSprint).where(owned);
    if (!existing) return reply.status(404).send({ error: "not_found" });
    await db.delete(pointSprint).where(owned);
    return reply.status(204).send();
  });
}

function toSprint(row: typeof pointSprint.$inferSelect): PointSprint {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    target: row.target,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
