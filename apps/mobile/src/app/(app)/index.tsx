import { buildDashboardRows, childrenOf } from "@tracker/core";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import DraggableFlatList, {
  ScaleDecorator,
  type DragEndParams,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { reorderHabits } from "@/api/habits";
import type { ApiHabit } from "@/api/types";
import { HabitCard } from "@/components/HabitCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHabits } from "@/hooks/useHabits";
import { signOut } from "@/lib/auth";
import { getCollapsedHabitIds, setCollapsedHabitIds } from "@/lib/expanded-habits";
import { theme } from "@/lib/theme";

type DashboardRow = { habit: ApiHabit; depth: number };

export default function Dashboard() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { habits: allHabits, loading, error, refetch, setHabits } = useHabits();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // The dashboard, create/edit/log screens each own an independent fetch —
  // there's no shared cache yet (see useHabits' doc comment) — so refetch
  // whenever this screen regains focus (e.g. navigating back after an edit).
  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Collapsed/expanded state is local-only (AsyncStorage, not synced) —
  // loaded once on mount, not on every focus.
  useEffect(() => {
    getCollapsedHabitIds().then(setCollapsed);
  }, []);

  function toggleCollapsed(habitId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(habitId)) next.delete(habitId);
      else next.add(habitId);
      setCollapsedHabitIds(next);
      return next;
    });
  }

  const rows = buildDashboardRows(allHabits, collapsed);

  /**
   * Dragging never changes a habit's `parentId` — only the dragged item's
   * relative order *within its real sibling group* is meaningful, however
   * odd the drop looks mid-gesture. So: pull that group's new relative
   * order out of the library's dropped flat array, then rebuild `allHabits`
   * with that group's members appended (in their new order) after
   * everyone else — `buildDashboardRows`/`childrenOf` only ever care about
   * within-group relative order, never cross-group interleaving, so this
   * always regenerates a correctly-grouped `rows` on the next render, even
   * if the drop position visually crossed into a different parent's rows.
   */
  function onDragEnd({ data, from, to }: DragEndParams<DashboardRow>) {
    if (from === to) return;
    const parentId = data[to]?.habit.parentId ?? null;
    const orderedIds = data.filter((r) => r.habit.parentId === parentId).map((r) => r.habit.id);

    const groupSet = new Set(orderedIds);
    const habitsById = new Map<string, ApiHabit>(allHabits.map((h) => [h.id, h]));
    const reordered = [
      ...allHabits.filter((h) => !groupSet.has(h.id)),
      ...orderedIds.map((id) => habitsById.get(id)!),
    ];
    setHabits(reordered);

    reorderHabits({ parentId, orderedIds }).catch(() => refetch());
  }

  async function onSignOut() {
    await signOut();
    router.replace("/(auth)/sign-in");
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Habits</Text>
        <View style={styles.headerLinks}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/habits/archived")}>
            <Text style={styles.archivedLink}>Archived</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push("/habits/new")}>
            <Text style={styles.addLink}>+ New</Text>
          </Pressable>
        </View>
      </View>

      {loading && rows.length === 0 ? (
        <ActivityIndicator style={styles.spinner} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>No habits yet — tap &ldquo;+ New&rdquo; to add one.</Text>
      ) : (
        <DraggableFlatList
          data={rows}
          keyExtractor={(row: DashboardRow) => row.habit.id}
          contentContainerStyle={styles.list}
          onDragEnd={onDragEnd}
          renderItem={({ item, drag, isActive }: RenderItemParams<DashboardRow>) => {
            const childCount = childrenOf(item.habit.id, allHabits).filter(
              (h) => !h.archivedAt,
            ).length;
            return (
              <ScaleDecorator>
                <View style={{ paddingLeft: item.depth * 16, opacity: isActive ? 0.85 : 1 }}>
                  <HabitCard
                    habit={item.habit}
                    allHabits={allHabits}
                    timeZone={user?.timeZone ?? "UTC"}
                    onChanged={refetch}
                    onDragHandleLongPress={drag}
                  />
                  {childCount > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => toggleCollapsed(item.habit.id)}
                      style={styles.expandToggle}
                    >
                      <Text style={styles.expandToggleText}>
                        {collapsed.has(item.habit.id) ? "▸" : "▾"} {childCount}{" "}
                        {childCount === 1 ? "subhabit" : "subhabits"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </ScaleDecorator>
            );
          }}
        />
      )}

      <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 60 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  heading: { fontSize: 28, fontWeight: "700", color: theme.colors.text.primary },
  headerLinks: { flexDirection: "row", alignItems: "center", gap: 16 },
  archivedLink: { color: theme.colors.text.muted, fontSize: 14 },
  addLink: { color: theme.colors.brand, fontWeight: "600", fontSize: 16 },
  spinner: { marginTop: 40 },
  error: { color: theme.colors.error, textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
  empty: {
    color: theme.colors.text.muted,
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 20,
  },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  expandToggle: { paddingVertical: 8, paddingHorizontal: 4 },
  expandToggleText: { color: theme.colors.text.muted, fontSize: 13, fontWeight: "600" },
  signOut: { alignItems: "center", paddingVertical: 16 },
  signOutText: { color: theme.colors.text.muted, fontSize: 14 },
});
