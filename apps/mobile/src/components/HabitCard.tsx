import {
  aggregatedLogs,
  computeHabitView,
  computeHighlight,
  type HabitLog,
  type HabitView,
  type HeatmapResult,
  type TimeContext,
} from "@tracker/core";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createLog } from "@/api/habits";
import type { ApiHabit } from "@/api/types";
import { confirmAlert } from "@/lib/confirm";
import { theme } from "@/lib/theme";
import {
  formatViewValue,
  heatmapUnitLabel,
  highlightValueForView,
  viewLabel,
} from "@/lib/view-format";
import { Heatmap } from "./Heatmap";
import { ViewTile } from "./ViewTile";

/**
 * Isolates one view's computation so a single malformed habit/log doesn't
 * crash the whole dashboard (e.g. a legacy bad `startDate` — see the
 * "Invalid datetime" bug fix). Falls back to an error tile instead of
 * throwing.
 */
function safeComputeTile(
  habit: ApiHabit,
  view: HabitView,
  logs: readonly HabitLog[],
  ctx: TimeContext,
): { value: string; highlightColor: string | null } {
  try {
    const result = computeHabitView(habit, view, logs, ctx);
    return {
      value: formatViewValue(result),
      highlightColor: computeHighlight(view, highlightValueForView(result)),
    };
  } catch {
    return { value: "Error", highlightColor: null };
  }
}

/** Same isolation as `safeComputeTile`, for a heatmap view — `null` (silently skipped) on error. */
function safeComputeHeatmap(
  habit: ApiHabit,
  view: HabitView,
  logs: readonly HabitLog[],
  ctx: TimeContext,
): HeatmapResult | null {
  try {
    const result = computeHabitView(habit, view, logs, ctx);
    return result.kind === "heatmap" ? result : null;
  } catch {
    return null;
  }
}

