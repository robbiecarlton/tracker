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
  overrides: { name?: string; parentId?: string | null } = {},
): Promise<HabitJson> {
  const create = await app.inject({
    method: "POST",
    url: "/api/habits",
    headers: { cookie, "content-type": "application/json" },
    payload: JSON.stringify({
      name: overrides.name ?? "Habit",
      startDate: "2026-01-01",
      views: [{ kind: "cumulative" }],
      ...(overrides.parentId !== undefined ? { parentId: overrides.parentId } : {}),
    }),
  });
  return (create.json() as { habit: HabitJson }).habit;
}

async function listHabits(cookie: string): Promise<HabitJson[]> {
  const res = await app.inject({ method: "GET", url: "/api/habits", headers: { cookie } });
  return (res.json() as { habits: HabitJson[] }).habits;
}

async function reorder(
  cookie: string,
  parentId: string | null,
  orderedIds: string[],
): Promise<{ status: number }> {
  const res = await app.inject({
    method: "PATCH",
    url: "/api/habits/reorder",
    headers: { cookie, "content-type": "application/json" },
    payload: JSON.stringify({ parentId, orderedIds }),
  });
  return { status: res.statusCode };
}

describe("habit sort order", () => {
  it("appends new top-level habits to the end of their group in creation order", async () => {
    const cookie = await signUpAndGetCookie(app, "sort-create-order");
    const a = await createHabit(cookie, { name: "A" });
    const b = await createHabit(cookie, { name: "B" });
    const c = await createHabit(cookie, { name: "C" });

    const habits = await listHabits(cookie);
    const ids = habits.map((h) => h.id);
    expect(ids.indexOf(a.id)).toBeLessThan(ids.indexOf(b.id));
    expect(ids.indexOf(b.id)).toBeLessThan(ids.indexOf(c.id));
  });

  it("persists a reorder and it survives a refetch", async () => {
    const cookie = await signUpAndGetCookie(app, "sort-persist");
    const a = await createHabit(cookie, { name: "A" });
    const b = await createHabit(cookie, { name: "B" });
    const c = await createHabit(cookie, { name: "C" });

    const res = await reorder(cookie, null, [c.id, a.id, b.id]);
    expect(res.status).toBe(200);

    const habits = await listHabits(cookie);
    const topLevelIds = habits.filter((h) => h.parentId === null).map((h) => h.id);
    expect(topLevelIds).toEqual([c.id, a.id, b.id]);
  });

  it("scopes reordering to one parentId group — reordering top-level habits doesn't touch a parent's subhabit order, and vice versa", async () => {
    const cookie = await signUpAndGetCookie(app, "sort-scoped");
    const parent = await createHabit(cookie, { name: "Parent" });
    const child1 = await createHabit(cookie, { name: "Child 1", parentId: parent.id });
    const child2 = await createHabit(cookie, { name: "Child 2", parentId: parent.id });
    const sibling = await createHabit(cookie, { name: "Sibling" });

    // Reorder the subhabits — should not disturb top-level order.
    await reorder(cookie, parent.id, [child2.id, child1.id]);
    let habits = await listHabits(cookie);
    expect(habits.filter((h) => h.parentId === parent.id).map((h) => h.id)).toEqual([
      child2.id,
      child1.id,
    ]);
    expect(habits.filter((h) => h.parentId === null).map((h) => h.id)).toEqual([
      parent.id,
      sibling.id,
    ]);

    // Reorder top-level — should not disturb the subhabit order just set.
    await reorder(cookie, null, [sibling.id, parent.id]);
    habits = await listHabits(cookie);
    expect(habits.filter((h) => h.parentId === null).map((h) => h.id)).toEqual([
      sibling.id,
      parent.id,
    ]);
    expect(habits.filter((h) => h.parentId === parent.id).map((h) => h.id)).toEqual([
      child2.id,
      child1.id,
    ]);
  });

  it("rejects a reorder whose id set doesn't exactly match the current sibling group", async () => {
    const cookie = await signUpAndGetCookie(app, "sort-invalid");
    const a = await createHabit(cookie, { name: "A" });
    const b = await createHabit(cookie, { name: "B" });

    // Missing a member.
    expect((await reorder(cookie, null, [a.id])).status).toBe(400);
    // Extra/unknown id.
    expect((await reorder(cookie, null, [a.id, b.id, "nonexistent"])).status).toBe(400);
    // Duplicate.
    expect((await reorder(cookie, null, [a.id, a.id])).status).toBe(400);
  });

  it("404-scoped: can't reorder using another user's habit ids", async () => {
    const cookieA = await signUpAndGetCookie(app, "sort-owner-a");
    const cookieB = await signUpAndGetCookie(app, "sort-owner-b");
    const a = await createHabit(cookieA, { name: "A" });

    // B has no habits at all, so any non-empty orderedIds is invalid for
    // B's (empty) top-level group.
    expect((await reorder(cookieB, null, [a.id])).status).toBe(400);
  });

  it("a reparented habit (via plain PATCH) is appended to the end of its new sibling group", async () => {
    const cookie = await signUpAndGetCookie(app, "sort-reparent");
    const oldParent = await createHabit(cookie, { name: "Old parent" });
    const newParent = await createHabit(cookie, { name: "New parent" });
    const existingChild = await createHabit(cookie, { name: "Existing child", parentId: newParent.id });
    const moved = await createHabit(cookie, { name: "Moved", parentId: oldParent.id });

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/habits/${moved.id}`,
      headers: { cookie, "content-type": "application/json" },
      payload: JSON.stringify({
        name: moved.name,
        startDate: "2026-01-01",
        views: [{ kind: "cumulative" }],
        parentId: newParent.id,
        allowDirectLogging: true,
      }),
    });
    expect(patch.statusCode).toBe(200);

    const habits = await listHabits(cookie);
    const newSiblings = habits.filter((h) => h.parentId === newParent.id).map((h) => h.id);
    expect(newSiblings).toEqual([existingChild.id, moved.id]);
  });

  it("a delete-with-children promote/rehome appends the reparented siblings in their prior relative order", async () => {
    const cookie = await signUpAndGetCookie(app, "sort-delete-reparent");
    const grandparent = await createHabit(cookie, { name: "Grandparent" });
    const parent = await createHabit(cookie, { name: "Parent", parentId: grandparent.id });
    const childA = await createHabit(cookie, { name: "Child A", parentId: parent.id });
    const childB = await createHabit(cookie, { name: "Child B", parentId: parent.id });
    const existingTopLevel = await createHabit(cookie, { name: "Existing top-level" });

    const del = await app.inject({
      method: "DELETE",
      url: `/api/habits/${parent.id}?childrenAction=top_level`,
      headers: { cookie },
    });
    expect(del.statusCode).toBe(204);

    const habits = await listHabits(cookie);
    const topLevelIds = habits.filter((h) => h.parentId === null).map((h) => h.id);
    // existingTopLevel was already there; childA/childB arrive afterward,
    // in their prior relative order (A before B).
    expect(topLevelIds).toEqual([grandparent.id, existingTopLevel.id, childA.id, childB.id]);
  });
});
