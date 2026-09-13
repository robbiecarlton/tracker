import type { Habit, HabitLog, HabitView } from "./domain";
import {
  addUnits,
  nowInZone,
  parseInZone,
  startOfUnit,
  unitKey,
  unitsElapsedBetween,
  type TimeContext,
} from "./time";
import { DEFAULT_UNIT, type Unit } from "./units";

/**
 * The five habit view calculations. Every function is pure: `habit`/`view`/
 * `logs` describe the data, `ctx` supplies "now" and the timezone, and the
 * result is a plain, JSON-serializable object. No rounding/formatting happens
 * here — `PercentageResult.rate` and `DaysResult.value` are raw numbers; how
 * they're displayed (integer vs 2-decimal, "%" suffix, "X out of N" string)
 * is a later, UI-layer concern.
 *
 * See `docs/DOMAIN.md` for the spec these implement.
 */

export interface CumulativeResult {
  kind: "cumulative";
  count: number;
  goal: number | null;
}

export interface StreakResult {
  kind: "streak";
  count: number;
  unit: Unit;
}

export interface PercentageResult {
  kind: "percentage";
  /** 0..1, or null if zero complete units have elapsed since the start date (no data yet). */
  rate: number | null;
  loggedUnits: number;
  /** Denominator; 0 when `rate` is null. */
  totalUnits: number;
  unit: Unit;
}

export interface DaysResult {
  kind: "days";
  /** Hits within the rolling window `[now - (N-1) units, now]`. Always an integer 0..of. */
  value: number;
  /** N, the configured window size. */
  of: number;
  unit: Unit;
}

export interface SinceResult {
  kind: "since";
  /** Fully-elapsed units since the most recent log, or null if there are no logs ever. */
  value: number | null;
  unit: Unit;
}

/** A heatmap's cell/bucket size — day, week, or month, never hour (schema-enforced). */
export type HeatmapUnit = "day" | "week" | "month";

/** Fixed window length per unit — see `computeHeatmap`'s doc comment for why these numbers. */
const HEATMAP_BUCKET_COUNT: Record<HeatmapUnit, number> = {
  day: 182, // 26 complete ISO-Monday weeks
  week: 52,
  month: 24,
};

export interface HeatmapBucket {
  /** ISO start of this bucket, in the requester's timezone. */
  start: string;
  /** Log count within this bucket — 0 renders as "no activity", not "no data". */
  count: number;
}

export interface HeatmapResult {
  kind: "heatmap";
  unit: HeatmapUnit;
  /** Oldest first, newest (current, possibly in-progress) last — fixed length per unit. */
  buckets: HeatmapBucket[];
}

export type ViewResult =
  | CumulativeResult
  | StreakResult
  | PercentageResult
  | DaysResult
  | SinceResult
  | HeatmapResult;

function resolveUnit(view: HabitView): Unit {
  return view.unit ?? DEFAULT_UNIT;
}

/** Buckets `logs` into unit keys with >=1 log. Exported for direct unit testing. */
export function bucketLogsByUnit(
  logs: readonly HabitLog[],
  unit: Unit,
  timeZone: string,
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const log of logs) {
    keys.add(unitKey(parseInZone(log.timestamp, timeZone), unit));
  }
  return keys;
}

/**
 * Like `bucketLogsByUnit`, but counts logs per unit-bucket instead of just
 * presence — Heatmap needs actual counts for cell intensity; every other
 * view only ever needs "was there ≥1 log that unit". Exported for direct
 * unit testing.
 */