export function HabitCard({
  habit,
  allHabits,
  timeZone,
  onChanged,
  onDragHandleLongPress,
  dragHandleRef,
  contentCollapsed = false,
  onToggleContentCollapsed,
}: {
  habit: ApiHabit;
  /** The user's full habit list — needed so a habit with subhabits rolls up
   * their logs into its own view calculations (see `aggregatedLogs`). */
  allHabits: ApiHabit[];
  timeZone: string;
  onChanged: () => void | Promise<void>;
  /** Native (iOS): wired to `DraggableFlatList`'s per-item `drag` callback,
   * fired on long-press. Undefined on web, where dragging is native HTML5
   * drag-and-drop instead (see `dragHandleRef`) — `react-native-
   * draggable-flatlist`'s gesture-handler-based drag/scroll is unreliable
   * there. Either prop present renders the handle; the card itself has too
   * many other tappable actions (Edit, + Subhabit, Log, …) to make the
   * whole card the drag trigger. */
  onDragHandleLongPress?: () => void;
  /** Web: a ref callback receiving the handle's underlying DOM node, so the
   * dashboard can attach native `draggable`/`dragstart` listeners
   * imperatively (see `(app)/index.tsx`). No-op type on native — the ref
   * is just never read there. */
  dragHandleRef?: (node: unknown) => void;
  /** When true, only the drag handle, name, and the collapse toggle itself
   * render — tiles/heatmap/actions/Edit/+Subhabit are hidden. Independent
   * of whether this habit's *subhabits* are showing (the dashboard's
   * separate `collapsed` state) — this is for "just show me the children,
   * not this habit's own aggregate." */
  contentCollapsed?: boolean;
  /** Undefined = no collapse toggle rendered at all. */
  onToggleContentCollapsed?: () => void;
}) {
  const router = useRouter();
  const [logging, setLogging] = useState(false);
  const ctx: TimeContext = { now: new Date().toISOString(), timeZone };
  const logs = aggregatedLogs(habit.id, allHabits);

  async function onLog() {
    setLogging(true);
    try {
      await createLog(habit.id, {});
      await onChanged();
    } catch {
      confirmAlert("Couldn't log this habit", "Please try again.");
    } finally {
      setLogging(false);
    }
  }

  const dragHandle =
    onDragHandleLongPress || dragHandleRef ? (
      <Pressable
        ref={dragHandleRef}
        accessibilityRole="button"
        accessibilityLabel="Drag to reorder"
        onLongPress={onDragHandleLongPress}
        hitSlop={8}
        style={styles.dragHandle}
      >
        <Text style={styles.dragHandleText}>⠿</Text>
      </Pressable>
    ) : null;

  const collapseToggle = onToggleContentCollapsed ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={contentCollapsed ? "Show habit details" : "Hide habit details"}
      onPress={onToggleContentCollapsed}
      hitSlop={8}
      style={styles.collapseToggle}
    >
      <Text style={styles.collapseToggleText}>{contentCollapsed ? "⌄" : "⌃"}</Text>
    </Pressable>
  ) : null;

  if (contentCollapsed) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          {dragHandle}
          <Text style={styles.name}>{habit.name}</Text>
          {collapseToggle}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {dragHandle}
        <Text style={styles.name}>{habit.name}</Text>
        {collapseToggle}
        <View style={styles.headerLinks}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/habits/[id]/edit", params: { id: habit.id } })}
            hitSlop={8}
          >
            <Text style={styles.editLink}>Edit</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/habits/new", params: { parentId: habit.id } })}
            hitSlop={8}
          >
            <Text style={styles.addSubhabitLink}>+ Subhabit</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tiles}>
        {habit.views
          .filter((view) => view.kind !== "heatmap")
          .map((view) => {
            const tile = safeComputeTile(habit, view, logs, ctx);
            return (
              <ViewTile
                key={view.id}
                label={viewLabel(view.kind)}
                value={tile.value}
                highlightColor={tile.highlightColor}
              />
            );
          })}
      </View>

      {habit.views
        .filter((view) => view.kind === "heatmap")
        .map((view) => {
          const result = safeComputeHeatmap(habit, view, logs, ctx);
          if (!result) return null;
          return (
            <View key={view.id} style={styles.heatmapSection}>
              <Text style={styles.heatmapLabel}>{heatmapUnitLabel(result.unit)}</Text>
              <Heatmap result={result} />
            </View>
          );
        })}

      <View style={styles.actions}>
        {habit.allowDirectLogging ? (
          <Pressable
            accessibilityRole="button"
            onPress={onLog}
            disabled={logging}
            style={({ pressed }) => [
              styles.logButton,
              pressed && styles.logButtonPressed,
              logging && styles.logButtonDisabled,
            ]}
          >
            <Text style={styles.logButtonText}>{logging ? "Logging…" : "Log"}</Text>
          </Pressable>
        ) : null}
        {habit.allowDirectLogging ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/habits/[id]/logs/new", params: { id: habit.id } })}
            hitSlop={8}
            style={styles.notesLink}
          >
            <Text style={styles.notesLinkText}>+ note</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/habits/[id]/logs", params: { id: habit.id } })}
          hitSlop={8}
          style={styles.notesLink}
        >
          <Text style={styles.notesLinkText}>Logs</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dragHandle: { paddingVertical: 2, paddingHorizontal: 2 },
  dragHandleText: { fontSize: 18, color: theme.colors.text.faint, lineHeight: 20 },
  collapseToggle: { paddingVertical: 2, paddingHorizontal: 4 },
  collapseToggleText: { fontSize: 15, color: theme.colors.text.muted, lineHeight: 18 },
  headerLinks: { alignItems: "flex-end", gap: 4 },
  name: { flex: 1, fontSize: 17, fontWeight: "700", color: theme.colors.text.primary },
  editLink: { color: theme.colors.brand, fontWeight: "600", fontSize: 14 },
  addSubhabitLink: { color: theme.colors.text.muted, fontSize: 13 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heatmapSection: { gap: 4 },
  heatmapLabel: { fontSize: 11, color: theme.colors.text.muted },
  actions: { flexDirection: "row", alignItems: "center", gap: 16 },
  logButton: {
    backgroundColor: theme.colors.brand,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  logButtonPressed: { opacity: 0.85 },
  logButtonDisabled: { backgroundColor: theme.colors.brandDisabled },
  logButtonText: { color: theme.colors.onBrand, fontWeight: "600", fontSize: 15 },
  notesLink: { paddingVertical: 10 },
  notesLinkText: { color: theme.colors.text.muted, fontSize: 14 },
});
