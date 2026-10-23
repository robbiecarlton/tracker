import type { SprintFormInput } from "@tracker/core";
import { apiFetch } from "./client";
import type { ApiSprint } from "./types";

export const listSprints = () => apiFetch<{ sprints: ApiSprint[] }>("/api/sprints");

export const createSprint = (input: SprintFormInput) =>
  apiFetch<{ sprint: ApiSprint }>("/api/sprints", { method: "POST", body: input });

export const updateSprint = (id: string, input: SprintFormInput) =>
  apiFetch<{ sprint: ApiSprint }>(`/api/sprints/${id}`, { method: "PATCH", body: input });

export const deleteSprint = (id: string) =>
  apiFetch<void>(`/api/sprints/${id}`, { method: "DELETE" });