export function countLogsByUnit(
  logs: readonly HabitLog[],
  unit: Unit,
  timeZone: string,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const log of logs) {
    const key = unitKey(parseInZone(log.timestamp, timeZone), unit);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function computeCumulative(
  habit: Habit,
  view: HabitView,
  logs: readonly HabitLog[],
  ctx: TimeContext,
): CumulativeResult {
  const startDayStart = startOfUnit(parseInZone(habit.startDate, ctx.timeZone), "day");
  const count = logs.filter(
    (log) => parseInZone(log.timestamp, ctx.timeZone) >= startDayStart,
  ).length;
  return { kind: "cumulative", count, goal: view.cumulationGoal ?? null };
}

export function computeStreak(
  habit: Habit,
  view: HabitView,
  logs: readonly HabitLog[],
  ctx: TimeContext,
): StreakResult {
  const unit = resolveUnit(view);
  const now = nowInZone(ctx);
  const habitStartUnitStart = startOfUnit(parseInZone(habit.startDate, ctx.timeZone), unit);
  const nowUnitStart = startOfUnit(now, unit);
  const logged = bucketLogsByUnit(logs, unit, ctx.timeZone);

  let count = 0;
  let cursor = nowUnitStart;

  // Today (the in-progress unit) counts immediately if logged; if it's not
  // logged yet, it's forgiven — it doesn't break the streak — and the walk
  // simply starts from the most recently *completed* unit instead.
  if (logged.has(unitKey(cursor, unit))) {
    count += 1;
    cursor = addUnits(cursor, unit, -1);
  } else {
    cursor = addUnits(cursor, unit, -1);
  }

  while (cursor >= habitStartUnitStart && logged.has(unitKey(cursor, unit))) {
    count += 1;
    cursor = addUnits(cursor, unit, -1);
  }

  return { kind: "streak", count, unit };
}

export function computePercentage(
  habit: Habit,
  view: HabitView,
  logs: readonly HabitLog[],
  ctx: TimeContext,
): PercentageResult {
  const unit = resolveUnit(view);
  const now = nowInZone(ctx);
  const habitStartUnitStart = startOfUnit(parseInZone(habit.startDate, ctx.timeZone), unit);
  const nowUnitStart = startOfUnit(now, unit);
  const completedUnits = unitsElapsedBetween(habitStartUnitStart, nowUnitStart, unit);

  const logged = bucketLogsByUnit(logs, unit, ctx.timeZone);
  let loggedUnits = 0;
  let cursor = habitStartUnitStart;
  for (let i = 0; i < completedUnits; i++) {
    if (logged.has(unitKey(cursor, unit))) loggedUnits += 1;
    cursor = addUnits(cursor, unit, 1);
  }

  // Today (the in-progress unit) gives instant feedback, like Streak/Days:
  // logging it counts as a hit right away, joining both the numerator and
  // the denominator. If it's not logged yet, it's forgiven — excluded
  // entirely rather than counted as a miss.
  const todayLogged = logged.has(unitKey(nowUnitStart, unit));
  const totalUnits = completedUnits + (todayLogged ? 1 : 0);
  if (todayLogged) loggedUnits += 1;

  if (totalUnits === 0) {
    return { kind: "percentage", rate: null, loggedUnits: 0, totalUnits: 0, unit };
  }

  return { kind: "percentage", rate: loggedUnits / totalUnits, loggedUnits, totalUnits, unit };
}

export function computeDays(
  habit: Habit,
  view: HabitView,
  logs: readonly HabitLog[],
  ctx: TimeContext,
): DaysResult {
  const unit = resolveUnit(view);
  const N = view.days ?? 7;
  const now = nowInZone(ctx);
  const habitStartUnitStart = startOfUnit(parseInZone(habit.startDate, ctx.timeZone), unit);
  const nowUnitStart = startOfUnit(now, unit);

  const windowFirst = addUnits(nowUnitStart, unit, -(N - 1));
  const effectiveFirst = windowFirst >= habitStartUnitStart ? windowFirst : habitStartUnitStart;

  const logged = bucketLogsByUnit(logs, unit, ctx.timeZone);
  let value = 0;
  let cursor = effectiveFirst;
  while (cursor <= nowUnitStart) {
    if (logged.has(unitKey(cursor, unit))) value += 1;
    cursor = addUnits(cursor, unit, 1);
  }

  return { kind: "days", value, of: N, unit };
}

export function computeSince(
  habit: Habit,
  view: HabitView,
  logs: readonly HabitLog[],
  ctx: TimeContext,
): SinceResult {
  const unit = resolveUnit(view);

  if (logs.length === 0) {
    return { kind: "since", value: null, unit };
  }

  const now = nowInZone(ctx);
  const nowUnitStart = startOfUnit(now, unit);

  const timestamps = logs.map((log) => parseInZone(log.timestamp, ctx.timeZone));
  const mostRecent = timestamps.reduce((latest, t) => (t > latest ? t : latest));

  const mostRecentUnitStart = startOfUnit(mostRecent, unit);
  const value = unitsElapsedBetween(mostRecentUnitStart, nowUnitStart, unit);

  return { kind: "since", value, unit };
}

/**
 * GitHub/Anki-style calendar heatmap: a fixed-length run of unit-buckets
 * ending at "now", each carrying its log count. `HEATMAP_BUCKET_COUNT`
 * gives every unit roughly the same visual footprint (day → 182 = 26
 * weeks, week → 52, month → 24).
 *
 * `day` uniquely aligns its window to 26 *complete* ISO-Monday weeks
 * (starting the Monday 25 weeks before the current week's Monday) rather
 * than simply "182 days back from today" — so the UI can lay it out as a
 * clean 26-column × 7-row grid (columns = weeks) with no partial leading
 * column. `week`/`month` have no such alignment concern (the UI doesn't
 * do calendar-column layout for those — see `Heatmap.tsx`), so they're
 * just the trailing N buckets ending at the current, possibly in-progress
 * one.
 */
export function computeHeatmap(
  habit: Habit,
  view: HabitView,
  logs: readonly HabitLog[],
  ctx: TimeContext,
): HeatmapResult {
  const unit = (view.unit ?? "day") as HeatmapUnit;
  const bucketCount = HEATMAP_BUCKET_COUNT[unit];
  const now = nowInZone(ctx);
  const counts = countLogsByUnit(logs, unit, ctx.timeZone);

  const windowStart =
    unit === "day"
      ? addUnits(startOfUnit(now, "week"), "week", -(bucketCount / 7 - 1))
      : addUnits(startOfUnit(now, unit), unit, -(bucketCount - 1));

  const buckets: HeatmapBucket[] = [];
  let cursor = windowStart;
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({
      start: cursor.toISO() ?? cursor.toJSDate().toISOString(),
      count: counts.get(unitKey(cursor, unit)) ?? 0,
    });
    cursor = addUnits(cursor, unit, 1);
  }

  return { kind: "heatmap", unit, buckets };
}

/** Dispatches on `view.kind`. Exhaustive over `ViewKind` (compile error if a case is missed). */
export function computeHabitView(
  habit: Habit,
  view: HabitView,
  logs: readonly HabitLog[],
  ctx: TimeContext,
): ViewResult {
  switch (view.kind) {
    case "cumulative":
      return computeCumulative(habit, view, logs, ctx);
    case "streak":
      return computeStreak(habit, view, logs, ctx);
    case "percentage":
      return computePercentage(habit, view, logs, ctx);
    case "days":
      return computeDays(habit, view, logs, ctx);
    case "since":
      return computeSince(habit, view, logs, ctx);
    case "heatmap":
      return computeHeatmap(habit, view, logs, ctx);
    default: {
      const exhaustive: never = view.kind;
      throw new Error(`Unhandled view kind: ${exhaustive as string}`);
    }
  }
}
