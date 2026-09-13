import type { HabitLog } from "./domain";

/**
 * Pure tree helpers for nested habits (subhabits) — see `docs/DOMAIN.md`'s
 * "Nested habits". Shared by the backend (delete/patch validation, which
 * only has `id`/`parentId`/`archivedAt` on hand) and the mobile app
 * (dashboard render, log aggregation, pickers, delete/archive confirmation,
 * which have full `Habit`-shaped objects). Every function is generic over
 * `T extends HabitNode` so callers keep whatever extra fields their own
 * objects carry (e.g. mobile's `ApiHabit` with `logs`/`views`) through the
 * return value, instead of being narrowed down to bare `Habit`s.
 */

/** The minimum shape these helpers need — a real `Habit` satisfies this. */
export interface HabitNode {
  id: string;
  parentId: string | null;
  archivedAt: string | null;
}

/** One habit plus its distance (in parent-hops) from some reference habit. */
export interface HabitAtDepth<T extends HabitNode> {
  habit: T;
  depth: number;
}

/** Direct children of `parentId` (pass `null` for top-level habits), in input order. */
export function childrenOf<T extends HabitNode>(
  parentId: string | null,
  habits: readonly T[],
): T[] {
  return habits.filter((h) => h.parentId === parentId);
}

/**
 * Every descendant of `habitId` — children, grandchildren, etc., arbitrarily
 * deep — each tagged with its depth below `habitId` (direct children = 1).
 * Depth-first, so a subtree's members stay contiguous in the result.
 */
export function getDescendants<T extends HabitNode>(
  habitId: string,
  habits: readonly T[],
): HabitAtDepth<T>[] {
  const result: HabitAtDepth<T>[] = [];
  function walk(parentId: string, depth: number) {
    for (const child of childrenOf(parentId, habits)) {
      result.push({ habit: child, depth });
      walk(child.id, depth + 1);
    }
  }
  walk(habitId, 1);
  return result;
}

/**
 * True if setting `habitId`'s parent to `proposedParentId` would create a
 * cycle — i.e. `proposedParentId` is `habitId` itself, or already one of its
 * own descendants. Doesn't check ownership/existence — callers do that
 * separately (they need a DB round trip either way).
 */
export function wouldCreateCycle<T extends HabitNode>(
  habitId: string,
  proposedParentId: string,
  habits: readonly T[],
): boolean {
  if (proposedParentId === habitId) return true;
  return getDescendants(habitId, habits).some((d) => d.habit.id === proposedParentId);
}

/**
 * `habitId`'s own logs plus every **non-archived** descendant's logs,
 * flattened — this is what a habit's view calculations should run over once
 * it has subhabits (logging a subhabit counts toward every ancestor,
 * transitively). An archived descendant's logs stop counting, matching how
 * an archived top-level habit already leaves the active dashboard. Each
 * `HabitLog` already carries its own `habitId`, so callers can always tell
 * which habit a given log actually came from.
 */
export function aggregatedLogs<T extends HabitNode & { logs: readonly HabitLog[] }>(
  habitId: string,
  habits: readonly T[],
): HabitLog[] {
  const target = habits.find((h) => h.id === habitId);
  if (!target) return [];

  // Own walk rather than `getDescendants` — an archived node's whole subtree
  // needs to detach (matching `buildDashboardRows`), not just its own logs,
  // so descending into an archived node's children must stop, not just skip
  // adding that one node's logs.
  const logs: HabitLog[] = [...target.logs];
  function walk(parentId: string) {
    for (const child of childrenOf(parentId, habits)) {
      if (child.archivedAt) continue;
      logs.push(...child.logs);
      walk(child.id);
    }
  }
  walk(habitId);
  return logs;
}

/**
 * Flattens a user's habit tree into the depth-first, indented row order the
 * dashboard renders: each top-level habit immediately followed by its
 * visible children/grandchildren/…, skipping any subtree currently
 * collapsed and any archived habit at any level. `collapsed` holds the ids
 * of habits whose children are currently hidden (default is expanded, so an
 * empty set shows everything). Callers should pre-filter `habits` to
 * non-archived themselves if `habits` might include archived ones — this
 * only filters the *children* it walks into, mirroring `aggregatedLogs`'s
 * "archived detaches its subtree from the active view" rule.
 */
export function buildDashboardRows<T extends HabitNode>(
  habits: readonly T[],
  collapsed: ReadonlySet<string>,
): HabitAtDepth<T>[] {
  const rows: HabitAtDepth<T>[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const habit of childrenOf(parentId, habits)) {
      if (habit.archivedAt) continue;
      rows.push({ habit, depth });
      if (!collapsed.has(habit.id)) walk(habit.id, depth + 1);
    }
  }
  walk(null, 0);
  return rows;
}
