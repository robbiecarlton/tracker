import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Two independent local-only (per-device, AsyncStorage — backed by
 * `localStorage` on web, not synced) collapse states for the dashboard,
 * each following the same "default expanded, only remember the
 * exceptions" shape: an empty/missing/corrupt value just means "nothing
 * collapsed."
 * - which habits' *subhabits* are hidden (`getCollapsedHabitIds`/
 *   `setCollapsedHabitIds`)
 * - which habits' *own content* — tiles/heatmap/actions/Edit links — is
 *   hidden while its subhabits keep showing (`getCollapsedContentHabitIds`/
 *   `setCollapsedContentHabitIds`) — "just show me the children, not this
 *   one's own aggregate."
 */
function createIdSetStorage(storageKey: string): {
  get: () => Promise<Set<string>>;
  set: (ids: ReadonlySet<string>) => Promise<void>;
} {
  return {
    async get() {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!raw) return new Set();
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed)
          ? new Set(parsed.filter((v) => typeof v === "string"))
          : new Set();
      } catch {
        return new Set();
      }
    },
    async set(ids) {
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify([...ids]));
      } catch {
        // Best-effort — a failed write just means collapse state won't
        // survive a reload, not worth surfacing to the user.
      }
    },
  };
}

const childrenStorage = createIdSetStorage("tracker.collapsedHabitIds");
export const getCollapsedHabitIds = childrenStorage.get;
export const setCollapsedHabitIds = childrenStorage.set;

const contentStorage = createIdSetStorage("tracker.collapsedContentHabitIds");
export const getCollapsedContentHabitIds = contentStorage.get;
export const setCollapsedContentHabitIds = contentStorage.set;
