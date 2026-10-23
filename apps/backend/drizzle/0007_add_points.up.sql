-- 0007_add_points (up)
-- Point Sprints (docs/DOMAIN.md's "Points & sprints"): a habit can earn
-- points per log or per clean day, and a sprint is a window with a points
-- target. Totals are computed client-side from logs — nothing earned is
-- stored.

ALTER TABLE "habit" ADD COLUMN "points_kind" text;
ALTER TABLE "habit" ADD COLUMN "points_value" integer;
ALTER TABLE "habit" ADD CONSTRAINT "habit_points_pair_check"
  CHECK (("points_kind" IS NULL) = ("points_value" IS NULL));

CREATE TABLE "point_sprint" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "name" text,
  "start_at" timestamptz NOT NULL,
  "end_at" timestamptz NOT NULL,
  "target" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "point_sprint_user_id_idx" ON "point_sprint" ("user_id");
