import { describe, expect, it } from "vitest";
import { DEFAULT_UNIT, isUnit, UNITS } from "./units";

describe("units", () => {
  it("has the four supported units", () => {
    expect(UNITS).toEqual(["hour", "day", "week", "month"]);
  });

  it("defaults to day", () => {
    expect(DEFAULT_UNIT).toBe("day");
  });

  it("isUnit accepts valid units and rejects anything else", () => {
    expect(isUnit("week")).toBe(true);
    expect(isUnit("year")).toBe(false);
    expect(isUnit(7)).toBe(false);
    expect(isUnit(undefined)).toBe(false);
  });
});
