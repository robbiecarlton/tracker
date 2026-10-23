import { describe, expect, it } from "vitest";
import type { HabitLog, PointSprint } from "./domain";
import {
  dailyAverageNeeded,
  doubleCountedHabitIds,
  matchesPointsFilter,
  remainingSprintDates,
  remainingSprintDays,
  sprintPoints,
  sprintStatus,
  suggestDailyPlan,
  type PointsHabit,
} from "./points";

function habit(id: string, overrides: Partial<PointsHabit> = {}): PointsHabit {
  return {
    id,
    parentId: null,
    archivedAt: null,
    startDate: "2026-01-01T00:00:00Z",
    pointsKind: null,
    pointsValue: null,
    allowDirectLogging: true,
    logs: [],
    ...overrides,
  };
}

function logs(habitId: string, ...timestamps: string[]): HabitLog[] {
  return timestamps.map((timestamp, i) => ({
    id: `${habitId}-log-${i}`,
    habitId,
    timestamp,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

function sprint(overrides: Partial<PointSprint> = {}): PointSprint {
  return {
    id: "sprint-1",
    userId: "user-1",
    name: null,
    startAt: "2026-03-01T00:00:00Z",
    endAt: "2026-03-04T00:00:00Z",
    target: 10,
    createdAt: "2026-02-01T00:00:00Z",
    updatedAt: "2026-02-01T00:00:00Z",
    ...overrides,
  };
}

const utc = (now: string) => ({ now, timeZone: "UTC" });
const AFTER = utc("2026-03-10T00:00:00Z");

/** Deterministic [0, 1) generator (mulberry32) for suggestion tests. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("sprintStatus", () => {
  it("is upcoming before start, active within, ended at/after end", () => {
    expect(sprintStatus(sprint(), utc("2026-02-28T23:59:59Z"))).toBe("upcoming");
    expect(sprintStatus(sprint(), utc("2026-03-01T00:00:00Z"))).toBe("active");
    expect(sprintStatus(sprint(), utc("2026-03-04T00:00:00Z"))).toBe("ended");
  });
});

describe("sprintPoints — per_log", () => {
  it("counts logs in [start, end), each worth the habit's value", () => {
    const h = habit("run", {
      pointsKind: "per_log",
      pointsValue: 3,
      logs: logs(
        "run",
        "2026-02-28T23:59:59Z", // before
        "2026-03-01T00:00:00Z", // at start: counts
        "2026-03-02T12:00:00Z",
        "2026-03-04T00:00:00Z", // at end: excluded
      ),
    });
    const result = sprintPoints(sprint(), [h], AFTER);
    expect(result.total).toBe(6);
    expect(result.byHabit.get("run")).toBe(6);
  });

  it("rolls a subhabit's log up into every per_log ancestor", () => {
    const parent = habit("exercise", { pointsKind: "per_log", pointsValue: 2 });
    const middle = habit("cardio", { parentId: "exercise" }); // no points
    const child = habit("run", {
      parentId: "cardio",
      pointsKind: "per_log",
      pointsValue: 1,
      logs: logs("run", "2026-03-02T12:00:00Z"),
    });
    const result = sprintPoints(sprint(), [parent, middle, child], AFTER);
    expect(result.total).toBe(3);
    expect(result.byHabit.get("exercise")).toBe(2);
    expect(result.byHabit.has("cardio")).toBe(false);
  });

  it("still counts an archived habit's logs", () => {
    const h = habit("run", {
      pointsKind: "per_log",
      pointsValue: 1,
      archivedAt: "2026-03-03T00:00:00Z",
      logs: logs("run", "2026-03-02T12:00:00Z"),
    });
    expect(sprintPoints(sprint(), [h], AFTER).total).toBe(1);
  });

  it("ignores habits without points", () => {
    const h = habit("run", { logs: logs("run", "2026-03-02T12:00:00Z") });
    expect(sprintPoints(sprint(), [h], AFTER).total).toBe(0);
  });
});

describe("sprintPoints — clean_day", () => {
  const smoking = (overrides: Partial<PointsHabit> = {}) =>
    habit("smoking", { pointsKind: "clean_day", pointsValue: 5, ...overrides });

  it("awards each midnight in (start, end] with a clean previous 24h", () => {
    // Start is exactly midnight Mar 1 (not counted); Mar 2, 3, 4 are.
    expect(sprintPoints(sprint(), [smoking()], AFTER).total).toBe(15);
  });

  it("a log in the 24h before a midnight forfeits that midnight only", () => {
    const h = smoking({ logs: logs("smoking", "2026-03-02T12:00:00Z") });
    expect(sprintPoints(sprint(), [h], AFTER).total).toBe(10);
  });

  it("the window is [M − 24h, M): 23h59m and exactly 24h before break it", () => {
    const at2359 = smoking({ logs: logs("smoking", "2026-03-01T00:01:00Z") });
    expect(sprintPoints(sprint(), [at2359], AFTER).total).toBe(10);
    const at24h = smoking({ logs: logs("smoking", "2026-03-01T00:00:00Z") });
    expect(sprintPoints(sprint(), [at24h], AFTER).total).toBe(10);
    const before = smoking({ logs: logs("smoking", "2026-02-28T23:59:59Z") });
    expect(sprintPoints(sprint(), [before], AFTER).total).toBe(15);
  });

  it("counts a midnight whose 24h window started before the sprint", () => {
    // Sprint starts at noon; Mar 2's window [Mar 1 00:00, Mar 2 00:00) is
    // only half inside it, and still counts.
    const s = sprint({ startAt: "2026-03-01T12:00:00Z" });
    expect(sprintPoints(s, [smoking()], AFTER).total).toBe(15);
  });

  it("only counts midnights that have already happened", () => {
    expect(sprintPoints(sprint(), [smoking()], utc("2026-03-02T12:00:00Z")).total).toBe(5);
  });

  it("doesn't award a window that starts before the habit's start date", () => {
    const h = smoking({ startDate: "2026-03-02T00:00:00Z" });
    expect(sprintPoints(sprint(), [h], AFTER).total).toBe(10);
  });

  it("stops awarding after the habit is archived", () => {
    const h = smoking({ archivedAt: "2026-03-03T06:00:00Z" });
    expect(sprintPoints(sprint(), [h], AFTER).total).toBe(10);
  });

  it("a subhabit's log breaks the parent's clean day", () => {
    const parent = smoking();
    const child = habit("cigar", {
      parentId: "smoking",
      logs: logs("cigar", "2026-03-02T12:00:00Z"),
    });
    expect(sprintPoints(sprint(), [parent, child], AFTER).total).toBe(10);
  });

  it("uses local midnights and a literal 24h across a DST change", () => {
    // America/Denver springs forward 2026-03-08 02:00. Local midnights in
    // the sprint: Mar 8 (07:00Z), Mar 9 (06:00Z), Mar 10 (06:00Z).
    const s = sprint({ startAt: "2026-03-07T07:00:00Z", endAt: "2026-03-10T06:00:00Z" });
    const ctx = { now: "2026-03-20T00:00:00Z", timeZone: "America/Denver" };
    expect(sprintPoints(s, [smoking()], ctx).total).toBe(15);
    // 23:30 local on Mar 7 = 06:30Z Mar 8. Within 24h of Mar 8's midnight,
    // and — since Mar 8 was only 23h long — of Mar 9's too.
    const h = smoking({ logs: logs("smoking", "2026-03-08T06:30:00Z") });
    expect(sprintPoints(s, [h], ctx).total).toBe(5);
  });
});

describe("remainingSprintDays / dailyAverageNeeded", () => {
  it("rounds a fractional remainder down", () => {
    expect(remainingSprintDays(sprint(), utc("2026-03-01T12:00:00Z"))).toBe(2);
  });

  it("uses the full sprint length before it starts", () => {
    expect(remainingSprintDays(sprint(), utc("2026-02-20T00:00:00Z"))).toBe(3);
  });

  it("is at least 1 during the last partial day, 0 once ended", () => {
    expect(remainingSprintDays(sprint(), utc("2026-03-03T20:00:00Z"))).toBe(1);
    expect(remainingSprintDays(sprint(), utc("2026-03-04T00:00:00Z"))).toBe(0);
  });

  it("divides the remaining points by the remaining whole days", () => {
    expect(dailyAverageNeeded(sprint({ target: 10 }), 4, utc("2026-03-01T12:00:00Z"))).toBe(3);
  });

  it("is 0 once the target is hit or the sprint is over", () => {
    expect(dailyAverageNeeded(sprint({ target: 10 }), 12, utc("2026-03-01T12:00:00Z"))).toBe(0);
    expect(dailyAverageNeeded(sprint({ target: 10 }), 0, AFTER)).toBe(0);
  });
});

describe("remainingSprintDates", () => {
  it("lists today through the last day before end", () => {
    expect(remainingSprintDates(sprint(), utc("2026-03-01T12:00:00Z"))).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
  });

  it("starts at the start day for an upcoming sprint, and is empty once ended", () => {
    const s = sprint({ startAt: "2026-03-02T09:00:00Z" });
    expect(remainingSprintDates(s, utc("2026-02-20T00:00:00Z"))).toEqual([
      "2026-03-02",
      "2026-03-03",
    ]);
    expect(remainingSprintDates(s, AFTER)).toEqual([]);
  });
});

describe("doubleCountedHabitIds", () => {
  it("flags both ends of any ancestor/descendant pair with points", () => {
    const habits = [
      habit("a", { pointsKind: "per_log", pointsValue: 1 }),
      habit("b", { parentId: "a" }),
      habit("c", { parentId: "b", pointsKind: "clean_day", pointsValue: 1 }),
      habit("d", { pointsKind: "per_log", pointsValue: 1 }),
    ];
    expect([...doubleCountedHabitIds(habits)].sort()).toEqual(["a", "c"]);
  });

  it("ignores archived habits", () => {
    const habits = [
      habit("a", { pointsKind: "per_log", pointsValue: 1 }),
      habit("b", { parentId: "a", pointsKind: "per_log", pointsValue: 1, archivedAt: "x" }),
    ];
    expect(doubleCountedHabitIds(habits).size).toBe(0);
  });
});

describe("matchesPointsFilter", () => {
  const withPoints = habit("a", { pointsKind: "per_log", pointsValue: 1 });
  const without = habit("b");

  it("matches on the habit's own points only", () => {
    expect(matchesPointsFilter(withPoints, "points")).toBe(true);
    expect(matchesPointsFilter(without, "points")).toBe(false);
    expect(matchesPointsFilter(without, "no_points")).toBe(true);
    expect(matchesPointsFilter(withPoints, "no_points")).toBe(false);
  });

  it("all matches everything", () => {
    expect(matchesPointsFilter(withPoints, "all")).toBe(true);
    expect(matchesPointsFilter(without, "all")).toBe(true);
  });
});

describe("suggestDailyPlan", () => {
  it("is empty with no habits worth points", () => {
    expect(suggestDailyPlan([habit("a")], 5, seeded(1))).toEqual({ items: [], total: 0 });
  });

  it("reaches at least the target, and items add up to the total", () => {
    const habits = [
      habit("run", { pointsKind: "per_log", pointsValue: 3 }),
      habit("read", { pointsKind: "per_log", pointsValue: 2 }),
      habit("smoking", { pointsKind: "clean_day", pointsValue: 4 }),
    ];
    for (let seed = 0; seed < 50; seed++) {
      const plan = suggestDailyPlan(habits, 11, seeded(seed));
      expect(plan.total).toBeGreaterThanOrEqual(11);
      expect(plan.items.reduce((sum, i) => sum + i.points, 0)).toBe(plan.total);
      const skip = plan.items.find((i) => i.habitId === "smoking");
      if (skip) expect(skip.count).toBe(1);
    }
  });

  it("values a log as its own plus its per_log ancestors' points", () => {
    const habits = [
      habit("exercise", { pointsKind: "per_log", pointsValue: 2, allowDirectLogging: false }),
      habit("run", { parentId: "exercise", pointsKind: "per_log", pointsValue: 1 }),
    ];
    const plan = suggestDailyPlan(habits, 3, seeded(1));
    expect(plan.items).toEqual([{ habitId: "run", kind: "per_log", count: 1, points: 3 }]);
  });

  it("never pairs a skip with a log of the same habit's subtree", () => {
    const habits = [
      habit("drinking", { pointsKind: "clean_day", pointsValue: 2 }),
      habit("beer", { parentId: "drinking", pointsKind: "per_log", pointsValue: 1 }),
      habit("run", { pointsKind: "per_log", pointsValue: 1 }),
    ];
    for (let seed = 0; seed < 50; seed++) {
      const ids = suggestDailyPlan(habits, 4, seeded(seed)).items.map((i) => i.habitId);
      expect(ids.includes("drinking") && ids.includes("beer")).toBe(false);
    }
  });

  it("skips archived habits and stops when only used-up skips remain", () => {
    const habits = [
      habit("smoking", { pointsKind: "clean_day", pointsValue: 2 }),
      habit("old", { pointsKind: "per_log", pointsValue: 1, archivedAt: "x" }),
    ];
    expect(suggestDailyPlan(habits, 10, seeded(1))).toEqual({
      items: [{ habitId: "smoking", kind: "clean_day", count: 1, points: 2 }],
      total: 2,
    });
  });
});
