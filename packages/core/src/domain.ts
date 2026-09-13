import type { Unit } from "./units";

/**
 * Domain model types. Phase 2 added the behaviour (view calculations, target
 * evaluation, highlight colour — see `views.ts`/`targets.ts`/`highlight.ts`).
 * Phase 3 makes these real, individually-addressable DB rows. See
 * `docs/DOMAIN.md` for the full spec.
 */

export type ViewKind = "cumulative" | "streak" | "percentage" | "days" | "since";

/** Direction of an optional target on `days` / `percentage` views. */
export type TargetType = "at_least" | "at_most" | "exactly";

export interface HabitView {
  id: string;
  habitId: string;
  kind: ViewKind;
  /** Applies to streak / percentage / days / since. Defaults to `day`. */
  unit?: Unit;
  /** `days` view: window size N. Defaults to 7. */
  days?: number;
  /** `cumulative` view: optional total goal. */
  cumulationGoal?: number;
  /** `days` / `percentage` views: optional target and its direction. */
  target?: number;
  targetType?: TargetType;
  createdAt: string;
  updatedAt: string;
}

/** A new habit defaults to these two views (docs/DOMAIN.md). */
export const DEFAULT_HABIT_VIEWS: ReadonlyArray<Pick<HabitView, "kind" | "unit">> = [
  { kind: "cumulative", unit: "day" },
  { kind: "days", unit: "day" }, // days defaults to N=7 when `days` is omitted
];

export interface Habit {
  id: string;
  userId: string;
  name: string;
  /** Current start date. Prior start dates are retained on the logs timeline. */
  startDate: string;
  views: HabitView[];
  archivedAt: string | null;
  /**
   * Nested habits (subhabits) — see `docs/DOMAIN.md`'s "Nested habits" and
   * `habit-tree.ts`. `null` means top-level. Logging a habit also counts
   * toward every ancestor's view calculations, transitively.
   */
  parentId: string | null;
  /**
   * When `false`, this habit can only be logged via a subhabit — only
   * meaningful (and only settable) once it has ≥1 non-archived subhabit.
   */
  allowDirectLogging: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  /** When the habit was performed (not necessarily when it was recorded). */
  timestamp: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Immutable audit record of one start-date edit (Phase 4's "keep" path —
 * see docs/DOMAIN.md's "Start-date changes"). Never itself updated after
 * creation; `updatedAt` is retained only for shape-consistency with
 * `HabitView`/`HabitLog` and will always equal `createdAt`.
 */
export interface HabitStartDateChange {
  id: string;
  habitId: string;
  /** The start date this habit had immediately before this change. */
  previousStartDate: string;
  /** The start date it changed to. */
  newStartDate: string;
  createdAt: string;
  updatedAt: string;
}
