import { describe, expect, it } from "vitest";
import type { ViewResult } from "@tracker/core";
import { formatViewValue, highlightValueForView, unitLabel, viewLabel } from "./view-format";

describe("viewLabel", () => {
  it("labels every view kind", () => {
    expect(viewLabel("cumulative")).toBe("Cumulative");
    expect(viewLabel("streak")).toBe("Streak");
    expect(viewLabel("percentage")).toBe("Percentage");
    expect(viewLabel("days")).toBe("Days");
    expect(viewLabel("since")).toBe("Since");
  });
});

describe("unitLabel", () => {
  it("singularizes for a count of 1, pluralizes otherwise", () => {
    expect(unitLabel("day", 1)).toBe("day");
    expect(unitLabel("day", 0)).toBe("days");
    expect(unitLabel("day", 2)).toBe("days");
    expect(unitLabel("week", 1)).toBe("week");
  });
});

describe("formatViewValue", () => {
  it("cumulative: plain count, or count / goal", () => {
    expect(formatViewValue({ kind: "cumulative", count: 5, goal: null })).toBe("5");
    expect(formatViewValue({ kind: "cumulative", count: 5, goal: 10 })).toBe("5 / 10");
  });

  it("streak: count + pluralized unit", () => {
    expect(formatViewValue({ kind: "streak", count: 1, unit: "day" })).toBe("1 day");
    expect(formatViewValue({ kind: "streak", count: 5, unit: "day" })).toBe("5 days");
  });

  it("percentage: rounded percent, or em dash for no data", () => {
    expect(
      formatViewValue({
        kind: "percentage",
        rate: 0.755,
        loggedUnits: 3,
        totalUnits: 4,
        unit: "day",
      }),
    ).toBe("76%");
    expect(
      formatViewValue({
        kind: "percentage",
        rate: null,
        loggedUnits: 0,
        totalUnits: 0,
        unit: "day",
      }),
    ).toBe("—");
  });

  it('days: "X out of N"', () => {
    expect(formatViewValue({ kind: "days", value: 5, of: 7, unit: "day" })).toBe("5 out of 7");
  });

  it("since: unit-ago phrase, or a no-data message", () => {
    expect(formatViewValue({ kind: "since", value: 2, unit: "day" })).toBe("2 days ago");
    expect(formatViewValue({ kind: "since", value: null, unit: "day" })).toBe("Never logged");
  });
});

describe("highlightValueForView", () => {
  it("percentage: rate scaled to percentage points, or null", () => {
    const result: ViewResult = {
      kind: "percentage",
      rate: 0.8,
      loggedUnits: 4,
      totalUnits: 5,
      unit: "day",
    };
    expect(highlightValueForView(result)).toBe(80);
    expect(
      highlightValueForView({
        kind: "percentage",
        rate: null,
        loggedUnits: 0,
        totalUnits: 0,
        unit: "day",
      }),
    ).toBeNull();
  });

  it("days: the raw value, same scale as target", () => {
    expect(highlightValueForView({ kind: "days", value: 5, of: 7, unit: "day" })).toBe(5);
  });

  it("cumulative/streak/since: no target concept, always null", () => {
    expect(highlightValueForView({ kind: "cumulative", count: 5, goal: null })).toBeNull();
    expect(highlightValueForView({ kind: "streak", count: 5, unit: "day" })).toBeNull();
    expect(highlightValueForView({ kind: "since", value: 5, unit: "day" })).toBeNull();
  });
});
