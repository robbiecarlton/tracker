import { getDescendants, searchHabits } from "@tracker/core";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ApiHabit } from "@/api/types";
import { nodeBackgroundForDepth, nodeBoxStyles } from "@/lib/node-box";
import { theme } from "@/lib/theme";
import { HabitCard } from "./HabitCard";

/**
 * The dashboard's search results — a **flat** list (no nesting) of every
 * habit whose full path (its own name plus every ancestor's, in order)
 * fuzzy-matches `query` (`searchHabits`, `@tracker/core`), grouped by
 * nesting depth ascending: top-level matches first, then depth-1, etc. —
 * so a match that's less nested always shows above its own matching
 * children, per the dashboard's own visual hierarchy.
 *
 * Each result reuses the normal expanded `HabitCard` as-is (Edit, +
 * Subhabit, tiles, heatmap, Log, +note, Logs) — just without a drag handle
 * or the content-collapse toggle, neither of which mean anything outside a
 * real sibling group. A small breadcrumb above the card names its
 * ancestors, and a "N subhabits" line below it mirrors the dashboard's own
 * expand-toggle count (informational only here — there's nothing to
 * expand in a flat list).
 */
export function SearchResults({
  query,
  allHabits,
  timeZone,
  onChanged,
}: {
  query: string;
  allHabits: ApiHabit[];
  timeZone: string;
  onChanged: () => void | Promise<void>;
}) {
  const groups = searchHabits(query, allHabits);

  if (groups.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.empty}>No habits match &ldquo;{query.trim()}&rdquo;.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.list}>
        {groups.flat().map(({ habit, depth, ancestors }) => {
          const descendantCount = getDescendants(habit.id, allHabits).filter(
            (d) => !d.habit.archivedAt,
          ).length;

          return (
            <View
              key={habit.id}
              style={[nodeBoxStyles.nodeBox, { backgroundColor: nodeBackgroundForDepth(depth) }]}
            >
              {ancestors.length > 0 ? (
                <Text style={styles.breadcrumb}>
                  {ancestors.map((a) => a.name).join(" › ")} ›
                </Text>
              ) : null}
              <HabitCard habit={habit} allHabits={allHabits} timeZone={timeZone} onChanged={onChanged} />
              {descendantCount > 0 ? (
                <Text style={styles.subhabitCount}>
                  {descendantCount} {descendantCount === 1 ? "subhabit" : "subhabits"}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Mirrors `(app)/index.tsx`'s own `scrollContent` — the only container
  // in this view that needs side/bottom padding.
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  list: { gap: 12 },
  breadcrumb: { color: theme.colors.text.faint, fontSize: 12 },
  subhabitCount: { color: theme.colors.text.muted, fontSize: 13, fontWeight: "600" },
  emptyContainer: { paddingHorizontal: 20, marginTop: 40 },
  empty: { color: theme.colors.text.muted, textAlign: "center" },
});
