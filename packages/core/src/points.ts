import type { DateTime } from "luxon";
import type { Habit, HabitLog, PointSprint, PointsKind, PointsLimit } from "./domain";
import { getAncestors, getDescendants, type HabitNode } from "./habit-tree";
import { nowInZone, parseInZone, startOfUnit, type TimeContext } from "./time";

/**
 * Point Sprints — see `docs/DOMAIN.md`'s "Points & sprints". Everything is
 * computed live from logs and each habit's *current* point value (nothing
 * is snapshotted), so editing a value retroactively changes every sprint's
 * total, same as editing a view's config changes its number.
 *
 * Unlike views' `aggregatedLogs`, points count archived habits' logs too:
 * a log is a fact about something already done, and archive-and-clone (a
 * start-date change) archiving a habit mid-sprint shouldn't take its points
 * away. An archived habit just stops *earning* clean-day points after its
 * own `archivedAt`.
 */

/** The fields points math needs — a mobile `ApiHabit` satisfies this. */
export type PointsHabit = HabitNode &
  Pick<Habit, "startDate" | "pointsKind" | "pointsValue" | "pointsLimit" | "allowDirectLogging"> & {
    logs: readonly HabitLog[];
  };

export type SprintStatus = "upcoming" | "active" | "ended";

const DAY_MS = 24 * 60 * 60 * 1000;

function hasPoints(habit: PointsHabit): boolean {
  return habit.pointsKind != null && habit.pointsValue != null;
}

/** A `per_log` habit's cap, or `null` when it isn't capped (or isn't `per_log`). */
function capOf(habit: PointsHabit): Exclude<PointsLimit, "unlimited"> | null {
  if (habit.pointsKind !== "per_log") return null;
  return habit.pointsLimit === "per_day" || habit.pointsLimit === "per_sprint"
    ? habit.pointsLimit
    : null;
}

/** `habitId`'s own logs plus every descendant's, archived or not (see top). */
function subtreeLogs<T extends PointsHabit>(habit: T, habits: readonly T[]): HabitLog[] {
  return [...habit.logs, ...getDescendants(habit.id, habits).flatMap((d) => d.habit.logs)];
}

export function sprintStatus(
  sprint: Pick<PointSprint, "startAt" | "endAt">,
  ctx: TimeContext,
): SprintStatus {
  const now = nowInZone(ctx);
  if (now < parseInZone(sprint.startAt, ctx.timeZone)) return "upcoming";
  if (now >= parseInZone(sprint.endAt, ctx.timeZone)) return "ended";
  return "active";
}

/**
 * Midnights M (user's zone) with `start < M ≤ end`, capped at `limit` —
 * the moments a clean-day habit can award points.
 */
function midnightsIn(start: DateTime, end: DateTime, limit: DateTime): DateTime[] {
  const result: DateTime[] = [];
  // The first midnight strictly after `start` (a start exactly at midnight
  // doesn't count that midnight — nothing in the sprint preceded it).
  let m = startOfUnit(startOfUnit(start, "day").plus({ hours: 36 }), "day");
  const last = end < limit ? end : limit;
  while (m <= last) {
    result.push(m);
    // +36h then snap to midnight: safe across DST, where a day isn't 24h.
    m = startOfUnit(m.plus({ hours: 36 }), "day");
  }
  return result;
}

function cleanDayAwards<T extends PointsHabit>(
  habit: T,
  habits: readonly T[],
  sprint: Pick<PointSprint, "startAt" | "endAt">,
  ctx: TimeContext,
): number {
  const zone = ctx.timeZone;
  let limit = nowInZone(ctx);
  if (habit.archivedAt) {
    const archived = parseInZone(habit.archivedAt, zone);
    if (archived < limit) limit = archived;
  }
  const habitStart = startOfUnit(parseInZone(habit.startDate, zone), "day");
  const logTimes = subtreeLogs(habit, habits).map((l) => parseInZone(l.timestamp, zone).toMillis());

  let awards = 0;
  const midnights = midnightsIn(
    parseInZone(sprint.startAt, zone),
    parseInZone(sprint.endAt, zone),
    limit,
  );
  for (const m of midnights) {
    // A literal 24 hours, per the spec — not "the previous calendar day".
    const windowEnd = m.toMillis();
    const windowStart = windowEnd - DAY_MS;
    if (windowStart < habitStart.toMillis()) continue;
    if (!logTimes.some((t) => t >= windowStart && t < windowEnd)) awards += 1;
  }
  return awards;
}

