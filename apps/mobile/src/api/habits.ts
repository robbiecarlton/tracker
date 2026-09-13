import type {
  CreateHabitInput,
  CreateLogInput,
  HabitFormInput,
  HabitLog,
  ReorderHabitsInput,
  UpdateLogInput,
} from "@tracker/core";
import { apiFetch } from "./client";
import type { ApiHabit } from "./types";

export const listHabits = () => apiFetch<{ habits: ApiHabit[] }>("/api/habits");

export const createHabit = (input: CreateHabitInput) =>
  apiFetch<{ habit: ApiHabit }>("/api/habits", { method: "POST", body: input });

export const updateHabit = (id: string, input: HabitFormInput) =>
  apiFetch<{ habit: ApiHabit }>(`/api/habits/${id}`, { method: "PATCH", body: input });

/** Persists a drag-reorder — `orderedIds` must be exactly the current sibling group's ids. */
export const reorderHabits = (input: ReorderHabitsInput) =>
  apiFetch<{ habits: ApiHabit[] }>("/api/habits/reorder", { method: "PATCH", body: input });

/** How to resolve a habit's active subhabits when it's deleted or archived. */
type ChildrenAction = "cascade" | "top_level" | "grandparent";

export const deleteHabit = (id: string, options?: { childrenAction?: ChildrenAction }) =>
  apiFetch<void>(
    `/api/habits/${id}${options?.childrenAction ? `?childrenAction=${options.childrenAction}` : ""}`,
    { method: "DELETE" },
  );

export const createLog = (habitId: string, input: CreateLogInput) =>
  apiFetch<{ log: HabitLog }>(`/api/habits/${habitId}/logs`, { method: "POST", body: input });

export const updateLog = (habitId: string, logId: string, input: UpdateLogInput) =>
  apiFetch<{ log: HabitLog }>(`/api/habits/${habitId}/logs/${logId}`, {
    method: "PATCH",
    body: input,
  });

export const deleteLog = (habitId: string, logId: string) =>
  apiFetch<void>(`/api/habits/${habitId}/logs/${logId}`, { method: "DELETE" });

export const archiveHabit = (id: string, options?: { childrenAction?: ChildrenAction }) =>
  apiFetch<{ habit: ApiHabit }>(
    `/api/habits/${id}/archive${
      options?.childrenAction ? `?childrenAction=${options.childrenAction}` : ""
    }`,
    { method: "POST" },
  );

export const unarchiveHabit = (id: string) =>
  apiFetch<{ habit: ApiHabit }>(`/api/habits/${id}/unarchive`, { method: "POST" });

export const archiveAndCloneHabit = (id: string, input: HabitFormInput) =>
  apiFetch<{ archivedHabit: ApiHabit; newHabit: ApiHabit }>(`/api/habits/${id}/archive-and-clone`, {
    method: "POST",
    body: input,
  });
