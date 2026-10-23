import {
  sprintStatus,
  type PointSprint,
  type PointsKind,
  type SuggestionItem,
  type TimeContext,
} from "@tracker/core";
import { DateTime } from "luxon";

/**
 * Display strings for Point Sprints — the math itself lives in
 * `@tracker/core`'s `points.ts`; this only turns its numbers into text.
 */

/** The small chip on a habit card, e.g. "+3 per log" / "+5 per clean day". */
export function pointsChipLabel(kind: PointsKind, value: number): string {
  return kind === "per_log" ? `+${value} per log` : `+${value} per clean day`;
}

/** Points-per-day needed, to one decimal place, without a trailing ".0". */
export function formatDailyAverage(avg: number): string {
  return String(Math.round(avg * 10) / 10);
}

/** A sprint's name, or a date-range label like "Mar 1 – Mar 8" when it has none. */
export function sprintLabel(
  sprint: Pick<PointSprint, "name" | "startAt" | "endAt">,
  timeZone: string,
): string {
  if (sprint.name) return sprint.name;
  const fmt = (iso: string) => DateTime.fromISO(iso, { zone: timeZone }).toFormat("LLL d");
  return `${fmt(sprint.startAt)} – ${fmt(sprint.endAt)}`;
}

/** One line of a suggested day, e.g. "Run ×2" or "Skip Smoking". */
export function suggestionLabel(item: SuggestionItem, habitName: string): string {
  if (item.kind === "clean_day") return `Skip ${habitName}`;
  return item.count > 1 ? `${habitName} ×${item.count}` : habitName;
}

/**
 * The parents a suggested log also counts for — e.g. "Also logs Exercise
 * (+2)" — since logging a subhabit always logs its ancestors too. `null`
 * when there are none (including every skip).
 */
export function suggestionRollupLabel(
  item: SuggestionItem,
  nameOf: (habitId: string) => string,
): string | null {
  if (item.alsoEarns.length === 0) return null;
  return `Also logs ${item.alsoEarns.map((a) => `${nameOf(a.habitId)} (+${a.points})`).join(", ")}`;
}

/** A suggestion list's day heading, e.g. "Today" or "Thu, Mar 5". */
export function suggestionDayLabel(isoDate: string, ctx: TimeContext): string {
  const day = DateTime.fromISO(isoDate, { zone: ctx.timeZone });
  const today = DateTime.fromISO(ctx.now, { zone: ctx.timeZone }).toISODate();
  return isoDate === today ? "Today" : day.toFormat("ccc, LLL d");
}

/**
 * The confirmation shown before saving a habit whose points changed while
 * any sprint is active (totals are live, so the edit rewrites them) — or
 * `null` when no confirmation is needed.
 */
export function pointsEditWarning(
  before: { pointsKind: PointsKind | null; pointsValue: number | null },
  after: { pointsKind?: PointsKind | null; pointsValue?: number | null },
  sprints: readonly Pick<PointSprint, "startAt" | "endAt">[],
  ctx: TimeContext,
): string | null {
  const changed =
    before.pointsKind !== (after.pointsKind ?? null) ||
    before.pointsValue !== (after.pointsValue ?? null);
  if (!changed) return null;
  const active = sprints.filter((s) => sprintStatus(s, ctx) === "active").length;
  if (active === 0) return null;
  return `There are active sprints, are you sure you want to change this total? (${active} ${
    active === 1 ? "sprint" : "sprints"
  } affected)`;
}
