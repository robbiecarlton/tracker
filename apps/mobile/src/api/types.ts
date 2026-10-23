import type { Habit, HabitLog, HabitStartDateChange, PointSprint } from "@tracker/core";

/** A `Habit` as returned by `GET /api/habits` — includes its logs and start-date history nested. */
export type ApiHabit = Habit & { logs: HabitLog[]; startDateHistory: HabitStartDateChange[] };

/** A Point Sprint as returned by `GET /api/sprints` — no extra nesting. */
export type ApiSprint = PointSprint;
