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

async function createHabit(
  cookie: string,
  overrides: { name?: string; startDate?: string } = {},
): Promise<HabitJson> {
  const create = await app.inject({
    method: "POST",
    url: "/api/habits",
    headers: { cookie, "content-type": "application/json" },
    payload: JSON.stringify({
      name: overrides.name ?? "Meditate",
      startDate: overrides.startDate ?? "2026-01-01",
      views: [{ kind: "cumulative" }],
    }),
  });
  return (create.json() as { habit: HabitJson }).habit;
}

async function addLog(cookie: string, habitId: string, timestamp?: string): Promise<void> {
  await app.inject({
    method: "POST",
    url: `/api/habits/${habitId}/logs`,
    headers: { cookie, "content-type": "application/json" },
    payload: JSON.stringify(timestamp ? { timestamp } : {}),
  });
}

describe("archive / unarchive", () => {
  it("is 401 on all three routes without a session", async () => {
    const noCookie = { headers: {} };
    for (const path of ["archive", "unarchive", "archive-and-clone"]) {
      expect(
        (await app.inject({ method: "POST", url: `/api/habits/x/${path}`, ...noCookie }))
          .statusCode,
      ).toBe(401);
    }
  });

  it("archive sets archivedAt; the habit still appears in an unfiltered list", async () => {
    const cookie = await signUpAndGetCookie(app, "archive-basic");
    const habit = await createHabit(cookie);

    const archive = await app.inject({
      method: "POST",
      url: `/api/habits/${habit.id}/archive`,
      headers: { cookie },
    });
    expect(archive.statusCode).toBe(200);
    expect((archive.json() as { habit: HabitJson }).habit.archivedAt).not.toBeNull();

    const list = await app.inject({ method: "GET", url: "/api/habits", headers: { cookie } });
    const listed = (list.json() as { habits: HabitJson[] }).habits.find((h) => h.id === habit.id);
    expect(listed?.archivedAt).not.toBeNull();
  });

  it("unarchive clears archivedAt", async () => {
    const cookie = await signUpAndGetCookie(app, "unarchive-basic");
    const habit = await createHabit(cookie);
    await app.inject({
      method: "POST",
      url: `/api/habits/${habit.id}/archive`,
      headers: { cookie },
    });

    const unarchive = await app.inject({
      method: "POST",
      url: `/api/habits/${habit.id}/unarchive`,
      headers: { cookie },
    });
    expect(unarchive.statusCode).toBe(200);
    expect((unarchive.json() as { habit: HabitJson }).habit.archivedAt).toBeNull();
  });

  it("404s archive/unarchive for another user's habit", async () => {
    const cookieA = await signUpAndGetCookie(app, "archive-owner-a");
    const cookieB = await signUpAndGetCookie(app, "archive-owner-b");
    const habit = await createHabit(cookieA);

    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/habits/${habit.id}/archive`,
          headers: { cookie: cookieB },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/habits/${habit.id}/unarchive`,
          headers: { cookie: cookieB },
        })
      ).statusCode,
    ).toBe(404);
  });
});

