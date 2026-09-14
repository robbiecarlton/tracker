import { buildDashboardRows, childrenOf } from "@tracker/core";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
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
import { createWebDragGhost } from "@/lib/web-drag-ghost";

type DashboardRow = { habit: ApiHabit; depth: number };

export default function Dashboard() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { habits: allHabits, loading, error, refetch, setHabits } = useHabits();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Web drag-and-drop only — none of these need to trigger a render, so
  // they all live outside React state (see the block below `applyReorder`).
  const webDrag = useRef<{ habitId: string; pointerId: number } | null>(null);
  const webRowEls = useRef<Map<string, HTMLElement>>(new Map());
  const webGhost = useRef<ReturnType<typeof createWebDragGhost> | null>(null);
  function getWebGhost() {
    if (!webGhost.current) webGhost.current = createWebDragGhost();
    return webGhost.current;
  }
  useEffect(() => () => webGhost.current?.destroy(), []);

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
   * Shared by both drag implementations below: applies a new relative order
   * for one sibling group — optimistic local update, then the real
   * mutation, falling back to a refetch on failure.
   */
  function applyReorder(parentId: string | null, orderedIds: string[]) {
    const groupSet = new Set(orderedIds);
    const habitsById = new Map<string, ApiHabit>(allHabits.map((h) => [h.id, h]));
    const reordered = [
      ...allHabits.filter((h) => !groupSet.has(h.id)),
      ...orderedIds.map((id) => habitsById.get(id)!),
    ];
    setHabits(reordered);
    reorderHabits({ parentId, orderedIds }).catch(() => refetch());
  }

  /**
   * Native (iOS): `react-native-draggable-flatlist`'s press-and-drag.
   * Dragging never changes a habit's `parentId` — only the dragged item's
   * relative order *within its real sibling group* is meaningful, however
   * odd the drop looks mid-gesture. So: pull that group's new relative
   * order out of the library's dropped flat array; `applyReorder` rebuilds
   * `allHabits` from just that, which always regenerates a
   * correctly-grouped `rows` on the next render even if the drop position
   * visually crossed into a different parent's rows.
   */
  function onNativeDragEnd({ data, from, to }: DragEndParams<DashboardRow>) {
    if (from === to) return;
    const parentId = data[to]?.habit.parentId ?? null;
    const orderedIds = data.filter((r) => r.habit.parentId === parentId).map((r) => r.habit.id);
    applyReorder(parentId, orderedIds);
  }

  /**
   * Web: hand-rolled Pointer Events drag instead of either
   * `react-native-draggable-flatlist` (gesture-handler-based drag, and even
   * plain scrolling, are unreliable on web — no dedicated web support
   * upstream) or native HTML5 drag-and-drop (`draggable`/`dragstart` —
   * react-native-web's own touch-responder system explicitly treats a
   * native `dragstart` as a cancellation signal, so the two are known to
   * fight each other by RNW's own design). Plain Pointer Events + a manual
   * `getBoundingClientRect()` hit-test sidesteps both: `setPointerCapture`
   * keeps every subsequent pointer event routed to the handle regardless of
   * gesture-handler/responder machinery elsewhere on the page, and nothing
   * here depends on the browser's own drag-gesture heuristics.
   *
   * Dropping onto a sibling from a *different* parent is ignored outright
   * (simpler than native's "snap to the real group" recovery, and just as
   * reachable — reparenting isn't a drag gesture on any platform here).
   */
  function registerWebDragHandle(habitId: string, habitName: string, node: unknown) {
    if (Platform.OS !== "web" || !node) return;
    const el = node as HTMLElement;
    el.style.cursor = "grab";
    el.onpointerdown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      webDrag.current = { habitId, pointerId: e.pointerId };
      el.style.cursor = "grabbing";
      getWebGhost().show(habitName, e.clientX, e.clientY);
    };
    el.onpointermove = (e) => {
      if (webDrag.current?.pointerId !== e.pointerId) return;
      getWebGhost().move(e.clientX, e.clientY);
    };
    const endDrag = (e: PointerEvent, shouldDrop: boolean) => {
      const drag = webDrag.current;
      webDrag.current = null;
      el.style.cursor = "grab";
      getWebGhost().hide();
      if (!drag || drag.pointerId !== e.pointerId) return;
      if (!shouldDrop) return;

      let targetId: string | null = null;
      for (const [id, rowEl] of webRowEls.current) {
        const rect = rowEl.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          targetId = id;
          break;
        }
      }
      if (!targetId || targetId === drag.habitId) return;

      const source = rows.find((r) => r.habit.id === drag.habitId);
      const target = rows.find((r) => r.habit.id === targetId);
      if (!source || !target || source.habit.parentId !== target.habit.parentId) return;

      // Which side of the target to land on depends on the drag's
      // direction: dropping onto a row *below* the source's current
      // position lands it right *after* that row; dropping onto one
      // *above* lands it right *before*. Always inserting "before" (as an
      // earlier version of this did) only ever lets you drag things up —
      // dropping A onto its very next sibling B would put A right back
      // where it started, so moving anything down past a neighbor was
      // impossible.
      const groupRows = rows.filter((r) => r.habit.parentId === source.habit.parentId);
      const movingDown =
        groupRows.findIndex((r) => r.habit.id === drag.habitId) <
        groupRows.findIndex((r) => r.habit.id === targetId);

      const orderedIds = groupRows.map((r) => r.habit.id).filter((id) => id !== drag.habitId);
      const targetIndex = orderedIds.indexOf(targetId);
      orderedIds.splice(movingDown ? targetIndex + 1 : targetIndex, 0, drag.habitId);
      applyReorder(source.habit.parentId, orderedIds);
    };
    el.onpointerup = (e) => endDrag(e, true);
    el.onpointercancel = (e) => endDrag(e, false);
  }

  function registerWebRow(habitId: string, node: unknown) {
    if (Platform.OS !== "web") return;
    if (node) webRowEls.current.set(habitId, node as HTMLElement);
    else webRowEls.current.delete(habitId);
  }

  function renderRow(
    item: DashboardRow,
    opts: {
      onDragHandleLongPress?: () => void;
      dragHandleRef?: (node: unknown) => void;
      rowRef?: (node: unknown) => void;
      isActive?: boolean;
    },
  ) {
    const childCount = childrenOf(item.habit.id, allHabits).filter((h) => !h.archivedAt).length;
    return (
      <View
        ref={opts.rowRef}
        style={{ paddingLeft: item.depth * 16, opacity: opts.isActive ? 0.85 : 1 }}
      >
        <HabitCard
          habit={item.habit}
          allHabits={allHabits}
          timeZone={user?.timeZone ?? "UTC"}
          onChanged={refetch}
          onDragHandleLongPress={opts.onDragHandleLongPress}
          dragHandleRef={opts.dragHandleRef}
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
    );
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
      ) : Platform.OS === "web" ? (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.habit.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) =>
            renderRow(item, {
              dragHandleRef: (node) => registerWebDragHandle(item.habit.id, item.habit.name, node),
              rowRef: (node) => registerWebRow(item.habit.id, node),
            })
          }
        />
      ) : (
        <DraggableFlatList
          data={rows}
          keyExtractor={(row: DashboardRow) => row.habit.id}
          contentContainerStyle={styles.list}
          onDragEnd={onNativeDragEnd}
          renderItem={({ item, drag, isActive }: RenderItemParams<DashboardRow>) => (
            <ScaleDecorator>{renderRow(item, { onDragHandleLongPress: drag, isActive })}</ScaleDecorator>
          )}
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
