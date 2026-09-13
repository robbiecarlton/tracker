import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persists which habits' subhabits are currently collapsed on the dashboard —
 * local-only, per-device (AsyncStorage; backed by `localStorage` on web), not
 * synced. Default is expanded, so we only ever need to remember the
 * exceptions (the collapsed set), and an empty/missing/corrupt value just
 * means "everything expanded."
 */
const STORAGE_KEY = "tracker.collapsedHabitIds";

export async function getCollapsedHabitIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v) => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export async function setCollapsedHabitIds(ids: ReadonlySet<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Best-effort — a failed write just means collapse state won't survive
    // a reload, not worth surfacing to the user.
  }
}