describe("archive-and-clone", () => {
  it("archives the old habit as-is and creates a fresh one with the submitted config", async () => {
    const cookie = await signUpAndGetCookie(app, "clone-basic");
    const habit = await createHabit(cookie, { name: "Meditate", startDate: "2026-01-01" });
    await addLog(cookie, habit.id, "2026-01-05T08:00:00Z");
    await addLog(cookie, habit.id, "2026-01-06T08:00:00Z");

    const clone = await app.inject({
      method: "POST",
      url: `/api/habits/${habit.id}/archive-and-clone`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Meditate",
        startDate: "2026-02-01",
        views: [{ kind: "cumulative" }, { kind: "streak", unit: "day" }],
      }),
    });
    expect(clone.statusCode).toBe(201);
    const { archivedHabit, newHabit } = clone.json() as {
      archivedHabit: HabitJson;
      newHabit: HabitJson;
    };

    // Old habit: archived, config and logs untouched.
    expect(archivedHabit.id).toBe(habit.id);
    expect(archivedHabit.archivedAt).not.toBeNull();
    expect(archivedHabit.name).toBe("Meditate");
    expect(archivedHabit.startDate).toBe(habit.startDate);
    expect(archivedHabit.logs).toHaveLength(2);
    expect(archivedHabit.views).toHaveLength(1); // unchanged from creation

    // New habit: fresh id, submitted config, no logs.
    expect(newHabit.id).not.toBe(habit.id);
    expect(newHabit.archivedAt).toBeNull();
    expect(newHabit.name).toBe("Meditate");
    expect(newHabit.startDate.slice(0, 10)).toBe("2026-02-01");
    expect(newHabit.views.map((v) => v.kind).sort()).toEqual(["cumulative", "streak"]);
    expect(newHabit.logs).toHaveLength(0);

    // No start-date-history row for either habit — neither's own startDate changed.
    expect(archivedHabit.startDateHistory).toHaveLength(0);
    expect(newHabit.startDateHistory).toHaveLength(0);

    // Both appear in the unfiltered list.
    const list = await app.inject({ method: "GET", url: "/api/habits", headers: { cookie } });
    const ids = (list.json() as { habits: HabitJson[] }).habits.map((h) => h.id);
    expect(ids).toContain(archivedHabit.id);
    expect(ids).toContain(newHabit.id);
  });

  it("validates its body (400 on a bad payload)", async () => {
    const cookie = await signUpAndGetCookie(app, "clone-invalid");
    const habit = await createHabit(cookie);

    const clone = await app.inject({
      method: "POST",
      url: `/api/habits/${habit.id}/archive-and-clone`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "",
        startDate: "2026-02-01",
        views: [{ kind: "cumulative" }],
      }),
    });
    expect(clone.statusCode).toBe(400);
  });

  it("404s for another user's habit", async () => {
    const cookieA = await signUpAndGetCookie(app, "clone-owner-a");
    const cookieB = await signUpAndGetCookie(app, "clone-owner-b");
    const habit = await createHabit(cookieA);

    const clone = await app.inject({
      method: "POST",
      url: `/api/habits/${habit.id}/archive-and-clone`,
      headers: { cookie: cookieB, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Hijacked",
        startDate: "2026-02-01",
        views: [{ kind: "cumulative" }],
      }),
    });
    expect(clone.statusCode).toBe(404);
  });
});

describe("start-date history", () => {
  it("records exactly one row when startDate changes, none when it doesn't", async () => {
    const cookie = await signUpAndGetCookie(app, "history-basic");
    const habit = await createHabit(cookie, { startDate: "2026-01-01" });

    // Name-only change: no history row.
    await app.inject({
      method: "PATCH",
      url: `/api/habits/${habit.id}`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Meditate Daily",
        startDate: "2026-01-01",
        views: [{ kind: "cumulative" }],
      }),
    });
    let list = await app.inject({ method: "GET", url: "/api/habits", headers: { cookie } });
    let found = (list.json() as { habits: HabitJson[] }).habits.find((h) => h.id === habit.id);
    expect(found?.startDateHistory).toHaveLength(0);

    // startDate change: one history row.
    await app.inject({
      method: "PATCH",
      url: `/api/habits/${habit.id}`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Meditate Daily",
        startDate: "2026-01-10",
        views: [{ kind: "cumulative" }],
      }),
    });
    list = await app.inject({ method: "GET", url: "/api/habits", headers: { cookie } });
    found = (list.json() as { habits: HabitJson[] }).habits.find((h) => h.id === habit.id);
    expect(found?.startDateHistory).toHaveLength(1);
    expect(found?.startDateHistory[0]?.previousStartDate.slice(0, 10)).toBe("2026-01-01");
    expect(found?.startDateHistory[0]?.newStartDate.slice(0, 10)).toBe("2026-01-10");

    // Second startDate change: two history rows.
    await app.inject({
      method: "PATCH",
      url: `/api/habits/${habit.id}`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Meditate Daily",
        startDate: "2026-01-20",
        views: [{ kind: "cumulative" }],
      }),
    });
    list = await app.inject({ method: "GET", url: "/api/habits", headers: { cookie } });
    found = (list.json() as { habits: HabitJson[] }).habits.find((h) => h.id === habit.id);
    expect(found?.startDateHistory).toHaveLength(2);
  });
});
