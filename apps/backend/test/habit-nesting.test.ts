import { aggregatedLogs, type HabitLog } from "@tracker/core";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { rawClient } from "../src/db";
import { runMigrations } from "../src/db/migrator";
import type { HabitJson } from "./habits.test";
import { signUpAndGetCookie } from "./helpers";

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
  overrides: { name?: string; startDate?: string; parentId?: string | null } = {},
): Promise<HabitJson> {
  const create = await app.inject({
    method: "POST",
    url: "/api/habits",
    headers: { cookie, "content-type": "application/json" },
    payload: JSON.stringify({
      name: overrides.name ?? "Habit",
      startDate: overrides.startDate ?? "2026-01-01",
      views: [{ kind: "cumulative" }],
      ...(overrides.parentId !== undefined ? { parentId: overrides.parentId } : {}),
    }),
  });
  return (create.json() as { habit: HabitJson }).habit;
}

async function addLog(cookie: string, habitId: string): Promise<{ status: number }> {
  const res = await app.inject({
    method: "POST",
    url: `/api/habits/${habitId}/logs`,
    headers: { cookie, "content-type": "application/json" },
    payload: "{}",
  });
  return { status: res.statusCode };
}

async function patchHabit(
  cookie: string,
  habit: HabitJson,
  patch: { parentId?: string | null; allowDirectLogging?: boolean } = {},
) {
  return app.inject({
    method: "PATCH",
    url: `/api/habits/${habit.id}`,
    headers: { cookie, "content-type": "application/json" },
    payload: JSON.stringify({
      name: habit.name,
      startDate: habit.startDate.slice(0, 10),
      views: habit.views.map((v) => (v.unit ? { kind: v.kind, unit: v.unit } : { kind: v.kind })),
      parentId: patch.parentId !== undefined ? patch.parentId : habit.parentId,
      allowDirectLogging:
        patch.allowDirectLogging !== undefined ? patch.allowDirectLogging : habit.allowDirectLogging,
    }),
  });
}

async function listHabits(cookie: string): Promise<HabitJson[]> {
  const res = await app.inject({ method: "GET", url: "/api/habits", headers: { cookie } });
  return (res.json() as { habits: HabitJson[] }).habits;
}

describe("nested habits — create/patch", () => {
  it("creates a habit with a parent, and it appears as that parent's child", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-create");
    const parent = await createHabit(cookie, { name: "Bad habits" });
    const child = await createHabit(cookie, { name: "Smoking", parentId: parent.id });

    expect(child.parentId).toBe(parent.id);
    expect(child.allowDirectLogging).toBe(true);
  });

  it("rejects creating a habit under a parent you don't own (or that doesn't exist)", async () => {
    const cookieA = await signUpAndGetCookie(app, "nest-create-a");
    const cookieB = await signUpAndGetCookie(app, "nest-create-b");
    const parentA = await createHabit(cookieA);

    const res = await app.inject({
      method: "POST",
      url: "/api/habits",
      headers: { cookie: cookieB, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Sneaky child",
        startDate: "2026-01-01",
        views: [{ kind: "cumulative" }],
        parentId: parentA.id,
      }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_parent" });

    const bogus = await app.inject({
      method: "POST",
      url: "/api/habits",
      headers: { cookie: cookieB, "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Orphan",
        startDate: "2026-01-01",
        views: [{ kind: "cumulative" }],
        parentId: "nonexistent",
      }),
    });
    expect(bogus.statusCode).toBe(400);
  });

  it("rejects a cyclic reparent — self, direct child, and a deeper descendant", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-cycle");
    const grandparent = await createHabit(cookie, { name: "Bad habits" });
    const parent = await createHabit(cookie, { name: "Smoking", parentId: grandparent.id });
    const child = await createHabit(cookie, { name: "Vaping", parentId: parent.id });

    const selfCycle = await patchHabit(cookie, grandparent, { parentId: grandparent.id });
    expect(selfCycle.statusCode).toBe(400);
    expect(selfCycle.json()).toMatchObject({ error: "invalid_parent" });

    const directChildCycle = await patchHabit(cookie, grandparent, { parentId: parent.id });
    expect(directChildCycle.statusCode).toBe(400);

    const deepDescendantCycle = await patchHabit(cookie, grandparent, { parentId: child.id });
    expect(deepDescendantCycle.statusCode).toBe(400);

    // Sanity: reparenting to an unrelated habit is fine.
    const unrelated = await createHabit(cookie, { name: "Exercise" });
    const ok = await patchHabit(cookie, unrelated, { parentId: grandparent.id });
    expect(ok.statusCode).toBe(200);
  });

  it("rejects disabling direct logging with no subhabits, allows it once one exists", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-no-subhabits");
    const habit = await createHabit(cookie, { name: "Bad habits" });

    const rejected = await patchHabit(cookie, habit, { allowDirectLogging: false });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({ error: "no_subhabits" });

    await createHabit(cookie, { name: "Smoking", parentId: habit.id });
    const accepted = await patchHabit(cookie, habit, { allowDirectLogging: false });
    expect(accepted.statusCode).toBe(200);
    expect((accepted.json() as { habit: HabitJson }).habit.allowDirectLogging).toBe(false);
  });

  it("rejects a direct log once allowDirectLogging is false", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-no-direct-log");
    const habit = await createHabit(cookie, { name: "Bad habits" });
    await createHabit(cookie, { name: "Smoking", parentId: habit.id });
    await patchHabit(cookie, habit, { allowDirectLogging: false });

    const { status } = await addLog(cookie, habit.id);
    expect(status).toBe(400);
  });
});

