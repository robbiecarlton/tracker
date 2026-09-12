import type {
  CreateHabitInput,
  CreateLogInput,
  HabitFormInput,
  HabitLog,
  UpdateLogInput,
} from "@tracker/core";
import { apiFetch } from "./client";
import type { ApiHabit } from "./types";

export const listHabits = () => apiFetch<{ habits: ApiHabit[] }>("/api/habits");

export const createHabit = (input: CreateHabitInput) =>
  apiFetch<{ habit: ApiHabit }>("/api/habits", { method: "POST", body: input });

export const updateHabit = (id: string, input: HabitFormInput) =>
  apiFetch<{ habit: ApiHabit }>(`/api/habits/${id}`, { method: "PATCH", body: input });

export const deleteHabit = (id: string) =>
  apiFetch<void>(`/api/habits/${id}`, { method: "DELETE" });

export const createLog = (habitId: string, input: CreateLogInput) =>
  apiFetch<{ log: HabitLog }>(`/api/habits/${habitId}/logs`, { method: "POST", body: input });

export const updateLog = (habitId: string, logId: string, input: UpdateLogInput) =>
  apiFetch<{ log: HabitLog }>(`/api/habits/${habitId}/logs/${logId}`, {
    method: "PATCH",
    body: input,
  });

export const deleteLog = (habitId: string, logId: string) =>
  apiFetch<void>(`/api/habits/${habitId}/logs/${logId}`, { method: "DELETE" });

export const archiveHabit = (id: string) =>
  apiFetch<{ habit: ApiHabit }>(`/api/habits/${id}/archive`, { method: "POST" });

export const unarchiveHabit = (id: string) =>
  apiFetch<{ habit: ApiHabit }>(`/api/habits/${id}/unarchive`, { method: "POST" });

export const archiveAndCloneHabit = (id: string, input: HabitFormInput) =>
  apiFetch<{ archivedHabit: ApiHabit; newHabit: ApiHabit }>(`/api/habits/${id}/archive-and-clone`, {
    method: "POST",
    body: input,
  });
