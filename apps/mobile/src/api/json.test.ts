import { describe, expect, it } from "vitest";
import { parseJsonPlain } from "./json";

describe("parseJsonPlain", () => {
  it("does not coerce ISO-date-shaped strings into Date objects", () => {
    // Regression test: authClient.$fetch's default jsonParser (Better
    // Auth's betterJSONParse, parseDates: true) does exactly this coercion,
    // which broke @tracker/core's string-typed date fields — see the
    // comment in client.ts for the full story.
    const parsed = parseJsonPlain('{"startDate":"2026-08-11T00:00:00.000Z"}') as {
      startDate: unknown;
    };
    expect(typeof parsed.startDate).toBe("string");
    expect(parsed.startDate).toBe("2026-08-11T00:00:00.000Z");
  });

  it("returns null for an empty body (e.g. a 204 response)", () => {
    expect(parseJsonPlain("")).toBeNull();
  });

  it("parses ordinary JSON normally", () => {
    expect(parseJsonPlain('{"a":1,"b":[1,2,3]}')).toEqual({ a: 1, b: [1, 2, 3] });
  });
});
