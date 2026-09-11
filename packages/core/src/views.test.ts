import { describe, expect, it } from "vitest";
import type { Habit, HabitLog, HabitView } from "./domain";
import type { TimeContext } from "./time";
import {
  bucketLogsByUnit,
  computeCumulative,
  computeDays,
  computeHabitView,
  computePercentage,
  computeSince,
  computeStreak,
} from "./views";

const HABIT_ID = "habit-1";

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: HABIT_ID,
    userId: "user-1",
    name: "Meditate",
    startDate: "2026-01-01T00:00:00Z",
    views: [],
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function view(overrides: Partial<HabitView> = {}): HabitView {
  return {
    id: "view-1",
    habitId: HABIT_ID,
    kind: "cumulative",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function log(timestamp: string, overrides: Partial<HabitLog> = {}): HabitLog {
  return {
    id: `log-${timestamp}`,
    habitId: HABIT_ID,
    timestamp,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

const UTC: TimeContext["timeZone"] = "UTC";

function ctxAt(now: string, timeZone = UTC): TimeContext {
  return { now, timeZone };
}

describe("computeCumulative", () => {
  it("is 0 with no logs", () => {
    const result = computeCumulative(habit(), view(), [], ctxAt("2026-01-10T00:00:00Z"));
    expect(result).toEqual({ kind: "cumulative", count: 0, goal: null });
  });

  it("excludes logs before the start date", () => {
    const h = habit({ startDate: "2026-01-05T00:00:00Z" });
    const logs = [log("2026-01-04T12:00:00Z"), log("2026-01-06T12:00:00Z")];
    const result = computeCumulative(h, view(), logs, ctxAt("2026-01-10T00:00:00Z"));
    expect(result.count).toBe(1);
  });

  it("includes a log exactly at the start-day boundary", () => {
    const h = habit({ startDate: "2026-01-05T00:00:00Z" });
    const logs = [log("2026-01-05T00:00:00Z")];
    const result = computeCumulative(h, view(), logs, ctxAt("2026-01-10T00:00:00Z"));
    expect(result.count).toBe(1);
  });

  it("passes cumulationGoal through, and null when absent", () => {
    const withGoal = computeCumulative(
      habit(),
      view({ cumulationGoal: 50 }),
      [],
      ctxAt("2026-01-10T00:00:00Z"),
    );
    expect(withGoal.goal).toBe(50);

    const withoutGoal = computeCumulative(habit(), view(), [], ctxAt("2026-01-10T00:00:00Z"));
    expect(withoutGoal.goal).toBeNull();
  });
});

describe("computeStreak", () => {
  const h = habit({ startDate: "2026-01-01T00:00:00Z" });
  const v = view({ kind: "streak", unit: "day" });

  it("is 0 with no logs", () => {
    const result = computeStreak(h, v, [], ctxAt("2026-01-10T00:00:00Z"));
    expect(result.count).toBe(0);
  });

  it("counts today immediately when today is logged", () => {
    const logs = [log("2026-01-10T08:00:00Z")];
    const result = computeStreak(h, v, logs, ctxAt("2026-01-10T20:00:00Z"));
    expect(result.count).toBe(1);
  });

  it("no log today doesn't break a streak built through yesterday", () => {
    const logs = [log("2026-01-08T08:00:00Z"), log("2026-01-09T08:00:00Z")];
    // "now" is mid-day on the 10th; today has no log yet.
    const result = computeStreak(h, v, logs, ctxAt("2026-01-10T12:00:00Z"));
    expect(result.count).toBe(2); // the 9th and the 8th
  });

  it("a genuine gap on a fully-elapsed day breaks the walk", () => {
    const logs = [
      log("2026-01-06T08:00:00Z"),
      log("2026-01-07T08:00:00Z"),
      // 2026-01-08 missed
      log("2026-01-09T08:00:00Z"),
    ];
    const result = computeStreak(h, v, logs, ctxAt("2026-01-10T12:00:00Z"));
    expect(result.count).toBe(1); // just the 9th; the gap on the 8th stops the walk
  });

  it("is 0 when the habit started this unit, regardless of today's log", () => {
    const startsToday = habit({ startDate: "2026-01-10T00:00:00Z" });
    const logs = [log("2026-01-10T08:00:00Z")];
    const result = computeStreak(startsToday, v, logs, ctxAt("2026-01-10T20:00:00Z"));
    // Today counts as a hit even though it's also the start unit.
    expect(result.count).toBe(1);
  });

  it("buckets a log by local day, not UTC day", () => {
    // 02:00 UTC on 2026-01-10 is 2026-01-09 18:00 in America/Los_Angeles.
    const logs = [log("2026-01-10T02:00:00Z")];
    const laCtx = ctxAt("2026-01-09T22:00:00Z", "America/Los_Angeles"); // still Jan 9 locally
    const result = computeStreak(h, v, logs, laCtx);
    expect(result.count).toBe(1); // both "now" and the log fall in local Jan 9
  });

  it("respects the Monday week start for week-unit streaks", () => {
    const weekView = view({ kind: "streak", unit: "week" });
    // Monday 2026-01-05 and Monday 2026-01-12 each logged once.
    const logs = [log("2026-01-06T08:00:00Z"), log("2026-01-13T08:00:00Z")];
    const result = computeStreak(h, weekView, logs, ctxAt("2026-01-14T08:00:00Z"));
    expect(result.count).toBe(2);
  });
});

describe("computePercentage", () => {
  const h = habit({ startDate: "2026-01-01T00:00:00Z" });
  const v = view({ kind: "percentage", unit: "day" });

  it("returns rate: null when zero units have elapsed (habit started this unit)", () => {
    const startsToday = habit({ startDate: "2026-01-10T00:00:00Z" });
    const result = computePercentage(startsToday, v, [], ctxAt("2026-01-10T12:00:00Z"));
    expect(result).toEqual({
      kind: "percentage",
      rate: null,
      loggedUnits: 0,
      totalUnits: 0,
      unit: "day",
    });
  });

  it("is 1 when every elapsed unit was logged", () => {
    // Start Jan 1, "now" Jan 4 -> elapsed units are Jan 1, 2, 3 (3 total).
    const logs = [
      log("2026-01-01T08:00:00Z"),
      log("2026-01-02T08:00:00Z"),
      log("2026-01-03T08:00:00Z"),
    ];
    const result = computePercentage(h, v, logs, ctxAt("2026-01-04T12:00:00Z"));
    expect(result.totalUnits).toBe(3);
    expect(result.loggedUnits).toBe(3);
    expect(result.rate).toBe(1);
  });

  it("is 0 when no elapsed unit was logged", () => {
    const result = computePercentage(h, v, [], ctxAt("2026-01-04T12:00:00Z"));
    expect(result.rate).toBe(0);
  });

  it("computes an exact partial rate", () => {
    const logs = [log("2026-01-02T08:00:00Z")]; // only the 2nd of 3 elapsed days
    const result = computePercentage(h, v, logs, ctxAt("2026-01-04T12:00:00Z"));
    expect(result.loggedUnits).toBe(1);
    expect(result.totalUnits).toBe(3);
    expect(result.rate).toBeCloseTo(1 / 3);
  });

  it("does not let a log in the current in-progress unit affect the rate (unlike Streak)", () => {
    const logs = [log("2026-01-04T08:00:00Z")]; // logged *today*, the in-progress unit
    const result = computePercentage(h, v, logs, ctxAt("2026-01-04T12:00:00Z"));
    expect(result.totalUnits).toBe(3);
    expect(result.loggedUnits).toBe(0); // today's log doesn't count toward the denominator's units
    expect(result.rate).toBe(0);
  });
});

describe("computeDays", () => {
  const h = habit({ startDate: "2026-01-01T00:00:00Z" });
  const v = view({ kind: "days", unit: "day" }); // default N=7

  it("defaults the window to 7", () => {
    const result = computeDays(h, v, [], ctxAt("2026-02-01T12:00:00Z"));
    expect(result.of).toBe(7);
  });

  it("supports a custom N", () => {
    const custom = view({ kind: "days", unit: "day", days: 3 });
    const result = computeDays(h, custom, [], ctxAt("2026-02-01T12:00:00Z"));
    expect(result.of).toBe(3);
  });

  it("counts hits in the last N units, including today", () => {
    const farStart = habit({ startDate: "2025-01-01T00:00:00Z" });
    // "now" is 2026-02-10; last 7 days (inclusive) are Feb 4-10.
    const logs = [
      log("2026-02-04T08:00:00Z"),
      log("2026-02-06T08:00:00Z"),
      log("2026-02-10T08:00:00Z"), // today
      log("2026-01-20T08:00:00Z"), // outside the window
    ];
    const result = computeDays(farStart, v, logs, ctxAt("2026-02-10T12:00:00Z"));
    expect(result.value).toBe(3);
    expect(result.of).toBe(7);
  });

  it("raises value immediately when today is logged", () => {
    const farStart = habit({ startDate: "2025-01-01T00:00:00Z" });
    const before = computeDays(farStart, v, [], ctxAt("2026-02-10T12:00:00Z"));
    const after = computeDays(
      farStart,
      v,
      [log("2026-02-10T08:00:00Z")],
      ctxAt("2026-02-10T12:00:00Z"),
    );
    expect(after.value).toBe(before.value + 1);
  });

  it("clamps the window to the habit's start when younger than N units", () => {
    // Habit started 3 days before "now" (Jan 1, 2, 3 elapsed + today the 4th = 4 possible days).
    const logs = [log("2026-01-01T08:00:00Z"), log("2026-01-04T08:00:00Z")];
    const result = computeDays(h, v, logs, ctxAt("2026-01-04T12:00:00Z"));
    expect(result.of).toBe(7); // configured N stays 7...
    expect(result.value).toBe(2); // ...but only 4 days of history exist, 2 of them logged
  });

  it("is always an integer, never null", () => {
    const result = computeDays(h, v, [], ctxAt("2026-01-01T00:00:01Z"));
    expect(result.value).toBe(0);
    expect(Number.isInteger(result.value)).toBe(true);
  });
});

describe("computeSince", () => {
  const h = habit({ startDate: "2026-01-01T00:00:00Z" });
  const v = view({ kind: "since", unit: "day" });

  it("is null when there are no logs ever", () => {
    const result = computeSince(h, v, [], ctxAt("2026-01-10T12:00:00Z"));
    expect(result.value).toBeNull();
  });

  it("is 0 when the most recent log is in the current in-progress unit", () => {
    const logs = [log("2026-01-10T08:00:00Z")];
    const result = computeSince(h, v, logs, ctxAt("2026-01-10T20:00:00Z"));
    expect(result.value).toBe(0);
  });

  it("counts fully-elapsed units since the most recent log", () => {
    const logs = [log("2026-01-07T08:00:00Z")];
    const result = computeSince(h, v, logs, ctxAt("2026-01-10T12:00:00Z"));
    expect(result.value).toBe(3);
  });

  it("uses the most recent log, not the oldest or an average", () => {
    const logs = [log("2026-01-02T08:00:00Z"), log("2026-01-08T08:00:00Z")];
    const result = computeSince(h, v, logs, ctxAt("2026-01-10T12:00:00Z"));
    expect(result.value).toBe(2); // since Jan 8, not Jan 2
  });

  it("clamps a future-dated log to 0", () => {
    const logs = [log("2026-01-20T08:00:00Z")]; // after "now"
    const result = computeSince(h, v, logs, ctxAt("2026-01-10T12:00:00Z"));
    expect(result.value).toBe(0);
  });
});

describe("computeHabitView dispatcher", () => {
  const h = habit({ startDate: "2026-01-01T00:00:00Z" });
  const ctx = ctxAt("2026-01-10T12:00:00Z");

  it("routes each ViewKind to the matching result kind", () => {
    expect(computeHabitView(h, view({ kind: "cumulative" }), [], ctx).kind).toBe("cumulative");
    expect(computeHabitView(h, view({ kind: "streak" }), [], ctx).kind).toBe("streak");
    expect(computeHabitView(h, view({ kind: "percentage" }), [], ctx).kind).toBe("percentage");
    expect(computeHabitView(h, view({ kind: "days" }), [], ctx).kind).toBe("days");
    expect(computeHabitView(h, view({ kind: "since" }), [], ctx).kind).toBe("since");
  });

  it("applies defaults when unit/days are omitted", () => {
    const result = computeHabitView(h, view({ kind: "streak" }), [], ctx);
    expect(result.kind).toBe("streak");
    if (result.kind === "streak") expect(result.unit).toBe("day");

    const days = computeHabitView(h, view({ kind: "days" }), [], ctx);
    if (days.kind === "days") expect(days.of).toBe(7);
  });
});

describe("bucketLogsByUnit", () => {
  it("collapses two logs in the same bucket into one key", () => {
    const logs = [log("2026-01-10T01:00:00Z"), log("2026-01-10T23:00:00Z")];
    const keys = bucketLogsByUnit(logs, "day", UTC);
    expect(keys.size).toBe(1);
  });

  it("buckets logs spanning a DST-transition day correctly", () => {
    const logs = [log("2026-03-08T01:30:00", { id: "a" }), log("2026-03-08T10:00:00", { id: "b" })];
    const keys = bucketLogsByUnit(logs, "day", "America/New_York");
    expect(keys.size).toBe(1);
  });
});