/**
 * A sprint's total, plus what each habit contributed (only habits that
 * earned > 0 appear in `byHabit`). A `per_log` habit earns its value for
 * every log of itself *or any descendant* in `[startAt, endAt)` — logging
 * rolls up, which is what "Double counting" flags — limited by its
 * `pointsLimit`: once per local calendar day with an in-window log
 * (`per_day`), or once for the whole sprint (`per_sprint`).
 */
export function sprintPoints<T extends PointsHabit>(
  sprint: Pick<PointSprint, "startAt" | "endAt">,
  habits: readonly T[],
  ctx: TimeContext,
): { total: number; byHabit: Map<string, number> } {
  const start = parseInZone(sprint.startAt, ctx.timeZone).toMillis();
  const end = parseInZone(sprint.endAt, ctx.timeZone).toMillis();
  const byHabit = new Map<string, number>();
  let total = 0;

  for (const habit of habits) {
    if (!hasPoints(habit)) continue;
    const value = habit.pointsValue!;
    let earned = 0;
    if (habit.pointsKind === "per_log") {
      const inWindow = subtreeLogs(habit, habits)
        .map((l) => parseInZone(l.timestamp, ctx.timeZone))
        .filter((t) => t.toMillis() >= start && t.toMillis() < end);
      const cap = capOf(habit);
      const scoring =
        cap === "per_sprint"
          ? Math.min(1, inWindow.length)
          : cap === "per_day"
            ? new Set(inWindow.map((t) => t.toISODate())).size
            : inWindow.length;
      earned = scoring * value;
    } else {
      earned = cleanDayAwards(habit, habits, sprint, ctx) * value;
    }
    if (earned > 0) {
      byHabit.set(habit.id, earned);
      total += earned;
    }
  }
  return { total, byHabit };
}

/**
 * Whole days left to earn points in, rounded *down* (conservative):
 * `floor((end − max(now, start)) / 24h)`, but never below 1 while the
 * sprint hasn't ended — the last partial day still has to count for
 * something. 0 once ended.
 */
export function remainingSprintDays(
  sprint: Pick<PointSprint, "startAt" | "endAt">,
  ctx: TimeContext,
): number {
  if (sprintStatus(sprint, ctx) === "ended") return 0;
  const now = nowInZone(ctx).toMillis();
  const start = parseInZone(sprint.startAt, ctx.timeZone).toMillis();
  const end = parseInZone(sprint.endAt, ctx.timeZone).toMillis();
  return Math.max(1, Math.floor((end - Math.max(now, start)) / DAY_MS));
}

/** Points per day still needed to hit `target`. 0 once hit or ended. */
export function dailyAverageNeeded(
  sprint: Pick<PointSprint, "startAt" | "endAt" | "target">,
  total: number,
  ctx: TimeContext,
): number {
  const days = remainingSprintDays(sprint, ctx);
  if (days === 0) return 0;
  return Math.max(0, sprint.target - total) / days;
}

/**
 * The local calendar days (`YYYY-MM-DD`) a suggestion list is shown for:
 * from today (or the start day, if the sprint hasn't begun) through the
 * day containing the last moment before `endAt`. Empty once ended.
 */
export function remainingSprintDates(
  sprint: Pick<PointSprint, "startAt" | "endAt">,
  ctx: TimeContext,
): string[] {
  if (sprintStatus(sprint, ctx) === "ended") return [];
  const now = nowInZone(ctx);
  const start = parseInZone(sprint.startAt, ctx.timeZone);
  const end = parseInZone(sprint.endAt, ctx.timeZone);
  const dates: string[] = [];
  let day = startOfUnit(now > start ? now : start, "day");
  while (day < end) {
    dates.push(day.toISODate()!);
    day = startOfUnit(day.plus({ hours: 36 }), "day");
  }
  return dates;
}

/**
 * For a capped `per_log` habit (the only kind that gets "already scored"
 * labels): whether it — or any descendant, since logs roll up — was
 * logged today (`per_day`), and which of `sprints` are active and already
 * have a scoring log in them (`per_sprint`). Both empty/false otherwise.
 */
