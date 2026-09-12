import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { rawClient } from "../src/db";
import { runMigrations } from "../src/db/migrator";
import { signUpAndGetCookie } from "./helpers";
import type { HabitJson } from "./habits.test";

let app: FastifyInstance;

beforeAll(async () => {
  await runMigrations();
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await rawClient.close().catch(() => {});
});

async function createHabitWithLog(cookie: string): Promise<{ habitId: string; logId: string }> {
  const create = await app.inject({
    method: "POST",
    url: "/api/habits",
    headers: { cookie, "content-type": "application/json" },
    payload: JSON.stringify({
      name: "Meditate",
      startDate: "2026-01-01",
      views: [{ kind: "cumulative" }],
    }),
  });
  const habitId = (create.json() as { habit: HabitJson }).habit.id;

  const log = await app.inject({
    method: "POST",
    url: `/api/habits/${habitId}/logs`,
    headers: { cookie, "content-type": "application/json" },
    payload: "{}",
  });
  const logId = (log.json() as { log: { id: string } }).log.id;

  return { habitId, logId };
}

describe("per-log edit/delete", () => {
  it("is 401 on both routes without a session", async () => {
    const noCookie = { headers: {} };
    expect(
      (await app.inject({ method: "PATCH", url: "/api/habits/x/logs/y", ...noCookie })).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: "DELETE", url: "/api/habits/x/logs/y", ...noCookie })).statusCode,
    ).toBe(401);
  });

  it("edits a log's timestamp and notes, reflected in a subsequent list call", async () => {
    const cookie = await signUpAndGetCookie(app, "log-edit");
    const { habitId, logId } = await createHabitWithLog(cookie);

    const update = await app.inject({
      method: "PATCH",
      url: `/api/habits/${habitId}/logs/${logId}`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({ timestamp: "2026-01-02T08:00:00Z", notes: "felt great" }),
    });
    expect(update.statusCode).toBe(200);
    const updated = (update.json() as { log: { timestamp: string; notes: string | null } }).log;
    expect(updated.timestamp).toBe("2026-01-02T08:00:00.000Z");
    expect(updated.notes).toBe("felt great");

    const list = await app.inject({ method: "GET", url: "/api/habits", headers: { cookie } });
    const habit = (list.json() as { habits: HabitJson[] }).habits.find((h) => h.id === habitId);
    const log = habit?.logs.find((l) => l.id === logId);
    expect(log?.notes).toBe("felt great");
  });

  it("rejects an invalid timestamp with 400", async () => {
    const cookie = await signUpAndGetCookie(app, "log-edit-invalid");
    const { habitId, logId } = await createHabitWithLog(cookie);

    const update = await app.inject({
      method: "PATCH",
      url: `/api/habits/${habitId}/logs/${logId}`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({ timestamp: "not-a-date", notes: null }),
    });
    expect(update.statusCode).toBe(400);
  });

  it("deletes a log; it's gone from a subsequent list call", async () => {
    const cookie = await signUpAndGetCookie(app, "log-delete");
    const { habitId, logId } = await createHabitWithLog(cookie);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/habits/${habitId}/logs/${logId}`,
      headers: { cookie },
    });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({ method: "GET", url: "/api/habits", headers: { cookie } });
    const habit = (list.json() as { habits: HabitJson[] }).habits.find((h) => h.id === habitId);
    expect(habit?.logs.some((l) => l.id === logId)).toBe(false);
  });

  it("404s for another user's habit", async () => {
    const cookieA = await signUpAndGetCookie(app, "log-owner-a");
    const cookieB = await signUpAndGetCookie(app, "log-owner-b");
    const { habitId, logId } = await createHabitWithLog(cookieA);

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/habits/${habitId}/logs/${logId}`,
      headers: { cookie: cookieB, "content-type": "application/json" },
      payload: JSON.stringify({ timestamp: "2026-01-02T08:00:00Z", notes: null }),
    });
    expect(patch.statusCode).toBe(404);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/habits/${habitId}/logs/${logId}`,
      headers: { cookie: cookieB },
    });
    expect(del.statusCode).toBe(404);
  });

  it("404s for a logId that belongs to the same user's other habit", async () => {
    const cookie = await signUpAndGetCookie(app, "log-mismatch");
    const { habitId: habitA } = await createHabitWithLog(cookie);
    const { logId: logOnB } = await createHabitWithLog(cookie); // a second habit + log

    const patch = await app.inject({
      method: "PATCH",
      // habitA is real and owned by this user, but logOnB belongs to habitB.
      url: `/api/habits/${habitA}/logs/${logOnB}`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({ timestamp: "2026-01-02T08:00:00Z", notes: null }),
    });
    expect(patch.statusCode).toBe(404);
  });

  it("404s for a nonexistent logId on the caller's own habit", async () => {
    const cookie = await signUpAndGetCookie(app, "log-notfound");
    const { habitId } = await createHabitWithLog(cookie);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/habits/${habitId}/logs/does-not-exist`,
      headers: { cookie },
    });
    expect(del.statusCode).toBe(404);
  });
});
