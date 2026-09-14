import { childrenOf, getDescendants } from "@tracker/core";
import { useFocusEffect, useRouter } from "expo-router";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
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
import {
  getCollapsedContentHabitIds,
  getCollapsedHabitIds,
  setCollapsedContentHabitIds,
  setCollapsedHabitIds,
} from "@/lib/expanded-habits";
import { theme } from "@/lib/theme";
import { createWebDragGhost } from "@/lib/web-drag-ghost";

export default function Dashboard() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { habits: allHabits, loading, error, refetch, setHabits } = useHabits();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Separate from `collapsed` above (which hides a habit's *subhabits*):
  // this hides a habit's own tiles/heatmap/actions/Edit-links while
  // leaving its subhabits showing — "just show me the children, not this
  // one's own aggregate".
  const [contentCollapsed, setContentCollapsed] = useState<Set<string>>(new Set());
  // Web drag-and-drop only — none of these need to trigger a render, so
  // they all live outside React state.
  const webDrag = useRef<{ habitId: string; pointerId: number } | null>(null);
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
    getCollapsedContentHabitIds().then(setContentCollapsed);
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

  function toggleContentCollapsed(habitId: string) {
    setContentCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(habitId)) next.delete(habitId);
      else next.add(habitId);
      setCollapsedContentHabitIds(next);
      return next;
    });
  }

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
   * One habit's card, its expand/collapse-subhabits control, and (if not
   * collapsed) its subhabits nested *inside* its own bordered box — see
   * `styles.nodeBox`. `onDragHandleLongPress`/
   * `dragHandleRef`/`rowRef`/`isActive` all come from whichever
   * `siblingGroup` rendered this node (this habit's *own* siblings — its
   * subhabits get their own, separate set from their own `siblingGroup`
   * call below).
   *
   * Called as a plain function everywhere below (`habitNode({...})`), never
   * as JSX (`<HabitNode ... />`) — it and `siblingGroup` are defined inside
   * `Dashboard`'s body (closing over its state), so a fresh function
   * identity exists every render; used as a JSX element type, React would
   * treat that as a genuinely different component on every render and
   * remount the whole tree (losing `HabitCard`'s own state, tearing down
   * the drag-handle DOM refs, breaking the drag library's row-identity
   * tracking). A plain call has none of that — only the *returned* elements
   * (`View`, `HabitCard`, …, all stable references) get reconciled.
   */
  function habitNode({
    habit,
    onDragHandleLongPress,
    dragHandleRef,
    rowRef,
    isActive,
  }: {
    habit: ApiHabit;
    onDragHandleLongPress?: () => void;
    dragHandleRef?: (node: unknown) => void;
    rowRef?: (node: unknown) => void;
    isActive?: boolean;
  }) {
    const childHabits = childrenOf(habit.id, allHabits).filter((h) => !h.archivedAt);
    // All descendants (grandchildren etc.), not just direct children — the
    // label reflects everything that appears when expanded, not just the
    // immediate next level.
    const descendantCount = getDescendants(habit.id, allHabits).filter(
      (d) => !d.habit.archivedAt,
    ).length;
    const childrenHidden = collapsed.has(habit.id);

    return (
      <View ref={rowRef} style={[styles.nodeBox, isActive && styles.nodeBoxActive]}>
        <HabitCard
          habit={habit}
          allHabits={allHabits}
          timeZone={user?.timeZone ?? "UTC"}
          onChanged={refetch}
          onDragHandleLongPress={onDragHandleLongPress}
          dragHandleRef={dragHandleRef}
          contentCollapsed={contentCollapsed.has(habit.id)}
          onToggleContentCollapsed={() => toggleContentCollapsed(habit.id)}
        />
        {descendantCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => toggleCollapsed(habit.id)}
            style={styles.expandToggle}
          >
            <Text style={styles.expandToggleArrow}>{childrenHidden ? "▸" : "▾"}</Text>
            <Text style={styles.expandToggleText}>
              {descendantCount} {descendantCount === 1 ? "subhabit" : "subhabits"}
            </Text>
          </Pressable>
        ) : null}
        {/* Subhabits stay visible here regardless of contentCollapsed above
            — that only hides *this* habit's own tiles/actions, never its
            children. Only `collapsed` (the expand/collapse control) governs
            whether they show. */}
        {childHabits.length > 0 && !childrenHidden
          ? siblingGroup({ habits: childHabits, parentId: habit.id })
          : null}
      </View>
    );
  }

  /**
   * Renders one full sibling group (either top-level habits, or one
   * parent's direct subhabits) as its own independently-reorderable list,
   * recursing into `habitNode` for each member. Native (iOS) nests
   * `NestableDraggableFlatList`s — `react-native-draggable-flatlist`'s own
   * purpose-built solution for exactly this (a draggable list inside
   * another draggable list's row), each still scrolled by one shared
   * `NestableScrollContainer` at the very top. Web's hand-rolled Pointer
   * Events drag (see the top-level `Dashboard` doc comment history — no
   * native drag APIs, no gesture library) needs no special nesting
   * handling at all: each call gets its own `rowEls` map, so hit-testing
   * is naturally scoped to just this group's own siblings regardless of
   * how deep it's nested.
   */
  function siblingGroup({
    habits: siblingHabits,
    parentId,
  }: {
    habits: ApiHabit[];
    parentId: string | null;
  }) {
    if (Platform.OS === "web") {
      const rowEls = new Map<string, HTMLElement>();

      function registerHandle(habitId: string, habitName: string, node: unknown) {
        if (!node) return;
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
          if (!drag || drag.pointerId !== e.pointerId || !shouldDrop) return;

          let targetId: string | null = null;
          for (const [id, rowEl] of rowEls) {
            if (id === drag.habitId) continue;
            const rect = rowEl.getBoundingClientRect();
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
              targetId = id;
              break;
            }
          }
          if (!targetId) return;

          // Which side of the target to land on depends on the drag's
          // direction: dropping onto a sibling *below* the source's
          // current position lands it right *after* that sibling;
          // *above*, right *before*. Always inserting "before" only ever
          // lets you drag things up.
          const movingDown =
            siblingHabits.findIndex((h) => h.id === drag.habitId) <
            siblingHabits.findIndex((h) => h.id === targetId);
          const orderedIds = siblingHabits.map((h) => h.id).filter((id) => id !== drag.habitId);
          const targetIndex = orderedIds.indexOf(targetId);
          orderedIds.splice(movingDown ? targetIndex + 1 : targetIndex, 0, drag.habitId);
          applyReorder(parentId, orderedIds);
        };
        el.onpointerup = (e) => endDrag(e, true);
        el.onpointercancel = (e) => endDrag(e, false);
      }

      return (
        <View style={styles.siblingList}>
          {siblingHabits.map((h) => (
            <Fragment key={h.id}>
              {habitNode({
                habit: h,
                dragHandleRef: (node) => registerHandle(h.id, h.name, node),
                rowRef: (node) => {
                  if (node) rowEls.set(h.id, node as HTMLElement);
                },
              })}
            </Fragment>
          ))}
        </View>
      );
    }

    return (
      <NestableDraggableFlatList
        data={siblingHabits}
        keyExtractor={(h: ApiHabit) => h.id}
        contentContainerStyle={styles.siblingList}
        onDragEnd={({ data, from, to }: DragEndParams<ApiHabit>) => {
          if (from === to) return;
          applyReorder(
            parentId,
            data.map((h) => h.id),
          );
        }}
        renderItem={({ item, drag, isActive }: RenderItemParams<ApiHabit>) => (
          <ScaleDecorator>
            {habitNode({ habit: item, onDragHandleLongPress: drag, isActive })}
          </ScaleDecorator>
        )}
      />
    );
  }

  const topLevelHabits = childrenOf(null, allHabits).filter((h) => !h.archivedAt);

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

      {loading && topLevelHabits.length === 0 ? (
        <ActivityIndicator style={styles.spinner} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : topLevelHabits.length === 0 ? (
        <Text style={styles.empty}>No habits yet — tap &ldquo;+ New&rdquo; to add one.</Text>
      ) : Platform.OS === "web" ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {siblingGroup({ habits: topLevelHabits, parentId: null })}
        </ScrollView>
      ) : (
        <NestableScrollContainer contentContainerStyle={styles.scrollContent}>
          {siblingGroup({ habits: topLevelHabits, parentId: null })}
        </NestableScrollContainer>
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
  // Only the outermost scroll container gets side/bottom padding — every
  // `siblingGroup`, top-level or nested, only ever needs the gap between
  // its own siblings (its own `nodeBox`'s padding provides the rest).
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  siblingList: { gap: 12 },
  // A habit's card, its expand-subhabits control, and its (visible)
  // subhabits all live *inside* this one bordered box — subhabits render
  // nested directly within it (as a further sibling of its own header,
  // sharing this box's own gap), not just indented alongside it, so the
  // border visually contains them.
  nodeBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  nodeBoxActive: { opacity: 0.85 },
  expandToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    // A little extra breathing room above, on top of nodeBox's own gap —
    // separating this from the habit's own controls/tiles above it a bit
    // more than the uniform gap alone did.
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  expandToggleArrow: { color: theme.colors.text.muted, fontSize: 17, lineHeight: 19 },
  expandToggleText: { color: theme.colors.text.muted, fontSize: 13, fontWeight: "600" },
  signOut: { alignItems: "center", paddingVertical: 16 },
  signOutText: { color: theme.colors.text.muted, fontSize: 14 },
});
