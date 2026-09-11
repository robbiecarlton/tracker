import { describe, expect, it } from "vitest";
import type { HabitView } from "./domain";
import { evaluateTarget } from "./targets";
import { computeHighlight, ratioToColor } from "./highlight";

describe("ratioToColor", () => {
  it("hits the exact stop colors at 0, 0.5, 1", () => {
    expect(ratioToColor(0)).toBe("#dc2626");
    expect(ratioToColor(0.5)).toBe("#f59e0b");
    expect(ratioToColor(1)).toBe("#16a34a");
  });

  it("interpolates midpoints between stops", () => {
    expect(ratioToColor(0.25)).toBe("#e96219");
    expect(ratioToColor(0.75)).toBe("#86a12b");
  });

  it("clamps out-of-range input rather than extrapolating", () => {
    expect(ratioToColor(-1)).toBe(ratioToColor(0));
    expect(ratioToColor(2)).toBe(ratioToColor(1));
  });
});

const baseView = {
  id: "view-1",
  habitId: "habit-1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
} as const;

describe("computeHighlight", () => {
  const withTarget: HabitView = {
    ...baseView,
    kind: "percentage",
    target: 80,
    targetType: "at_least",
  };
  const withoutTarget: HabitView = { ...baseView, kind: "percentage" };

  it("is null when the view has no target configured", () => {
    expect(computeHighlight(withoutTarget, 50)).toBeNull();
  });

  it("is null when value is null, even with a target configured", () => {
    expect(computeHighlight(withTarget, null)).toBeNull();
  });

  it("matches the equivalent direct evaluateTarget + ratioToColor call", () => {
    const value = 60;
    const expected = ratioToColor(evaluateTarget(value, 80, "at_least").ratio);
    expect(computeHighlight(withTarget, value)).toBe(expected);
  });
});
