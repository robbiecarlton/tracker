-- 0005_add_habit_sort_order (up)
-- Custom drag-to-reorder: an explicit per-sibling-group order, instead of
-- relying on whatever order Postgres happens to return. See docs/DOMAIN.md.

ALTER TABLE "habit" ADD COLUMN "sort_order" integer NOT NULL DEFAULT 0;

-- Backfill existing rows to their current de-facto order (insertion order,
-- via created_at) so nothing visibly reshuffles the first time this ships.
UPDATE "habit" SET "sort_order" = ranked.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, parent_id ORDER BY created_at) - 1 AS rn
  FROM "habit"
) ranked
WHERE "habit".id = ranked.id;
