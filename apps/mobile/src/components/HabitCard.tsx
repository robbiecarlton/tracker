import {
  computeHabitView,
  computeHighlight,
  type HabitView,
  type TimeContext,
} from "@tracker/core";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createLog } from "@/api/habits";
import type { ApiHabit } from "@/api/types";
import { confirmAlert } from "@/lib/confirm";
import { theme } from "@/lib/theme";
import { formatViewValue, highlightValueForView, viewLabel } from "@/lib/view-format";
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
  ctx: TimeContext,
): { value: string; highlightColor: string | null } {
  try {
    const result = computeHabitView(habit, view, habit.logs, ctx);
    return {
      value: formatViewValue(result),
      highlightColor: computeHighlight(view, highlightValueForView(result)),
    };
  } catch {
    return { value: "Error", highlightColor: null };
  }
}

export function HabitCard({
  habit,
  timeZone,
  onChanged,
}: {
  habit: ApiHabit;
  timeZone: string;
  onChanged: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [logging, setLogging] = useState(false);
  const ctx: TimeContext = { now: new Date().toISOString(), timeZone };

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

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{habit.name}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/habits/[id]/edit", params: { id: habit.id } })}
          hitSlop={8}
        >
          <Text style={styles.editLink}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.tiles}>
        {habit.views.map((view) => {
          const tile = safeComputeTile(habit, view, ctx);
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

      <View style={styles.actions}>
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
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/habits/[id]/logs/new", params: { id: habit.id } })}
          hitSlop={8}
          style={styles.notesLink}
        >
          <Text style={styles.notesLinkText}>+ note</Text>
        </Pressable>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 17, fontWeight: "700", color: theme.colors.text.primary },
  editLink: { color: theme.colors.brand, fontWeight: "600", fontSize: 14 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
