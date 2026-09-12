import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatCalendarDate,
  formatLogTimestamp,
  formatLogTimestampInput,
  parseLogTimestampInput,
  todayInZone,
} from "./date-format";

const UTC = "UTC";

describe("formatLogTimestamp", () => {
  it("formats an ISO instant as a human date + time in the given zone", () => {
    expect(formatLogTimestamp("2026-09-11T15:45:00Z", UTC)).toContain("2026");
    expect(formatLogTimestamp("2026-09-11T15:45:00Z", UTC)).toContain("Sep");
  });
});

describe("formatCalendarDate", () => {
  it("formats an ISO instant as a human date only", () => {
    const result = formatCalendarDate("2026-09-11T15:45:00Z", UTC);
    expect(result).toContain("2026");
    expect(result).not.toMatch(/\d{1,2}:\d{2}/); // no time component
  });
});

describe("parseLogTimestampInput", () => {
  it("parses a valid 'YYYY-MM-DD HH:mm' string into a UTC ISO instant", () => {
    const result = parseLogTimestampInput("2026-09-11 15:45", UTC);
    expect(result).toBe("2026-09-11T15:45:00.000Z");
  });

  it("interprets the input in the given timezone, not UTC", () => {
    // 15:45 in America/Denver (UTC-6 in September, MDT) is 21:45 UTC.
    const result = parseLogTimestampInput("2026-09-11 15:45", "America/Denver");
    expect(result).toBe("2026-09-11T21:45:00.000Z");
  });

  it("returns null for text that doesn't match the expected shape", () => {
    expect(parseLogTimestampInput("2026-09-11", UTC)).toBeNull();
    expect(parseLogTimestampInput("not a date", UTC)).toBeNull();
    expect(parseLogTimestampInput("", UTC)).toBeNull();
  });

  it("returns null for a syntactically-shaped but invalid date/time", () => {
    expect(parseLogTimestampInput("2026-13-45 25:99", UTC)).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(parseLogTimestampInput("  2026-09-11 15:45  ", UTC)).toBe("2026-09-11T15:45:00.000Z");
  });
});

describe("formatLogTimestampInput", () => {
  it("round-trips with parseLogTimestampInput", () => {
    const iso = "2026-09-11T21:45:00.000Z";
    const formatted = formatLogTimestampInput(iso, "America/Denver");
    expect(formatted).toBe("2026-09-11 15:45");
    expect(parseLogTimestampInput(formatted, "America/Denver")).toBe(iso);
  });
});

describe("todayInZone", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the given zone's calendar date, not UTC's", () => {
    // 8pm Sept 11 in America/Denver (UTC-6, MDT in September) is already
    // 2am Sept 12 in UTC — the exact off-by-one this function exists to
    // avoid (a new habit's default start date landing "tomorrow").
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T02:00:00Z"));
    expect(todayInZone("America/Denver")).toBe("2026-09-11");
    expect(todayInZone(UTC)).toBe("2026-09-12");
  });
});
