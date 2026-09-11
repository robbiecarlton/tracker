import type { CreateHabitInput, CreateLogInput, HabitFormInput, HabitLog } from "@tracker/core";
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