describe("nested habits — aggregation (via @tracker/core's aggregatedLogs over the API response)", () => {
  it("rolls a grandchild's log up through its parent and grandparent, but not sideways", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-aggregate");
    const grandparent = await createHabit(cookie, { name: "Bad habits" });
    const parent = await createHabit(cookie, { name: "Smoking", parentId: grandparent.id });
    const child = await createHabit(cookie, { name: "Vaping", parentId: parent.id });
    const sibling = await createHabit(cookie, { name: "Drinking", parentId: grandparent.id });

    await addLog(cookie, child.id);

    const habits = await listHabits(cookie);
    // The backend itself never merges logs across habits — @tracker/core's
    // views run client-side over whatever `logs` array is handed to them
    // (see packages/core/src/views.ts), so the API's job is just to report
    // each habit's own logs accurately...
    const parentJson = habits.find((h) => h.id === parent.id);
    expect(parentJson?.logs).toHaveLength(0);
    const childJson = habits.find((h) => h.id === child.id);
    expect(childJson?.logs).toHaveLength(1);

    // ...and `aggregatedLogs` (the shared helper both this backend's route
    // handlers and the mobile app use for tree logic) correctly rolls it up
    // when given that same flat `habits` array.
    const grandparentRollup = aggregatedLogs(grandparent.id, habits) as HabitLog[];
    expect(grandparentRollup).toHaveLength(1);
    expect(grandparentRollup[0]?.habitId).toBe(child.id);

    const siblingRollup = aggregatedLogs(sibling.id, habits);
    expect(siblingRollup).toHaveLength(0);
  });
});

describe("nested habits — delete with children", () => {
  async function threeLevelTree(cookie: string) {
    const grandparent = await createHabit(cookie, { name: "Bad habits" });
    const parent = await createHabit(cookie, { name: "Smoking", parentId: grandparent.id });
    const child = await createHabit(cookie, { name: "Vaping", parentId: parent.id });
    const sibling = await createHabit(cookie, { name: "Drinking", parentId: grandparent.id });
    return { grandparent, parent, child, sibling };
  }

  it("deletes outright when there are no active descendants", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-del-leaf");
    const habit = await createHabit(cookie);
    const res = await app.inject({
      method: "DELETE",
      url: `/api/habits/${habit.id}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(204);
  });

  it("requires childrenAction when active descendants exist", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-del-required");
    const { grandparent } = await threeLevelTree(cookie);
    const res = await app.inject({
      method: "DELETE",
      url: `/api/habits/${grandparent.id}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "children_action_required" });
  });

  it("cascade deletes the whole subtree, leaving unrelated habits alone", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-del-cascade");
    const { grandparent, parent, child, sibling } = await threeLevelTree(cookie);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/habits/${grandparent.id}?childrenAction=cascade`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(204);

    const remaining = await listHabits(cookie);
    const remainingIds = remaining.map((h) => h.id);
    expect(remainingIds).not.toContain(grandparent.id);
    expect(remainingIds).not.toContain(parent.id);
    expect(remainingIds).not.toContain(child.id);
    expect(remainingIds).not.toContain(sibling.id);
  });

  it("top_level promotes direct children only, leaving grandchildren's structure intact", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-del-top-level");
    const { grandparent, parent, child, sibling } = await threeLevelTree(cookie);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/habits/${grandparent.id}?childrenAction=top_level`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(204);

    const remaining = await listHabits(cookie);
    const remainingIds = remaining.map((h) => h.id);
    expect(remainingIds).not.toContain(grandparent.id);

    const parentAfter = remaining.find((h) => h.id === parent.id);
    const siblingAfter = remaining.find((h) => h.id === sibling.id);
    const childAfter = remaining.find((h) => h.id === child.id);
    expect(parentAfter?.parentId).toBeNull();
    expect(siblingAfter?.parentId).toBeNull();
    // Grandchild's parent is untouched — still points at `parent`, not top-level.
    expect(childAfter?.parentId).toBe(parent.id);
  });

  it("grandparent rehomes direct children under the deleted habit's own parent", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-del-grandparent");
    const top = await createHabit(cookie, { name: "Habits" });
    const grandparent = await createHabit(cookie, { name: "Bad habits", parentId: top.id });
    const parent = await createHabit(cookie, { name: "Smoking", parentId: grandparent.id });
    const child = await createHabit(cookie, { name: "Vaping", parentId: parent.id });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/habits/${grandparent.id}?childrenAction=grandparent`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(204);

    const remaining = await listHabits(cookie);
    const parentAfter = remaining.find((h) => h.id === parent.id);
    const childAfter = remaining.find((h) => h.id === child.id);
    expect(parentAfter?.parentId).toBe(top.id);
    expect(childAfter?.parentId).toBe(parent.id);
  });

  it("rejects grandparent on a top-level habit (no grandparent to rehome to)", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-del-grandparent-invalid");
    const { grandparent } = await threeLevelTree(cookie);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/habits/${grandparent.id}?childrenAction=grandparent`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid_children_action" });
  });

  it("deletes outright (no prompt) when every descendant is already archived", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-del-all-archived");
    const parent = await createHabit(cookie, { name: "Bad habits" });
    const child = await createHabit(cookie, { name: "Smoking", parentId: parent.id });
    await app.inject({ method: "POST", url: `/api/habits/${child.id}/archive`, headers: { cookie } });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/habits/${parent.id}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(204);

    const remaining = await listHabits(cookie);
    const childAfter = remaining.find((h) => h.id === child.id);
    // The archived child survives, promoted to top-level rather than orphaned.
    expect(childAfter?.parentId).toBeNull();
  });
});

