-- 0004_add_habit_nesting (up)
-- Nested habits: a habit can have a parent habit (arbitrarily deep), and a
-- parent can disable being logged directly. See docs/DOMAIN.md.

ALTER TABLE "habit" ADD COLUMN "parent_id" text REFERENCES "habit" ("id") ON DELETE RESTRICT;
ALTER TABLE "habit" ADD COLUMN "allow_direct_logging" boolean NOT NULL DEFAULT true;

CREATE INDEX "habit_parent_id_idx" ON "habit" ("parent_id");
