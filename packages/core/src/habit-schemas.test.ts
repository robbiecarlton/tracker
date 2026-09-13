import { describe, expect, it } from "vitest";
import {
  createHabitSchema,
  createLogSchema,
  habitFormSchema,
  habitViewInputSchema,
  updateLogSchema,
} from "./habit-schemas";

describe("habitViewInputSchema", () => {
  it("accepts a minimal valid view", () => {
    expect(habitViewInputSchema.safeParse({ kind: "cumulative" }).success).toBe(true);
  });

  it("requires target and targetType together", () => {
    expect(habitViewInputSchema.safeParse({ kind: "percentage", target: 80 }).success).toBe(false);
    expect(
      habitViewInputSchema.safeParse({ kind: "percentage", targetType: "at_least" }).success,
    ).toBe(false);
    expect(
      habitViewInputSchema.safeParse({ kind: "percentage", target: 80, targetType: "at_least" })
        .success,
    ).toBe(true);
  });

  it("rejects a target on a view kind that doesn't support one", () => {
    const result = habitViewInputSchema.safeParse({
      kind: "streak",
      target: 5,
      targetType: "at_least",
    });
    expect(result.success).toBe(false);
  });

  it("rejects days on a non-days view", () => {
    expect(habitViewInputSchema.safeParse({ kind: "streak", days: 7 }).success).toBe(false);
    expect(habitViewInputSchema.safeParse({ kind: "days", days: 7 }).success).toBe(true);
  });

  it("rejects cumulationGoal on a non-cumulative view", () => {
    expect(habitViewInputSchema.safeParse({ kind: "streak", cumulationGoal: 10 }).success).toBe(
      false,
    );
    expect(habitViewInputSchema.safeParse({ kind: "cumulative", cumulationGoal: 10 }).success).toBe(
      true,
    );
  });

  it("accepts day/week/month as a heatmap unit, but rejects hour", () => {
    expect(habitViewInputSchema.safeParse({ kind: "heatmap", unit: "day" }).success).toBe(true);
    expect(habitViewInputSchema.safeParse({ kind: "heatmap", unit: "week" }).success).toBe(true);
    expect(habitViewInputSchema.safeParse({ kind: "heatmap", unit: "month" }).success).toBe(true);
    expect(habitViewInputSchema.safeParse({ kind: "heatmap" }).success).toBe(true); // defaults later
    expect(habitViewInputSchema.safeParse({ kind: "heatmap", unit: "hour" }).success).toBe(false);
  });

  it("rejects target/days/cumulationGoal on a heatmap view (none apply)", () => {
    expect(
      habitViewInputSchema.safeParse({ kind: "heatmap", target: 5, targetType: "at_least" })
        .success,
    ).toBe(false);
    expect(habitViewInputSchema.safeParse({ kind: "heatmap", days: 7 }).success).toBe(false);
    expect(habitViewInputSchema.safeParse({ kind: "heatmap", cumulationGoal: 10 }).success).toBe(
      false,
    );
  });
});

