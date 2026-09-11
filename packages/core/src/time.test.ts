import { DateTime, Settings } from "luxon";
import { describe, expect, it } from "vitest";
import {
  addUnits,
  endOfUnit,
  isSameUnit,
  nowInZone,
  parseInZone,
  startOfUnit,
  unitKey,
  unitsElapsedBetween,
} from "./time";

describe("parseInZone / nowInZone", () => {
  it("parses a valid ISO datetime into the given zone", () => {
    const dt = parseInZone("2026-01-15T12:00:00Z", "America/New_York");
    expect(dt.isValid).toBe(true);
    expect(dt.zoneName).toBe("America/New_York");
  });

  it("throws a descriptive error for an unparsable datetime string", () => {
    expect(() => parseInZone("not-a-date", "UTC")).toThrow(/Invalid datetime/);
  });

  it("throws a descriptive error for an invalid IANA zone", () => {
    expect(() => parseInZone("2026-01-15T12:00:00Z", "Not/AZone")).toThrow(/Invalid datetime/);
  });

  it("nowInZone is equivalent to parseInZone(ctx.now, ctx.timeZone)", () => {
    const ctx = { now: "2026-06-01T00:00:00Z", timeZone: "UTC" };
    expect(nowInZone(ctx).toISO()).toBe(parseInZone(ctx.now, ctx.timeZone).toISO());
  });
});

describe("startOfUnit / endOfUnit", () => {
  const zones = ["UTC", "America/New_York"];

  for (const zone of zones) {
    it(`hour boundaries in ${zone}`, () => {
      const dt = parseInZone("2026-06-15T14:37:22.123", zone);
      const start = startOfUnit(dt, "hour");
      expect(start.minute).toBe(0);
      expect(start.second).toBe(0);
      expect(start.millisecond).toBe(0);
      expect(endOfUnit(dt, "hour").toMillis()).toBe(start.plus({ hours: 1 }).toMillis());
    });

    it(`day boundaries in ${zone}`, () => {
      const dt = parseInZone("2026-06-15T14:37:22.123", zone);
      const start = startOfUnit(dt, "day");
      expect(start.hour).toBe(0);
      expect(start.minute).toBe(0);
      expect(start.day).toBe(15);
      expect(endOfUnit(dt, "day").day).toBe(16);
    });

    it(`month boundaries in ${zone}`, () => {
      const dt = parseInZone("2026-06-15T14:37:22.123", zone);
      const start = startOfUnit(dt, "month");
      expect(start.day).toBe(1);
      expect(start.hour).toBe(0);
      const end = endOfUnit(dt, "month");
      expect(end.month).toBe(7);
      expect(end.day).toBe(1);
    });
  }

  it("week always starts on Monday, regardless of locale", () => {
    // 2026-06-17 is a Wednesday.
    const wed = parseInZone("2026-06-17T10:00:00", "UTC");
    const start = startOfUnit(wed, "week");
    expect(start.weekday).toBe(1); // Luxon: 1 = Monday
    expect(start.day).toBe(15); // Monday 2026-06-15

    // A Sunday should roll back to the *previous* Monday (ISO week), not forward.
    const sun = parseInZone("2026-06-21T10:00:00", "UTC");
    expect(startOfUnit(sun, "week").day).toBe(15);

    // Guard against locale changing week-start semantics.
    const withLocale = wed.setLocale("ar-SA");
    expect(startOfUnit(withLocale, "week").weekday).toBe(1);
  });

  it("addUnits across a month-length change lands on a valid date", () => {
    const jan31Start = startOfUnit(parseInZone("2026-01-31T00:00:00", "UTC"), "day");
    const plusOneMonth = addUnits(jan31Start, "month", 1);
    // Adding a calendar month to the *start of month* (Jan 1) would be Feb 1;
    // here we're adding to Jan 31 directly to confirm no invalid date results.
    expect(plusOneMonth.isValid).toBe(true);
    expect(plusOneMonth.month === 2 || plusOneMonth.month === 3).toBe(true);
  });

  it("addUnits accepts negative counts", () => {
    const dt = startOfUnit(parseInZone("2026-06-15T00:00:00", "UTC"), "day");
    expect(addUnits(dt, "day", -1).day).toBe(14);
  });
});

