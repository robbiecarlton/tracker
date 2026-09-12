-- 0003_add_start_date_history (up)
-- Records every start-date change so the log view can show prior start
-- dates inline (docs/DOMAIN.md's "Start-date changes" — the "keep" path).

CREATE TABLE "habit_start_date_change" (
  "id" text PRIMARY KEY,
  "habit_id" text NOT NULL REFERENCES "habit" ("id") ON DELETE CASCADE,
  "previous_start_date" timestamptz NOT NULL,
  "new_start_date" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "habit_start_date_change_habit_id_idx" ON "habit_start_date_change" ("habit_id");
