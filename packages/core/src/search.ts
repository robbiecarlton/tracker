/**
 * Fuzzy ordered-subsequence matching (fzf-style) — used by the mobile
 * dashboard's habit search (`habit-tree.ts`'s `searchHabits`). A query
 * matches a target when every query character appears somewhere in the
 * target, in the same order, not necessarily contiguous — so `"exru"`,
 * `"xrun"`, and `"ru"` all match `"Exercise Run"`, same as `"heaerun"`
 * matches `"Be Healthy Exercise Run"`.
 */
export function fuzzySubsequenceMatch(query: string, target: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}
