import type { Unit } from "./units";

/**
 * Domain model type stubs. These describe the shape of the data the app works
 * with; the behaviour (view calculations, target evaluation, highlight colour)
 * is implemented in Phase 2. See `docs/DOMAIN.md` for the full spec.
 */

export type ViewKind = "cumulative" | "streak" | "percentage" | "days" | "since";

/** Direction of an optional target on `days` / `percentage` views. */
export type TargetType = "at_least" | "at_most" | "exactly";

export interface HabitView {
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
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  /** Current start date. Prior start dates are retained on the logs timeline. */
  startDate: string;
  views: HabitView[];
  archivedAt: string | null;
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
