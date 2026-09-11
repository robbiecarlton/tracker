import type { HabitView } from "./domain";
import { evaluateTarget } from "./targets";

/**
 * Maps a target-evaluation ratio to a dashboard tile highlight color, and
 * ties `HabitView` + a computed value together into that color end-to-end.
 */

/** Hex color string, e.g. "#16a34a". */
export type HighlightColor = string;

const RED: [number, number, number] = [220, 38, 38]; // #dc2626
const ORANGE: [number, number, number] = [245, 158, 11]; // #f59e0b
const GREEN: [number, number, number] = [22, 163, 74]; // #16a34a

function toHex2(n: number): string {
  return Math.round(n).toString(16).padStart(2, "0");
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/**
 * Interpolates red -> orange -> green as `ratio` goes 0 -> 0.5 -> 1.
 * Input is clamped to [0, 1] rather than extrapolated.
 */
export function ratioToColor(ratio: number): HighlightColor {
  const r = Math.min(1, Math.max(0, ratio));
  const [from, to, t] = r <= 0.5 ? [RED, ORANGE, r / 0.5] : [ORANGE, GREEN, (r - 0.5) / 0.5];
  const channels = [0, 1, 2].map((i) => toHex2(lerp(from[i]!, to[i]!, t)));
  return `#${channels.join("")}`;
}

/**
 * Full pipeline for a computed view's numeric value: `null` if the view has
 * no target configured, or if `value` is `null` (no data yet — e.g. a
 * zero-denominator percentage). Otherwise evaluates the target and maps the
 * resulting ratio to a color.
 */
export function computeHighlight(view: HabitView, value: number | null): HighlightColor | null {
  if (view.target == null || view.targetType == null) return null;
  if (value == null) return null;
  return ratioToColor(evaluateTarget(value, view.target, view.targetType).ratio);
}