describe("DST transitions (America/New_York)", () => {
  it("spring-forward day (2026-03-08, 23-hour day) stays calendar-exact for day units", () => {
    const before = startOfUnit(parseInZone("2026-03-07T00:00:00", "America/New_York"), "day");
    const after = startOfUnit(parseInZone("2026-03-09T00:00:00", "America/New_York"), "day");
    expect(unitsElapsedBetween(before, after, "day")).toBe(2);
  });

  it("spring-forward: hour-unit boundaries don't throw across the missing local hour", () => {
    const dt = parseInZone("2026-03-08T01:30:00", "America/New_York");
    expect(() => startOfUnit(dt, "hour")).not.toThrow();
    expect(() => endOfUnit(dt, "hour")).not.toThrow();
  });

  it("fall-back day (2026-11-01, 25-hour day) stays calendar-exact for day units", () => {
    const before = startOfUnit(parseInZone("2026-10-31T00:00:00", "America/New_York"), "day");
    const after = startOfUnit(parseInZone("2026-11-02T00:00:00", "America/New_York"), "day");
    expect(unitsElapsedBetween(before, after, "day")).toBe(2);
  });

  it("fall-back: hour-unit boundaries don't throw across the duplicated local hour", () => {
    const dt = parseInZone("2026-11-01T01:30:00", "America/New_York");
    expect(() => startOfUnit(dt, "hour")).not.toThrow();
    expect(() => endOfUnit(dt, "hour")).not.toThrow();
  });
});

describe("unitsElapsedBetween", () => {
  it("returns 0 when to is in the same unit as from", () => {
    const a = parseInZone("2026-06-15T01:00:00", "UTC");
    const b = parseInZone("2026-06-15T23:00:00", "UTC");
    expect(unitsElapsedBetween(a, b, "day")).toBe(0);
  });

  it("returns 0 (clamped) when to is before from", () => {
    const a = parseInZone("2026-06-15T00:00:00", "UTC");
    const b = parseInZone("2026-06-10T00:00:00", "UTC");
    expect(unitsElapsedBetween(a, b, "day")).toBe(0);
  });

  it("counts an exact multi-unit gap with no off-by-one error", () => {
    const a = parseInZone("2026-06-01T00:00:00", "UTC");
    const b = parseInZone("2026-06-08T00:00:00", "UTC"); // exactly 7 days later
    expect(unitsElapsedBetween(a, b, "day")).toBe(7);
  });

  it("is boundary-exact: n units past from's start gives exactly n", () => {
    const a = startOfUnit(parseInZone("2026-06-01T13:00:00", "UTC"), "day");
    const b = addUnits(a, "day", 5);
    expect(unitsElapsedBetween(a, b, "day")).toBe(5);
    expect(unitsElapsedBetween(a, addUnits(b, "day", -1), "day")).toBe(4);
  });
});

describe("unitKey / isSameUnit — timezone sensitivity", () => {
  it("buckets a late-UTC timestamp into the previous local day in a western zone", () => {
    // 02:00 UTC on 2026-06-15 is 2026-06-14 22:00 in America/Los_Angeles (UTC-7 in June, DST).
    const utc = parseInZone("2026-06-15T02:00:00Z", "UTC");
    const laLocal = parseInZone("2026-06-15T02:00:00Z", "America/Los_Angeles");
    expect(startOfUnit(utc, "day").day).toBe(15);
    expect(startOfUnit(laLocal, "day").day).toBe(14);
  });

  it("isSameUnit is false across that boundary, true within the same zone/day", () => {
    const a = parseInZone("2026-06-15T02:00:00Z", "America/Los_Angeles");
    const b = parseInZone("2026-06-15T02:00:00Z", "UTC");
    expect(isSameUnit(a, b, "day")).toBe(false);

    const c = parseInZone("2026-06-15T10:00:00Z", "America/Los_Angeles");
    const d = parseInZone("2026-06-15T20:00:00Z", "America/Los_Angeles");
    expect(isSameUnit(c, d, "day")).toBe(true);
  });

  it("unitKey is stable and comparable for the same bucket", () => {
    const a = parseInZone("2026-06-15T01:00:00", "UTC");
    const b = parseInZone("2026-06-15T23:00:00", "UTC");
    expect(unitKey(a, "day")).toBe(unitKey(b, "day"));
  });
});

describe("no reliance on host locale/zone state", () => {
  it("does not read Luxon's global Settings.defaultZone", () => {
    const original = Settings.defaultZone;
    try {
      Settings.defaultZone = "Pacific/Kiritimati"; // UTC+14, an extreme offset
      const dt = parseInZone("2026-06-15T12:00:00Z", "UTC");
      expect(dt.zoneName).toBe("UTC");
      expect(startOfUnit(dt, "day").toISODate()).toBe(DateTime.fromISO("2026-06-15").toISODate());
    } finally {
      Settings.defaultZone = original;
    }
  });
});
