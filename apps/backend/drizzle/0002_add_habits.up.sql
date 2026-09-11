-- 0002_add_habits (up)
-- Habit / view / log tables.

CREATE TABLE "habit" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "start_date" timestamptz NOT NULL,
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "habit_view" (
  "id" text PRIMARY KEY,
  "habit_id" text NOT NULL REFERENCES "habit" ("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "unit" text,
  "days" integer,
  "cumulation_goal" integer,
  "target" double precision,
  "target_type" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "habit_log" (
  "id" text PRIMARY KEY,
  "habit_id" text NOT NULL REFERENCES "habit" ("id") ON DELETE CASCADE,
  "timestamp" timestamptz NOT NULL,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "habit_user_id_idx" ON "habit" ("user_id");
CREATE INDEX "habit_view_habit_id_idx" ON "habit_view" ("habit_id");
CREATE INDEX "habit_log_habit_id_idx" ON "habit_log" ("habit_id");
