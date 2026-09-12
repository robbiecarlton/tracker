import { DateTime } from "luxon";

/**
 * Raw ISO ⇄ human display ⇄ user-typed local text for a log's timestamp.
 * A different concern from `view-format.ts` (which formats a computed
 * `ViewResult`, not raw dates) — a log's timestamp carries a time-of-day
 * that must be interpreted in the user's zone before crossing the API
 * boundary as a UTC instant, unlike a bare calendar date (the habit
 * start-date field's *value* needs no such conversion — see
 * `@tracker/core`'s `habitFormSchema`). Its *default value* still needs the
 * user's zone, though: "today" isn't the same date everywhere at once, so
 * `todayInZone` below exists for that one purpose.
 */

const INPUT_FORMAT = "yyyy-MM-dd HH:mm";

/**
 * Today's calendar date in the user's timezone, as "YYYY-MM-DD". Used for a
 * new habit's default start date — `new Date().toISOString().slice(0, 10)`
 * gives *UTC's* current date, which is the wrong day for anyone west of UTC
 * once it's evening locally (e.g. 8pm Sept 11 in America/Denver is already
 * Sept 12 in UTC).
 */
export function todayInZone(timeZone: string): string {
  return DateTime.now().setZone(timeZone).toFormat("yyyy-MM-dd");
}

/** Display string for a log row, e.g. "Sep 11, 2026, 3:45 PM". */
export function formatLogTimestamp(iso: string, timeZone: string): string {
  return DateTime.fromISO(iso, { zone: timeZone }).toLocaleString(DateTime.DATETIME_MED);
}

/** Display string for a calendar date only, e.g. "Sep 11, 2026". */
export function formatCalendarDate(iso: string, timeZone: string): string {
  return DateTime.fromISO(iso, { zone: timeZone }).toLocaleString(DateTime.DATE_MED);
}

/**
 * Parses a "YYYY-MM-DD HH:mm" string typed by the user, interpreted in their
 * timezone, into a UTC ISO string ready for the API. Returns `null` if the
 * text doesn't match that shape or isn't a real date/time.
 */
export function parseLogTimestampInput(text: string, timeZone: string): string | null {
  const trimmed = text.trim();
  const dt = DateTime.fromFormat(trimmed, INPUT_FORMAT, { zone: timeZone });
  return dt.isValid ? dt.toUTC().toISO() : null;
}

/** The reverse of `parseLogTimestampInput` — prefills the edit form's text field. */
export function formatLogTimestampInput(iso: string, timeZone: string): string {
  return DateTime.fromISO(iso, { zone: timeZone }).toFormat(INPUT_FORMAT);
}