describe("habitFormSchema", () => {
  it("accepts a valid habit with one view", () => {
    const result = habitFormSchema.safeParse({
      name: "Meditate",
      startDate: "2026-01-01",
      views: [{ kind: "cumulative" }],
      parentId: null,
      allowDirectLogging: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(
      habitFormSchema.safeParse({
        name: "",
        startDate: "2026-01-01",
        views: [{ kind: "cumulative" }],
        parentId: null,
        allowDirectLogging: true,
      }).success,
    ).toBe(false);
  });

  it("rejects an unparsable start date", () => {
    expect(
      habitFormSchema.safeParse({
        name: "Meditate",
        startDate: "not-a-date",
        views: [{ kind: "cumulative" }],
        parentId: null,
        allowDirectLogging: true,
      }).success,
    ).toBe(false);
  });

  it("rejects non-YYYY-MM-DD datetime strings, even ones native Date.parse accepts", () => {
    // Regression test: this exact SQL-style string previously passed the old
    // Date.parse-based check, then crashed much later in Luxon's stricter
    // ISO 8601 parser inside computeHabitView.
    const result = habitFormSchema.safeParse({
      name: "Meditate",
      startDate: "2026-08-11 00:00:00-07",
      views: [{ kind: "cumulative" }],
      parentId: null,
      allowDirectLogging: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a syntactically YYYY-MM-DD string that isn't a real calendar date", () => {
    const result = habitFormSchema.safeParse({
      name: "Meditate",
      startDate: "2026-13-45",
      views: [{ kind: "cumulative" }],
      parentId: null,
      allowDirectLogging: true,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a plain YYYY-MM-DD date", () => {
    const result = habitFormSchema.safeParse({
      name: "Meditate",
      startDate: "2026-01-01",
      views: [{ kind: "cumulative" }],
      parentId: null,
      allowDirectLogging: true,
    });
    expect(result.success).toBe(true);
  });

  it("requires at least one view", () => {
    expect(
      habitFormSchema.safeParse({
        name: "Meditate",
        startDate: "2026-01-01",
        views: [],
        parentId: null,
        allowDirectLogging: true,
      }).success,
    ).toBe(false);
  });

  it("requires parentId and allowDirectLogging (full-replace-on-edit, like every other field)", () => {
    expect(
      habitFormSchema.safeParse({
        name: "Meditate",
        startDate: "2026-01-01",
        views: [{ kind: "cumulative" }],
      }).success,
    ).toBe(false);
  });
});

describe("createHabitSchema", () => {
  it("allows omitting views entirely", () => {
    const result = createHabitSchema.safeParse({ name: "Meditate", startDate: "2026-01-01" });
    expect(result.success).toBe(true);
  });

  it("allows an empty views array", () => {
    const result = createHabitSchema.safeParse({
      name: "Meditate",
      startDate: "2026-01-01",
      views: [],
    });
    expect(result.success).toBe(true);
  });

  it("still validates individual views when provided", () => {
    const result = createHabitSchema.safeParse({
      name: "Meditate",
      startDate: "2026-01-01",
      views: [{ kind: "percentage", target: 80 }], // missing targetType
    });
    expect(result.success).toBe(false);
  });
});

describe("createLogSchema", () => {
  it("accepts an empty body (simple log)", () => {
    expect(createLogSchema.safeParse({}).success).toBe(true);
  });

  it("accepts notes and an explicit timestamp", () => {
    const result = createLogSchema.safeParse({
      timestamp: "2026-01-01T12:00:00Z",
      notes: "felt great",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null notes", () => {
    expect(createLogSchema.safeParse({ notes: null }).success).toBe(true);
  });

  it("rejects a non-ISO timestamp, even one native Date.parse accepts", () => {
    // Same regression class as habitFormSchema.startDate: this SQL-style
    // string passes lenient Date.parse but Luxon's stricter ISO 8601 parser
    // (used downstream in parseInZone) rejects it.
    const result = createLogSchema.safeParse({ timestamp: "2026-08-11 00:00:00-07" });
    expect(result.success).toBe(false);
  });
});

describe("updateLogSchema", () => {
  it("requires a valid timestamp — no 'now' fallback", () => {
    expect(updateLogSchema.safeParse({ notes: null }).success).toBe(false);
    expect(
      updateLogSchema.safeParse({ timestamp: "2026-01-01T12:00:00Z", notes: null }).success,
    ).toBe(true);
  });

  it("rejects an invalid timestamp", () => {
    expect(updateLogSchema.safeParse({ timestamp: "not-a-date", notes: null }).success).toBe(false);
  });

  it("requires notes to be explicitly present (null or a string), not omitted", () => {
    expect(updateLogSchema.safeParse({ timestamp: "2026-01-01T12:00:00Z" }).success).toBe(false);
    expect(
      updateLogSchema.safeParse({ timestamp: "2026-01-01T12:00:00Z", notes: "felt great" }).success,
    ).toBe(true);
  });
});
