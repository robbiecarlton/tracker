import { useCallback, useState } from "react";
import { listHabits } from "@/api/habits";
import type { ApiHabit } from "@/api/types";

/**
 * Owns the dashboard's one list query. Plain hooks rather than a data-fetching
 * library: there's exactly one query and a handful of mutations that all
 * touch the same list, so `useState` + manual `refetch()` covers it with far
 * less surface than wiring a library for one query key. Revisit in Phase 5
 * when the offline outbox needs real caching/optimistic-update infrastructure.
 *
 * Doesn't fetch on its own — callers trigger the initial load (and refresh on
 * return-to-screen) via `useFocusEffect(() => { refetch(); }, [refetch])` in
 * the consuming screen, since `expo-router`'s `useFocusEffect` isn't a plain
 * `useEffect` and doesn't trip the "no setState in an effect body" lint rule
 * a directly-fetching `useEffect` here would.
 *
 * `setHabits` is exposed as an escape hatch for optimistic local updates
 * that don't warrant a full round trip before the UI reflects them (e.g.
 * drag-to-reorder on the dashboard) — callers still fire the real mutation
 * separately and fall back to `refetch()` on failure.
 */
export function useHabits(): {
  habits: ApiHabit[];
  loading: boolean;
  error: string | undefined;
  refetch: () => Promise<void>;
  setHabits: (habits: ApiHabit[]) => void;
} {
  const [habits, setHabits] = useState<ApiHabit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await listHabits();
      setHabits(result.habits);
    } catch {
      setError("Couldn't load your habits. Pull to refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { habits, loading, error, refetch, setHabits };
}
