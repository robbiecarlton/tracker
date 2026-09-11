import { describe, expect, it } from "vitest";
import { evaluateTarget } from "./targets";

describe("evaluateTarget — at_least", () => {
  it("ratio 1, status met when value equals target", () => {
    expect(evaluateTarget(10, 10, "at_least")).toEqual({ ratio: 1, status: "met" });
  });

  it("ratio 0 when value is 0 and target is positive", () => {
    expect(evaluateTarget(0, 10, "at_least")).toEqual({ ratio: 0, status: "under" });
  });

  it("ratio 0.5 halfway to target", () => {
    const result = evaluateTarget(5, 10, "at_least");
    expect(result.ratio).toBeCloseTo(0.5);
    expect(result.status).toBe("under");
  });

  it("clamps ratio at 1 when value exceeds target", () => {
    const result = evaluateTarget(20, 10, "at_least");
    expect(result.ratio).toBe(1);
    expect(result.status).toBe("met");
  });

  it("handles target <= 0 as a degenerate always-met-if-nonnegative case", () => {
    expect(evaluateTarget(5, 0, "at_least")).toEqual({ ratio: 1, status: "met" });
    expect(evaluateTarget(-1, 0, "at_least")).toEqual({ ratio: 0, status: "under" });
  });
});

describe("evaluateTarget — at_most", () => {
  it("ratio 1, status met when value equals target", () => {
    expect(evaluateTarget(10, 10, "at_most")).toEqual({ ratio: 1, status: "met" });
  });

  it("ratio 1 when value is 0 and target is positive", () => {
    expect(evaluateTarget(0, 10, "at_most")).toEqual({ ratio: 1, status: "met" });
  });

  it("ratio 0 at exactly double the target", () => {
    const result = evaluateTarget(20, 10, "at_most");
    expect(result.ratio).toBe(0);
    expect(result.status).toBe("over");
  });

  it("clamps ratio at 0 well beyond double the target", () => {
    const result = evaluateTarget(100, 10, "at_most");
    expect(result.ratio).toBe(0);
    expect(result.status).toBe("over");
  });

  it("handles target === 0", () => {
    expect(evaluateTarget(0, 0, "at_most")).toEqual({ ratio: 1, status: "met" });
    expect(evaluateTarget(1, 0, "at_most")).toEqual({ ratio: 0, status: "over" });
  });
});

describe("evaluateTarget — exactly", () => {
  it("ratio 1, status met when value equals target", () => {
    expect(evaluateTarget(3, 3, "exactly")).toEqual({ ratio: 1, status: "met" });
  });

  it("ratio 0 at value 0 (target > 0)", () => {
    const result = evaluateTarget(0, 3, "exactly");
    expect(result.ratio).toBe(0);
    expect(result.status).toBe("under");
  });

  it("ratio 0 at double the target", () => {
    const result = evaluateTarget(6, 3, "exactly");
    expect(result.ratio).toBe(0);
    expect(result.status).toBe("over");
  });

  it("is symmetric: equal distances either side of target give equal ratios", () => {
    const below = evaluateTarget(2, 3, "exactly");
    const above = evaluateTarget(4, 3, "exactly");
    expect(below.ratio).toBeCloseTo(above.ratio);
  });

  it("binary-cliff behavior when target is 0", () => {
    expect(evaluateTarget(0, 0, "exactly")).toEqual({ ratio: 1, status: "met" });
    expect(evaluateTarget(1, 0, "exactly")).toEqual({ ratio: 0, status: "over" });
    expect(evaluateTarget(-1, 0, "exactly")).toEqual({ ratio: 0, status: "under" });
  });
});
