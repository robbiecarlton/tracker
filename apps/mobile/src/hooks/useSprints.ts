import { useCallback, useState } from "react";
import { listSprints } from "@/api/sprints";
import type { ApiSprint } from "@/api/types";

/**
 * The user's Point Sprints — same plain-hooks shape as `useHabits` (see its
 * doc comment), including not fetching on its own: callers `refetch()` from
 * `useFocusEffect`.
 */
export function useSprints(): {
  sprints: ApiSprint[];
  loading: boolean;
  error: string | undefined;
  refetch: () => Promise<void>;
} {
  const [sprints, setSprints] = useState<ApiSprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await listSprints();
      setSprints(result.sprints);
    } catch {
      setError("Couldn't load your sprints.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { sprints, loading, error, refetch };
}
