import type { Habit, HabitLog, HabitStartDateChange } from "@tracker/core";

/** A `Habit` as returned by `GET /api/habits` — includes its logs and start-date history nested. */
export type ApiHabit = Habit & { logs: HabitLog[]; startDateHistory: HabitStartDateChange[] };
