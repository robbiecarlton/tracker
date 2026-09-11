import { DateTime } from "luxon";
import type { Unit } from "./units";

/**
 * Timezone-aware unit-boundary primitives, built on Luxon. Every calculation in
 * `views.ts` is built from these. Nothing in this package calls `Date.now()` or
 * reads the host's local timezone implicitly — `now`/`timeZone` always arrive as
 * explicit parameters, so every calculation stays pure and deterministic.
 *
 * `DateTime` (Luxon's type) is used internally but never crosses the package's
 * public API: `views.ts` / `targets.ts` / `highlight.ts` only deal in ISO
 * strings and plain numbers, matching `domain.ts`'s existing convention.
 */

/** Threads "now" and the user's IANA timezone through every pure calculation. */
export interface TimeContext {
  /** ISO 8601 datetime string, e.g. `new Date().toISOString()`. */
  now: string;
  /** IANA zone name, e.g. "America/Chicago". */
  timeZone: string;
}

/** Maps a `Unit` to the plural key Luxon's `plus`/`diff` expect. */
function unitPluralKey(unit: Unit): "hours" | "days" | "weeks" | "months" {
  return `${unit}s`;
}

/** Parses an ISO datetime string into the given IANA zone. Throws on invalid input or zone. */
export function parseInZone(iso: string, timeZone: string): DateTime {
  const dt = DateTime.fromISO(iso, { zone: timeZone });
  if (!dt.isValid) {
    throw new Error(
      `Invalid datetime "${iso}" in zone "${timeZone}": ${dt.invalidReason} — ${dt.invalidExplanation}`,
    );
  }
  return dt;
}

/** Convenience: `parseInZone(ctx.now, ctx.timeZone)`. */
export function nowInZone(ctx: TimeContext): DateTime {
  return parseInZone(ctx.now, ctx.timeZone);
}

/**
 * Start of the unit-bucket containing `dt` (inclusive), in `dt`'s own zone.
 *
 * `week` uses Luxon's default `startOf("week")`, which is always ISO
 * Monday-start regardless of locale (`docs/DOMAIN.md` doesn't specify a week
 * start; Monday was picked as the documented default — see the guard test in
 * `time.test.ts`).
 */
export function startOfUnit(dt: DateTime, unit: Unit): DateTime {
  return dt.startOf(unit);
}

/** Start of the *next* unit-bucket after `dt`'s (i.e. the exclusive end boundary). */
export function endOfUnit(dt: DateTime, unit: Unit): DateTime {
  return addUnits(startOfUnit(dt, unit), unit, 1);
}

/** `dt`'s unit-start shifted by `count` units (may be negative). */
export function addUnits(dt: DateTime, unit: Unit, count: number): DateTime {
  return dt.plus({ [unitPluralKey(unit)]: count });
}

/**
 * Count of fully-elapsed unit-buckets in `[startOfUnit(from), startOfUnit(to))`.
 * Returns 0 if `to`'s unit is at or before `from`'s unit (nothing has elapsed
 * yet, or `to` is in the past relative to `from` — a defensive clamp, e.g. for
 * a future-dated log caused by clock skew).
 *
 * This single primitive is the shared basis for Percentage's denominator and
 * Since's value: "how many complete units separate these two instants".
 */
export function unitsElapsedBetween(from: DateTime, to: DateTime, unit: Unit): number {
  const fromStart = startOfUnit(from, unit);
  const toStart = startOfUnit(to, unit);
  if (toStart <= fromStart) return 0;
  const key = unitPluralKey(unit);
  return Math.floor(toStart.diff(fromStart, key).get(key));
}

/** Stable string key identifying `dt`'s unit-bucket (for Set/Map bucketing of logs). */
export function unitKey(dt: DateTime, unit: Unit): string {
  return startOfUnit(dt, unit).toISO() ?? String(startOfUnit(dt, unit).toMillis());
}

/** True if `a` and `b` fall in the same unit-bucket. */
export function isSameUnit(a: DateTime, b: DateTime, unit: Unit): boolean {
  return unitKey(a, unit) === unitKey(b, unit);
}