export function cappedPointsStatus<T extends PointsHabit>(
  habit: T,
  habits: readonly T[],
  sprints: readonly Pick<PointSprint, "id" | "startAt" | "endAt">[],
  ctx: TimeContext,
): { doneToday: boolean; doneSprintIds: string[] } {
  const cap = capOf(habit);
  if (!cap || !hasPoints(habit)) return { doneToday: false, doneSprintIds: [] };
  const times = subtreeLogs(habit, habits).map((l) => parseInZone(l.timestamp, ctx.timeZone));
  if (cap === "per_day") {
    const today = nowInZone(ctx).toISODate();
    return { doneToday: times.some((t) => t.toISODate() === today), doneSprintIds: [] };
  }
  const doneSprintIds = sprints
    .filter((s) => sprintStatus(s, ctx) === "active")
    .filter((s) => {
      const start = parseInZone(s.startAt, ctx.timeZone);
      const end = parseInZone(s.endAt, ctx.timeZone);
      return times.some((t) => t >= start && t < end);
    })
    .map((s) => s.id);
  return { doneToday: false, doneSprintIds };
}

/**
 * Ids of every non-archived habit with points that also has a
 * non-archived ancestor or descendant with points — logging the lower one
 * earns both (or, for a clean-day ancestor, breaks its clean day), which
 * the dashboard flags as "Double counting" on both habits.
 */
export function doubleCountedHabitIds<T extends PointsHabit>(habits: readonly T[]): Set<string> {
  const flagged = new Set<string>();
  for (const habit of habits) {
    if (habit.archivedAt || !hasPoints(habit)) continue;
    for (const ancestor of getAncestors(habit.id, habits)) {
      if (ancestor.archivedAt || !hasPoints(ancestor)) continue;
      flagged.add(habit.id);
      flagged.add(ancestor.id);
    }
  }
  return flagged;
}

export type PointsFilter = "all" | "points" | "no_points";

/**
 * The dashboard's points filter: does `habit` belong in the flat filtered
 * list? Only the habit's *own* points count — an ancestor or descendant
 * earning points doesn't pull it in.
 */
export function matchesPointsFilter(habit: PointsHabit, filter: PointsFilter): boolean {
  if (filter === "all") return true;
  return hasPoints(habit) === (filter === "points");
}

/** One line of a suggested day: log `habitId` `count` times, or skip it. */
export interface SuggestionItem {
  habitId: string;
  kind: PointsKind;
  count: number;
  /** Points this line is worth in total (`count` × each one's worth), including `alsoEarns`. */
  points: number;
  /**
   * `per_log` only: the `per_log` ancestors a log of this habit also
   * counts for (logging rolls up — you can't log the child without the
   * parent), root first, each with its share of `points`. Empty for skips.
   */
  alsoEarns: { habitId: string; points: number }[];
}

/**
 * One random way to earn ≥ `target` points in a day: draws uniformly from
 * habits with points until the running sum reaches `target` (so it
 * usually overshoots a little).
 *
 * - A `per_log` pick is worth its own value plus every non-archived
 *   `per_log` ancestor's (logging rolls up), may repeat, and is never
 *   drawn when direct logging is off.
 * - A capped habit (`per_day`/`per_sprint`) scores once: after that it's
 *   never drawn again, and as an ancestor it adds nothing more. Habits in
 *   `exhausted` (already scored today / this sprint) start out that way.
 *   The returned `exhausted` adds this day's capped picks, so a caller can
 *   carry `per_sprint` ones into the next day (`suggestSprintPlan`).
 * - A `clean_day` pick (a "skip") is drawn at most once, and never
 *   alongside a log of itself or a descendant — that log would break it.
 *
 * `rng` returns [0, 1), like `Math.random`, so tests can seed it.
 */
