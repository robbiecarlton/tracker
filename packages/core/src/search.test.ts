import { describe, expect, it } from "vitest";
import { fuzzySubsequenceMatch } from "./search";

describe("fuzzySubsequenceMatch", () => {
  const target = "Be Healthy Exercise Run";

  it("matches the user's own worked examples", () => {
    expect(fuzzySubsequenceMatch("heaerun", target)).toBe(true);
    expect(fuzzySubsequenceMatch("exru", target)).toBe(true);
    expect(fuzzySubsequenceMatch("xrun", target)).toBe(true);
    expect(fuzzySubsequenceMatch("ru", target)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(fuzzySubsequenceMatch("HEAERUN", target)).toBe(true);
    expect(fuzzySubsequenceMatch("ExRu", target)).toBe(true);
  });

  it("rejects out-of-order or missing characters", () => {
    expect(fuzzySubsequenceMatch("nur", target)).toBe(false); // reversed
    expect(fuzzySubsequenceMatch("zzz", target)).toBe(false); // absent
    expect(fuzzySubsequenceMatch("runx", target)).toBe(false); // trailing char not present after "run"
  });

  it("treats an empty (or whitespace-only) query as matching everything", () => {
    expect(fuzzySubsequenceMatch("", target)).toBe(true);
    expect(fuzzySubsequenceMatch("   ", target)).toBe(true);
  });
});
