import { DateTime } from "luxon";
import { z } from "zod";
import { UNITS } from "./units";

/**
 * Validation for the habit/view/log create & edit forms, shared by the
 * backend (request validation) and the mobile app (form validation) — same
 * pattern as `auth-schemas.ts`.
 */

export const viewKindSchema = z.enum(["cumulative", "streak", "percentage", "days", "since"]);

export const targetTypeSchema = z.enum(["at_least", "at_most", "exactly"]);

export const unitSchema = z.enum(UNITS);

export const habitViewInputSchema = z
  .object({
    kind: viewKindSchema,
    /** Applies to streak / percentage / days / since. Defaults to `day`. */
    unit: unitSchema.optional(),
    /** `days` view only: window size N. Defaults to 7. */
    days: z.number().int().positive().max(365).optional(),
    /** `cumulative` view only: optional total goal. */
    cumulationGoal: z.number().int().nonnegative().optional(),
    /** `days` / `percentage` views only: optional target and its direction. */
    target: z.number().optional(),
    targetType: targetTypeSchema.optional(),
  })
  .superRefine((view, ctx) => {
    if ((view.target == null) !== (view.targetType == null)) {
      ctx.addIssue({
        code: "custom",
        message: "target and targetType must be set together",
        path: ["target"],
      });
    }
    if (view.target != null && view.kind !== "days" && view.kind !== "percentage") {
      ctx.addIssue({
        code: "custom",
        message: "Targets only apply to Days and Percentage views",
        path: ["target"],
      });
    }
    if (view.days != null && view.kind !== "days") {
      ctx.addIssue({
        code: "custom",
        message: "days only applies to the Days view",
        path: ["days"],
      });
    }
    if (view.cumulationGoal != null && view.kind !== "cumulative") {
      ctx.addIssue({
        code: "custom",
        message: "cumulationGoal only applies to the Cumulative view",
        path: ["cumulationGoal"],
      });
    }
  });

export const habitFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a habit name").max(120),
  // Calendar-day granularity only — a habit's start date has no meaningful
  // time-of-day, so this is deliberately stricter than a general datetime
  // parser (native Date.parse is far too lenient here: it accepts all sorts
  // of non-ISO shapes, e.g. SQL-style "2026-08-11 00:00:00-07", that Luxon's
  // ISO 8601 parser downstream in computeHabitView correctly rejects).
  startDate: z
    .string()
    .trim()
    .min(1, "Enter a start date")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date as YYYY-MM-DD")
    .refine((s) => DateTime.fromISO(s).isValid, { message: "Enter a valid date" }),
  views: z.array(habitViewInputSchema).min(1, "Add at least one view"),
});

/**
 * Same as `habitFormSchema`, except `views` may be omitted/empty — the
 * create endpoint applies `DEFAULT_HABIT_VIEWS` in that case. The edit form
 * (`habitFormSchema`) always requires at least one view, since a habit
 * always has 1+ views once it exists.
 */
export const createHabitSchema = habitFormSchema.extend({
  views: z.array(habitViewInputSchema).optional(),
});

export const createLogSchema = z.object({
  /** ISO datetime. Omitted = server uses now(). */
  timestamp: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type ViewKindInput = z.infer<typeof viewKindSchema>;
export type HabitViewInput = z.infer<typeof habitViewInputSchema>;
export type HabitFormInput = z.infer<typeof habitFormSchema>;
export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type CreateLogInput = z.infer<typeof createLogSchema>;