export function suggestDailyPlan<T extends PointsHabit>(
  habits: readonly T[],
  target: number,
  rng: () => number = Math.random,
  exhausted: ReadonlySet<string> = new Set(),
): { items: SuggestionItem[]; total: number; exhausted: Set<string> } {
  const active = habits.filter((h) => !h.archivedAt);
  const isPerLog = (h: T) => h.pointsKind === "per_log" && h.pointsValue != null;
  const logOptions = active
    .filter((h) => isPerLog(h) && h.allowDirectLogging)
    .map((h) => {
      const ancestors = getAncestors(h.id, habits);
      return {
        habit: h,
        // Root first, so `alsoEarns` lists parents top-down.
        rollup: ancestors.filter((a) => !a.archivedAt && isPerLog(a)),
        // Clean-day habits a log of this one would break: itself and ancestors.
        breaks: new Set([h.id, ...ancestors.map((a) => a.id)]),
      };
    });
  const skipOptions = active.filter((h) => h.pointsKind === "clean_day" && h.pointsValue != null);

  const used = new Set(exhausted);
  const items = new Map<string, SuggestionItem>();
  const skipped = new Set<string>();
  const broken = new Set<string>();
  let total = 0;

  /** What `habit` would score right now, given caps already used up. */
  const scoreNow = (habit: T) => (used.has(habit.id) ? 0 : habit.pointsValue!);

  while (total < target) {
    const choices = [
      ...logOptions
        .filter((o) => !used.has(o.habit.id) && ![...o.breaks].some((id) => skipped.has(id)))
        .map((o) => ({ kind: "per_log" as const, ...o })),
      ...skipOptions
        .filter((h) => !skipped.has(h.id) && !broken.has(h.id))
        .map((h) => ({ kind: "clean_day" as const, habit: h, rollup: [] as T[], breaks: null })),
    ];
    if (choices.length === 0) break;
    const pick = choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))]!;

    const shares = pick.rollup
      .map((a) => ({ habitId: a.id, points: scoreNow(a) }))
      .filter((s) => s.points > 0);
    const worth = scoreNow(pick.habit) + shares.reduce((sum, s) => sum + s.points, 0);

    if (pick.kind === "per_log") {
      for (const id of pick.breaks!) broken.add(id);
      for (const h of [pick.habit, ...pick.rollup]) if (capOf(h)) used.add(h.id);
    } else {
      skipped.add(pick.habit.id);
    }

    const existing = items.get(pick.habit.id);
    if (existing) {
      existing.count += 1;
      existing.points += worth;
      for (const share of shares) {
        const prior = existing.alsoEarns.find((a) => a.habitId === share.habitId);
        if (prior) prior.points += share.points;
        else existing.alsoEarns.push(share);
      }
    } else {
      items.set(pick.habit.id, {
        habitId: pick.habit.id,
        kind: pick.kind,
        count: 1,
        points: worth,
        alsoEarns: shares,
      });
    }
    total += worth;
  }
  return { items: [...items.values()], total, exhausted: used };
}

/**
 * Suggestions for every remaining day of `sprint` (`remainingSprintDates`),
 * each aiming for the daily average rounded up. Caps carry through:
 * `per_sprint` habits that already scored in this sprint never appear, and
 * one suggested on an earlier day isn't suggested again; `per_day` habits
 * that already scored today are left out of today's list.
 */
export function suggestSprintPlan<T extends PointsHabit>(
  sprint: Pick<PointSprint, "startAt" | "endAt" | "target">,
  habits: readonly T[],
  ctx: TimeContext,
  rng: () => number = Math.random,
): { date: string; items: SuggestionItem[]; total: number }[] {
  const { total } = sprintPoints(sprint, habits, ctx);
  const target = Math.ceil(dailyAverageNeeded(sprint, total, ctx));
  if (target === 0) return [];

  const start = parseInZone(sprint.startAt, ctx.timeZone);
  const end = parseInZone(sprint.endAt, ctx.timeZone);
  const today = nowInZone(ctx).toISODate();
  const sprintUsed = new Set<string>();
  const todayUsed = new Set<string>();
  for (const habit of habits) {
    const cap = capOf(habit);
    if (!cap || !hasPoints(habit)) continue;
    for (const log of subtreeLogs(habit, habits)) {
      const t = parseInZone(log.timestamp, ctx.timeZone);
      if (t < start || t >= end) continue;
      if (cap === "per_sprint") sprintUsed.add(habit.id);
      if (cap === "per_day" && t.toISODate() === today) todayUsed.add(habit.id);
    }
  }

  return remainingSprintDates(sprint, ctx).map((date) => {
    const exhausted = new Set([...sprintUsed, ...(date === today ? todayUsed : [])]);
    const plan = suggestDailyPlan(habits, target, rng, exhausted);
    for (const id of plan.exhausted) {
      const habit = habits.find((h) => h.id === id);
      if (habit && capOf(habit) === "per_sprint") sprintUsed.add(id);
    }
    return { date, items: plan.items, total: plan.total };
  });
}
