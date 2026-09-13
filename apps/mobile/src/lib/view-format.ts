import type { Unit, ViewKind, ViewResult } from "@tracker/core";

/**
 * Display-only formatting for a computed `ViewResult` — labels, unit
 * pluralization, "X out of N" strings. Deliberately kept out of
 * `@tracker/core`, which stays pure math; this is UI presentation.
 */

const VIEW_LABELS: Record<ViewKind, string> = {
  cumulative: "Cumulative",
  streak: "Streak",
  percentage: "Percentage",
  days: "Days",
  since: "Since",
  heatmap: "Heatmap",
};

export function viewLabel(kind: ViewKind): string {
  return VIEW_LABELS[kind];
}

const UNIT_LABELS: Record<Unit, string> = {
  hour: "hour",
  day: "day",
  week: "week",
  month: "month",
};

export function unitLabel(unit: Unit, count: number): string {
  const base = UNIT_LABELS[unit];
  return count === 1 ? base : `${base}s`;
}

/** The formatted value string for a habit card's view tile. */
export function formatViewValue(result: ViewResult): string {
  switch (result.kind) {
    case "cumulative":
      return result.goal != null ? `${result.count} / ${result.goal}` : `${result.count}`;
    case "streak":
      return `${result.count} ${unitLabel(result.unit, result.count)}`;
    case "percentage":
      return result.rate == null ? "—" : `${Math.round(result.rate * 100)}%`;
    case "days":
      return `${result.value} out of ${result.of}`;
    case "since":
      return result.value == null
        ? "Never logged"
        : `${result.value} ${unitLabel(result.unit, result.value)} ago`;
    case "heatmap":
      // Heatmap renders as its own grid (`components/Heatmap.tsx`), never
      // as a `ViewTile` — this branch only exists so the switch stays
      // exhaustive over `ViewResult`.
      return `${result.buckets.reduce((sum, b) => sum + b.count, 0)} logs`;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

/**
 * The numeric value to feed `computeHighlight(view, value)`, on the same
 * scale as the view's `target` — percentage points (0-100) for Percentage,
 * the raw "out of N" count for Days. `null` for views with no target concept
 * (Cumulative/Streak/Since), or when there's no data yet.
 */
export function highlightValueForView(result: ViewResult): number | null {
  switch (result.kind) {
    case "percentage":
      return result.rate == null ? null : result.rate * 100;
    case "days":
      return result.value;
    default:
      return null;
  }
}
