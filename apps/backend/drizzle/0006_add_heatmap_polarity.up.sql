-- 0006_add_heatmap_polarity (up)
-- Heatmap views can now pick their cell color: positive (green), neutral
-- (the original blue), or negative (red). Nullable — an existing/omitted
-- value means "neutral", applied at read time (`DEFAULT_HEATMAP_POLARITY`
-- in @tracker/core), same as `unit`/`days` default elsewhere in this table.

ALTER TABLE "habit_view" ADD COLUMN "heatmap_polarity" text;
