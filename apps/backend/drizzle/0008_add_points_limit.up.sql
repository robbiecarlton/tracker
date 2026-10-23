-- 0008_add_points_limit (up)
-- Per-log habits can cap how often logging scores: every log (NULL or
-- 'unlimited'), once per local day ('per_day'), or once per sprint
-- ('per_sprint'). Logging itself is never limited — only scoring, which is
-- computed client-side (@tracker/core's points.ts).

ALTER TABLE "habit" ADD COLUMN "points_limit" text;
