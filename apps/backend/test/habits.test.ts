import { parseInZone } from "@tracker/core";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { rawClient } from "../src/db";
import { runMigrations } from "../src/db/migrator";

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

function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : [String(raw)];
  return list.map((c) => c.split(";")[0]).join("; ");
}

async function signUpAndGetCookie(emailPrefix: string): Promise<string> {
  const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const signUp = await app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ name: "Test User", email, password: "password123" }),
  });
  expect(signUp.statusCode).toBe(200);
  return cookieFrom(signUp);
}

interface HabitJson {
  id: string;
  name: string;
  startDate: string;
  createdAt: string;
  updatedAt: string;
  views: { id: string; kind: string; unit?: string; target?: number; targetType?: string }[];
  logs: { id: string; notes: string | null; timestamp: string }[];
}

describe("habits API", () => {
  it("CORS preflight allows PATCH and DELETE (regression: @fastify/cors defaults to GET,HEAD,POST only)", async () => {
    // app.inject() bypasses actual browser CORS enforcement, so this test
    // doesn't catch the bug by exercising a blocked request — it catches it
    // by checking the preflight response @fastify/cors computes, the same
    // computation a real browser reads before deciding whether to send the
    // real PATCH/DELETE request at all. Without `methods` set in app.ts,
    // this assertion fails because the default omits PATCH and DELETE,
    // which is exactly what silently broke habit edit/delete from a browser.
    for (const method of ["PATCH", "DELETE"]) {
      const preflight = await app.inject({
        method: "OPTIONS",
        url: "/api/habits/some-id",
        headers: {
          origin: "http://localhost:8081", // matches vitest.config.ts's WEB_ORIGIN
          "access-control-request-method": method,
        },
      });
      expect(preflight.statusCode).toBeLessThan(300);
      expect(String(preflight.headers["access-control-allow-methods"])).toContain(method);
    }
  });

  it("is 401 on every route without a session", async () => {
    const noCookie = { headers: {} };
    expect((await app.inject({ method: "GET", url: "/api/habits", ...noCookie })).statusCode).toBe(
      401,
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/habits",
          headers: { "content-type": "application/json" },
          payload: "{}",
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: "PATCH", url: "/api/habits/x", ...noCookie })).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: "DELETE", url: "/api/habits/x", ...noCookie })).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: "POST", url: "/api/habits/x/logs", ...noCookie })).statusCode,
    ).toBe(401);
  });

  it("create -> list -> update -> delete round trip", async () => {
    const cookie = await signUpAndGetCookie("roundtrip");

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
    expect(create.statusCode).toBe(201);
    const created = (create.json() as { habit: HabitJson }).habit;
    expect(created.name).toBe("Meditate");
    expect(created.views).toHaveLength(1);

    const list = await app.inject({ method: "GET", url: "/api/habits", headers: { cookie } });
    expect(list.statusCode).toBe(200);
    const listed = (list.json() as { habits: HabitJson[] }).habits;
    expect(listed.some((h) => h.id === created.id)).toBe(true);

    const update = await app.inject({
      method: "PATCH",
      url: `/api/habits/${created.id}`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Meditate Daily",
        startDate: "2026-01-01",
        views: [{ kind: "cumulative" }, { kind: "streak", unit: "day" }],
      }),
    });
    expect(update.statusCode).toBe(200);
    const updated = (update.json() as { habit: HabitJson }).habit;
    expect(updated.name).toBe("Meditate Daily");
    expect(updated.views).toHaveLength(2);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/habits/${created.id}`,
      headers: { cookie },
    });
    expect(del.statusCode).toBe(204);

    const listAfterDelete = await app.inject({
      method: "GET",
      url: "/api/habits",
      headers: { cookie },
    });
    const remaining = (listAfterDelete.json() as { habits: HabitJson[] }).habits;
    expect(remaining.some((h) => h.id === created.id)).toBe(false);
  });

  it("applies DEFAULT_HABIT_VIEWS when views is omitted or empty", async () => {
    const cookie = await signUpAndGetCookie("defaults");

    const omitted = await app.inject({
      method: "POST",
      url: "/api/habits",
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({ name: "No views specified", startDate: "2026-01-01" }),
    });
    expect(omitted.statusCode).toBe(201);
    const omittedHabit = (omitted.json() as { habit: HabitJson }).habit;
    expect(omittedHabit.views.map((v) => v.kind).sort()).toEqual(["cumulative", "days"]);

    const empty = await app.inject({
      method: "POST",
      url: "/api/habits",
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({ name: "Empty views array", startDate: "2026-01-01", views: [] }),
    });
    expect(empty.statusCode).toBe(201);
    const emptyHabit = (empty.json() as { habit: HabitJson }).habit;
    expect(emptyHabit.views.map((v) => v.kind).sort()).toEqual(["cumulative", "days"]);
  });

  it("persists explicit views verbatim, including targets", async () => {
    const cookie = await signUpAndGetCookie("explicit-views");

    const create = await app.inject({
      method: "POST",
      url: "/api/habits",
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Meditate",
        startDate: "2026-01-01",
        views: [{ kind: "percentage", unit: "day", target: 80, targetType: "at_least" }],
      }),
    });
    expect(create.statusCode).toBe(201);
    const habit = (create.json() as { habit: HabitJson }).habit;
    expect(habit.views).toHaveLength(1);
    expect(habit.views[0]).toMatchObject({
      kind: "percentage",
      unit: "day",
      target: 80,
      targetType: "at_least",
    });
  });

  it("rejects invalid payloads with 400", async () => {
    const cookie = await signUpAndGetCookie("validation");

    const cases = [
      { name: "", startDate: "2026-01-01", views: [{ kind: "cumulative" }] }, // missing name
      { name: "X", startDate: "not-a-date", views: [{ kind: "cumulative" }] }, // bad date
      {
        name: "X",
        startDate: "2026-01-01",
        views: [{ kind: "percentage", target: 80 }], // target without targetType
      },
      {
        name: "X",
        startDate: "2026-01-01",
        views: [{ kind: "streak", target: 5, targetType: "at_least" }], // target on streak
      },
      {
        name: "X",
        startDate: "2026-01-01",
        views: [{ kind: "streak", cumulationGoal: 10 }], // cumulationGoal on non-cumulative
      },
    ];

    for (const payload of cases) {
      const res = await app.inject({
        method: "POST",
        url: "/api/habits",
        headers: { cookie, "content-type": "application/json" },
        payload: JSON.stringify(payload),
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it("scopes habits to their owner: a second user can't see or act on the first user's habit", async () => {
    const cookieA = await signUpAndGetCookie("owner-a");
    const cookieB = await signUpAndGetCookie("owner-b");

    const create = await app.inject({
      method: "POST",
      url: "/api/habits",
      headers: { cookie: cookieA, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Owned by A",
        startDate: "2026-01-01",
        views: [{ kind: "cumulative" }],
      }),
    });
    const habitId = (create.json() as { habit: HabitJson }).habit.id;

    const listB = await app.inject({
      method: "GET",
      url: "/api/habits",
      headers: { cookie: cookieB },
    });
    const habitsB = (listB.json() as { habits: HabitJson[] }).habits;
    expect(habitsB.some((h) => h.id === habitId)).toBe(false);

    const patchB = await app.inject({
      method: "PATCH",
      url: `/api/habits/${habitId}`,
      headers: { cookie: cookieB, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Hijacked",
        startDate: "2026-01-01",
        views: [{ kind: "cumulative" }],
      }),
    });
    expect(patchB.statusCode).toBe(404);

    const deleteB = await app.inject({
      method: "DELETE",
      url: `/api/habits/${habitId}`,
      headers: { cookie: cookieB },
    });
    expect(deleteB.statusCode).toBe(404);

    const logB = await app.inject({
      method: "POST",
      url: `/api/habits/${habitId}/logs`,
      headers: { cookie: cookieB, "content-type": "application/json" },
      payload: "{}",
    });
    expect(logB.statusCode).toBe(404);
  });

  it("creates a log (simple and with notes), reflected in a subsequent list call", async () => {
    const cookie = await signUpAndGetCookie("logging");

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

    const simpleLog = await app.inject({
      method: "POST",
      url: `/api/habits/${habitId}/logs`,
      headers: { cookie, "content-type": "application/json" },
      payload: "{}",
    });
    expect(simpleLog.statusCode).toBe(201);
    expect((simpleLog.json() as { log: { notes: string | null } }).log.notes).toBeNull();

    const notedLog = await app.inject({
      method: "POST",
      url: `/api/habits/${habitId}/logs`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({ notes: "felt great" }),
    });
    expect(notedLog.statusCode).toBe(201);
    expect((notedLog.json() as { log: { notes: string | null } }).log.notes).toBe("felt great");

    const list = await app.inject({ method: "GET", url: "/api/habits", headers: { cookie } });
    const habit = (list.json() as { habits: HabitJson[] }).habits.find((h) => h.id === habitId);
    expect(habit?.logs).toHaveLength(2);
  });

  it("returns startDate/timestamp fields as valid ISO 8601 (regression: Drizzle date-mode read path)", async () => {
    // Regression test for the "Invalid datetime" bug: the GET read path
    // previously returned space-separated, non-colon-offset strings (e.g.
    // "2026-08-11 00:00:00-07") for timestamptz columns under Drizzle's
    // `mode: "string"`, which parseInZone (Luxon, strict ISO 8601) rejects.
    const cookie = await signUpAndGetCookie("iso-dates");

    const create = await app.inject({
      method: "POST",
      url: "/api/habits",
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Meditate",
        startDate: "2026-08-11",
        views: [{ kind: "cumulative" }],
      }),
    });
    const habitId = (create.json() as { habit: HabitJson }).habit.id;

    await app.inject({
      method: "POST",
      url: `/api/habits/${habitId}/logs`,
      headers: { cookie, "content-type": "application/json" },
      payload: "{}",
    });

    const list = await app.inject({ method: "GET", url: "/api/habits", headers: { cookie } });
    const habit = (list.json() as { habits: HabitJson[] }).habits.find((h) => h.id === habitId);
    if (!habit) throw new Error("created habit not found in list response");

    expect(() => parseInZone(habit.startDate, "America/Denver")).not.toThrow();
    expect(() => parseInZone(habit.createdAt, "America/Denver")).not.toThrow();
    expect(() => parseInZone(habit.updatedAt, "America/Denver")).not.toThrow();
    const log = habit.logs[0];
    if (!log) throw new Error("created log not found on habit");
    expect(() => parseInZone(log.timestamp, "America/Denver")).not.toThrow();
  });
});
