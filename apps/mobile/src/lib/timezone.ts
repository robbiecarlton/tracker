/**
 * Resolve the device's IANA timezone (e.g. "Europe/London"). Falls back to
 * "UTC" if the runtime can't tell us. Pure — safe to unit test.
 */
export function getDeviceTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return normalizeTimeZone(tz);
  } catch {
    return "UTC";
  }
}

export function normalizeTimeZone(input: string | null | undefined): string {
  const value = (input ?? "").trim();
  return value.length > 0 ? value : "UTC";
}
