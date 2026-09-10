/**
 * Time units a habit view can be measured in. `day` is the default everywhere.
 * The actual boundary math (what counts as "one unit ago" in a given IANA
 * timezone) lands in Phase 2 alongside the view calculations.
 */
export const UNITS = ["hour", "day", "week", "month"] as const;

export type Unit = (typeof UNITS)[number];

export const DEFAULT_UNIT: Unit = "day";

export function isUnit(value: unknown): value is Unit {
  return typeof value === "string" && (UNITS as readonly string[]).includes(value);
}
