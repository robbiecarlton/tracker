import { describe, expect, it } from "vitest";
import { getDeviceTimeZone, normalizeTimeZone } from "./timezone";

describe("timezone", () => {
  it("normalizeTimeZone falls back to UTC for empty input", () => {
    expect(normalizeTimeZone(undefined)).toBe("UTC");
    expect(normalizeTimeZone(null)).toBe("UTC");
    expect(normalizeTimeZone("   ")).toBe("UTC");
    expect(normalizeTimeZone("Europe/London")).toBe("Europe/London");
  });

  it("getDeviceTimeZone returns a non-empty IANA-ish string", () => {
    const tz = getDeviceTimeZone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });
});