describe("nested habits — archive with children", () => {
  it("archives outright when there are no active descendants", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-arc-leaf");
    const habit = await createHabit(cookie);
    const res = await app.inject({
      method: "POST",
      url: `/api/habits/${habit.id}/archive`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { habit: HabitJson }).habit.archivedAt).not.toBeNull();
  });

  it("requires childrenAction when active descendants exist", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-arc-required");
    const parent = await createHabit(cookie, { name: "Bad habits" });
    await createHabit(cookie, { name: "Smoking", parentId: parent.id });

    const res = await app.inject({
      method: "POST",
      url: `/api/habits/${parent.id}/archive`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "children_action_required" });
  });

  it("cascade archives the whole active subtree", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-arc-cascade");
    const parent = await createHabit(cookie, { name: "Bad habits" });
    const child = await createHabit(cookie, { name: "Smoking", parentId: parent.id });
    const grandchild = await createHabit(cookie, { name: "Vaping", parentId: child.id });

    const res = await app.inject({
      method: "POST",
      url: `/api/habits/${parent.id}/archive?childrenAction=cascade`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);

    const habits = await listHabits(cookie);
    for (const id of [parent.id, child.id, grandchild.id]) {
      expect(habits.find((h) => h.id === id)?.archivedAt).not.toBeNull();
    }
  });

  it("top_level promotes active direct children instead of archiving them", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-arc-top-level");
    const parent = await createHabit(cookie, { name: "Bad habits" });
    const child = await createHabit(cookie, { name: "Smoking", parentId: parent.id });

    const res = await app.inject({
      method: "POST",
      url: `/api/habits/${parent.id}/archive?childrenAction=top_level`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(200);

    const habits = await listHabits(cookie);
    const parentAfter = habits.find((h) => h.id === parent.id);
    const childAfter = habits.find((h) => h.id === child.id);
    expect(parentAfter?.archivedAt).not.toBeNull();
    expect(childAfter?.archivedAt).toBeNull();
    expect(childAfter?.parentId).toBeNull();
  });
});

describe("nested habits — archive-and-clone guard", () => {
  it("rejects archive-and-clone while the habit has an active subhabit", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-clone-blocked");
    const habit = await createHabit(cookie, { startDate: "2026-01-01" });
    await createHabit(cookie, { name: "Smoking", parentId: habit.id });

    const res = await app.inject({
      method: "POST",
      url: `/api/habits/${habit.id}/archive-and-clone`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({
        name: habit.name,
        startDate: "2026-02-01",
        views: [{ kind: "cumulative" }],
        parentId: null,
        allowDirectLogging: true,
      }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "has_active_subhabits" });
  });

  it("allows archive-and-clone once the subhabit is resolved (archived here)", async () => {
    const cookie = await signUpAndGetCookie(app, "nest-clone-allowed");
    const habit = await createHabit(cookie, { startDate: "2026-01-01" });
    const child = await createHabit(cookie, { name: "Smoking", parentId: habit.id });
    await app.inject({ method: "POST", url: `/api/habits/${child.id}/archive`, headers: { cookie } });

    const res = await app.inject({
      method: "POST",
      url: `/api/habits/${habit.id}/archive-and-clone`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({
        name: habit.name,
        startDate: "2026-02-01",
        views: [{ kind: "cumulative" }],
        parentId: null,
        allowDirectLogging: true,
      }),
    });
    expect(res.statusCode).toBe(201);
  });
});
