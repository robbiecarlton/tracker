import { describe, expect, it } from "vitest";
import {
  formatDailyAverage,
  pointsChipLabel,
  pointsEditWarning,
  sprintLabel,
  suggestionDayLabel,
  suggestionLabel,
  suggestionRollupLabel,
} from "./points-format";

const ctx = { now: "2026-03-05T12:00:00Z", timeZone: "UTC" };
const active = { startAt: "2026-03-01T00:00:00Z", endAt: "2026-03-10T00:00:00Z" };
const ended = { startAt: "2026-02-01T00:00:00Z", endAt: "2026-02-10T00:00:00Z" };

describe("pointsChipLabel", () => {
  it("describes each kind", () => {
    expect(pointsChipLabel("per_log", 3)).toBe("+3 per log");
    expect(pointsChipLabel("clean_day", 5)).toBe("+5 per clean day");
  });
});

describe("formatDailyAverage", () => {
  it("rounds to one decimal and drops a trailing .0", () => {
    expect(formatDailyAverage(3)).toBe("3");
    expect(formatDailyAverage(10 / 3)).toBe("3.3");
    expect(formatDailyAverage(2.25)).toBe("2.3");
  });
});

describe("sprintLabel", () => {
  it("prefers the name, else the date range", () => {
    expect(sprintLabel({ name: "March", ...active }, "UTC")).toBe("March");
    expect(sprintLabel({ name: null, ...active }, "UTC")).toBe("Mar 1 – Mar 10");
  });
});

describe("suggestionLabel / suggestionDayLabel", () => {
  it("labels logs, repeats, and skips", () => {
    const base = { habitId: "h", points: 1, alsoEarns: [] };
    expect(suggestionLabel({ ...base, kind: "per_log", count: 1 }, "Run")).toBe("Run");
    expect(suggestionLabel({ ...base, kind: "per_log", count: 2 }, "Run")).toBe("Run ×2");
    expect(suggestionLabel({ ...base, kind: "clean_day", count: 1 }, "Smoking")).toBe(
      "Skip Smoking",
    );
  });

  it("names the parents a log also counts for", () => {
    const names: Record<string, string> = { health: "Health", exercise: "Exercise" };
    const item = {
      habitId: "run",
      kind: "per_log" as const,
      count: 2,
      points: 10,
      alsoEarns: [
        { habitId: "health", points: 2 },
        { habitId: "exercise", points: 4 },
      ],
    };
    expect(suggestionRollupLabel(item, (id) => names[id]!)).toBe(
      "Also logs Health (+2), Exercise (+4)",
    );
    expect(suggestionRollupLabel({ ...item, alsoEarns: [] }, (id) => id)).toBeNull();
  });

  it("calls today 'Today'", () => {
    expect(suggestionDayLabel("2026-03-05", ctx)).toBe("Today");
    expect(suggestionDayLabel("2026-03-06", ctx)).toBe("Fri, Mar 6");
  });
});

describe("pointsEditWarning", () => {
  const none = { pointsKind: null, pointsValue: null };
  const three = { pointsKind: "per_log" as const, pointsValue: 3 };

  it("is null when points didn't change", () => {
    expect(pointsEditWarning(three, three, [active], ctx)).toBeNull();
    expect(pointsEditWarning(none, {}, [active], ctx)).toBeNull();
  });

  it("is null with no active sprints", () => {
    expect(pointsEditWarning(none, three, [ended], ctx)).toBeNull();
  });

  it("counts only active sprints", () => {
    expect(pointsEditWarning(none, three, [active, ended, active], ctx)).toBe(
      "There are active sprints, are you sure you want to change this total? (2 sprints affected)",
    );
    expect(pointsEditWarning(three, none, [active], ctx)).toMatch(/\(1 sprint affected\)$/);
  });
});
