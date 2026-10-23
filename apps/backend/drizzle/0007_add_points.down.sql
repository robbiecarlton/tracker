-- 0007_add_points (down)

DROP TABLE IF EXISTS "point_sprint";

ALTER TABLE "habit" DROP CONSTRAINT IF EXISTS "habit_points_pair_check";
ALTER TABLE "habit" DROP COLUMN "points_value";
ALTER TABLE "habit" DROP COLUMN "points_kind";
