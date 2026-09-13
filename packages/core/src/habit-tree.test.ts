import { describe, expect, it } from "vitest";
import type { Habit, HabitLog } from "./domain";
import {
  aggregatedLogs,
  buildDashboardRows,
  childrenOf,
  getDescendants,
  wouldCreateCycle,
} from "./habit-tree";

function habit(id: string, overrides: Partial<Habit> = {}): Habit {
  return {
    id,
    userId: "user-1",
    name: id,
    startDate: "2026-01-01T00:00:00Z",
    views: [],
    archivedAt: null,
    parentId: null,
    allowDirectLogging: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function log(id: string, habitId: string, timestamp = "2026-01-05T08:00:00Z"): HabitLog {
  return { id, habitId, timestamp, notes: null, createdAt: timestamp, updatedAt: timestamp };
}

/**
 * Fixture tree:
 *   bad-habits (top-level)
 *     - smoking
 *       - vaping
 *     - drinking
 *   exercise (top-level, unrelated)
 */
function fixtureTree(overrides: Partial<Record<string, Partial<Habit>>> = {}): Habit[] {
  return [
    habit("bad-habits", overrides["bad-habits"]),
    habit("smoking", { parentId: "bad-habits", ...overrides.smoking }),
    habit("vaping", { parentId: "smoking", ...overrides.vaping }),
    habit("drinking", { parentId: "bad-habits", ...overrides.drinking }),
    habit("exercise", overrides.exercise),
  ];
}

describe("childrenOf", () => {
  it("returns only direct children, in input order", () => {
    const habits = fixtureTree();
    expect(childrenOf("bad-habits", habits).map((h) => h.id)).toEqual(["smoking", "drinking"]);
    expect(childrenOf("smoking", habits).map((h) => h.id)).toEqual(["vaping"]);
    expect(childrenOf(null, habits).map((h) => h.id)).toEqual(["bad-habits", "exercise"]);
  });
});

describe("getDescendants", () => {
  it("walks arbitrarily deep, tagging each with its depth", () => {
    const habits = fixtureTree();
    const descendants = getDescendants("bad-habits", habits);
    expect(descendants.map((d) => [d.habit.id, d.depth])).toEqual([
      ["smoking", 1],
      ["vaping", 2],
      ["drinking", 1],
    ]);
  });

  it("returns an empty array for a leaf habit", () => {
    expect(getDescendants("vaping", fixtureTree())).toEqual([]);
  });
});

describe("wouldCreateCycle", () => {
  it("rejects a habit becoming its own parent", () => {
    expect(wouldCreateCycle("smoking", "smoking", fixtureTree())).toBe(true);
  });

  it("rejects a habit becoming a child of its direct child", () => {
    expect(wouldCreateCycle("smoking", "vaping", fixtureTree())).toBe(true);
  });

  it("rejects a habit becoming a child of a deeper descendant", () => {
    // bad-habits -> vaping is 2 levels down; still a cycle.
    expect(wouldCreateCycle("bad-habits", "vaping", fixtureTree())).toBe(true);
  });

  it("allows reparenting to an unrelated habit", () => {
    expect(wouldCreateCycle("smoking", "exercise", fixtureTree())).toBe(false);
  });

  it("allows reparenting to top-level's sibling (not an ancestor)", () => {
    expect(wouldCreateCycle("vaping", "drinking", fixtureTree())).toBe(false);
  });
});

describe("aggregatedLogs", () => {
  function withLogs(habits: Habit[], logsByHabit: Record<string, HabitLog[]>) {
    return habits.map((h) => ({ ...h, logs: logsByHabit[h.id] ?? [] }));
  }

  it("includes the habit's own logs plus every non-archived descendant's logs", () => {
    const habits = withLogs(fixtureTree(), {
      "bad-habits": [log("l1", "bad-habits")],
      smoking: [log("l2", "smoking")],
      vaping: [log("l3", "vaping")],
      drinking: [log("l4", "drinking")],
    });
    const ids = aggregatedLogs("bad-habits", habits).map((l) => l.id);
    expect(ids.sort()).toEqual(["l1", "l2", "l3", "l4"]);
  });

  it("stops an archived descendant's logs from counting, but not its own siblings'", () => {
    const habits = withLogs(fixtureTree({ smoking: { archivedAt: "2026-02-01T00:00:00Z" } }), {
      smoking: [log("l2", "smoking")],
      vaping: [log("l3", "vaping")],
      drinking: [log("l4", "drinking")],
    });
    const ids = aggregatedLogs("bad-habits", habits).map((l) => l.id);
    // smoking is archived, so its own log (l2) and vaping's log (l3, its
    // child) both drop out of the rollup — only drinking's survives.
    expect(ids).toEqual(["l4"]);
  });

  it("returns just the habit's own logs when it has no children", () => {
    const habits = withLogs(fixtureTree(), { drinking: [log("l4", "drinking")] });
    expect(aggregatedLogs("drinking", habits).map((l) => l.id)).toEqual(["l4"]);
  });

  it("returns an empty array for an unknown habit id", () => {
    const habits = withLogs(fixtureTree(), {});
    expect(aggregatedLogs("nonexistent", habits)).toEqual([]);
  });
});

describe("buildDashboardRows", () => {
  it("flattens top-level habits and their children depth-first when nothing is collapsed", () => {
    const rows = buildDashboardRows(fixtureTree(), new Set());
    expect(rows.map((r) => [r.habit.id, r.depth])).toEqual([
      ["bad-habits", 0],
      ["smoking", 1],
      ["vaping", 2],
      ["drinking", 1],
      ["exercise", 0],
    ]);
  });

  it("skips a collapsed habit's descendants but keeps the habit itself", () => {
    const rows = buildDashboardRows(fixtureTree(), new Set(["smoking"]));
    expect(rows.map((r) => r.habit.id)).toEqual(["bad-habits", "smoking", "drinking", "exercise"]);
  });

  it("hides an archived habit and its whole subtree", () => {
    const rows = buildDashboardRows(
      fixtureTree({ smoking: { archivedAt: "2026-02-01T00:00:00Z" } }),
      new Set(),
    );
    // smoking is archived, so it (and vaping under it) both disappear —
    // drinking, its non-archived sibling, is unaffected.
    expect(rows.map((r) => r.habit.id)).toEqual(["bad-habits", "drinking", "exercise"]);
  });

  it("hides an archived top-level habit and its whole subtree", () => {
    const rows = buildDashboardRows(
      fixtureTree({ "bad-habits": { archivedAt: "2026-02-01T00:00:00Z" } }),
      new Set(),
    );
    expect(rows.map((r) => r.habit.id)).toEqual(["exercise"]);
  });
});
