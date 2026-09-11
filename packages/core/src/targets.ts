import type { TargetType } from "./domain";

/**
 * Target evaluation for `days` / `percentage` views. Produces a normalized
 * "how good is this value relative to target" ratio, consumed by
 * `highlight.ts` to drive the dashboard's green->orange->red mapping.
 *
 * Scale note: callers are responsible for putting `value`/`target` on a
 * matching scale before calling this — e.g. a `percentage` view's target is
 * percentage points (0-100), so its rate (0..1) must be multiplied by 100
 * first; a `days` view's target is already on the same "X out of N" scale as
 * its computed value.
 */

export type TargetStatus = "met" | "under" | "over";

export interface TargetEvaluation {
  /** Clamped to [0, 1]. 1 = as good as it gets relative to target; 0 = as bad as it gets. */
  ratio: number;
  status: TargetStatus;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function evaluateTarget(
  value: number,
  target: number,
  targetType: TargetType,
): TargetEvaluation {
  switch (targetType) {
    case "at_least": {
      const ratio = target <= 0 ? (value >= target ? 1 : 0) : clamp01(value / target);
      return { ratio, status: value >= target ? "met" : "under" };
    }
    case "at_most": {
      let ratio: number;
      if (target <= 0) {
        ratio = value <= 0 ? 1 : 0;
      } else if (value <= target) {
        ratio = 1;
      } else {
        ratio = clamp01(1 - (value - target) / target);
      }
      return { ratio, status: value <= target ? "met" : "over" };
    }
    case "exactly": {
      const ratio =
        target === 0
          ? value === 0
            ? 1
            : 0
          : clamp01(1 - Math.abs(value - target) / Math.abs(target));
      const status: TargetStatus = value === target ? "met" : value < target ? "under" : "over";
      return { ratio, status };
    }
  }
}
