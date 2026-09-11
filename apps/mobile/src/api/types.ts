import type { Habit, HabitLog } from "@tracker/core";

/** A `Habit` as returned by `GET /api/habits` — includes its logs nested. */
export type ApiHabit = Habit & { logs: HabitLog[] };
