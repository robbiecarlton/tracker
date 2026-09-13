-- 0004_add_habit_nesting (down)

DROP INDEX IF EXISTS "habit_parent_id_idx";
ALTER TABLE "habit" DROP COLUMN "allow_direct_logging";
ALTER TABLE "habit" DROP COLUMN "parent_id";
