import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Better Auth core tables (`user`/`session`/`account`/`verification`, plus a
 * `timezone` column on `user`) and the app's own habit-tracking tables
 * (`habit`/`habit_view`/`habit_log`, added in Phase 3;
 * `habit_start_date_change`, added in Phase 4).
 *
 * This mirrors `drizzle/0001_init.up.sql`, `drizzle/0002_add_habits.up.sql`,
 * `drizzle/0003_add_start_date_history.up.sql`, and
 * `drizzle/0004_add_habit_nesting.up.sql`, which are the source of truth for
 * the DDL (we run plain-SQL migrations). Keep the SQL and this file in sync
 * when the schema changes: `npm run db:generate -- <name>` scaffolds the
 * migration files.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** IANA timezone captured at signup; drives unit-boundary math for views. */
  timezone: text("timezone").notNull().default("UTC"),
  ...timestamps,
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const habit = pgTable(
  "habit",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /**
     * Self-referential FK for nested habits (subhabits) — `RESTRICT` is a
     * safety net, since app code always resolves a habit's children (delete
     * together, or null out `parentId`) inside the same transaction before
     * removing it. See `docs/DOMAIN.md`'s "Nested habits" and
     * `packages/core/src/habit-tree.ts`.
     */
    parentId: text("parent_id").references((): AnyPgColumn => habit.id, {
      onDelete: "restrict",
    }),
    /** Only meaningful when this habit has ≥1 subhabit — see `habit-tree.ts`. */
    allowDirectLogging: boolean("allow_direct_logging").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("habit_user_id_idx").on(t.userId), index("habit_parent_id_idx").on(t.parentId)],
);

export const habitView = pgTable(
  "habit_view",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habit.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    unit: text("unit"),
    days: integer("days"),
    cumulationGoal: integer("cumulation_goal"),
    target: doublePrecision("target"),
    targetType: text("target_type"),
    ...timestamps,
  },
  (t) => [index("habit_view_habit_id_idx").on(t.habitId)],
);

export const habitLog = pgTable(
  "habit_log",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habit.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("habit_log_habit_id_idx").on(t.habitId)],
);

/** One row per start-date edit — see `docs/DOMAIN.md`'s "Start-date changes". */
export const habitStartDateChange = pgTable(
  "habit_start_date_change",
  {
    id: text("id").primaryKey(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habit.id, { onDelete: "cascade" }),
    previousStartDate: timestamp("previous_start_date", { withTimezone: true }).notNull(),
    newStartDate: timestamp("new_start_date", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("habit_start_date_change_habit_id_idx").on(t.habitId)],
);

export const schema = {
  user,
  session,
  account,
  verification,
  habit,
  habitView,
  habitLog,
  habitStartDateChange,
};
