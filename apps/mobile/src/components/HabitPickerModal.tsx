import { getDescendants, type Habit } from "@tracker/core";
import { Modal, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { theme } from "@/lib/theme";

/**
 * Modal list picker for "choose a parent habit," used identically by the
 * create and edit forms (`HabitForm.tsx`). Modeled on `src/lib/confirm.tsx`'s
 * `Modal` + backdrop + card plumbing — the app's only other modal, kept for
 * a consistent look rather than introducing a different one.
 */
export function HabitPickerModal<T extends Habit>({
  visible,
  habits,
  excludeHabitId,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  habits: readonly T[];
  /** Exclude this habit and all its descendants, so reparenting can't create a cycle. */
  excludeHabitId?: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  if (!visible) return null;

  const excludedIds = new Set<string>();
  if (excludeHabitId) {
    excludedIds.add(excludeHabitId);
    for (const { habit } of getDescendants(excludeHabitId, habits)) excludedIds.add(habit.id);
  }
  // Archived habits aren't valid parents — nesting under something that's
  // about to disappear from the active dashboard would just orphan the
  // habit visually.
  const options = habits.filter((h) => !h.archivedAt && !excludedIds.has(h.id));

  function choose(id: string | null) {
    onSelect(id);
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Empty onPress captures the touch so it doesn't bubble to the backdrop's. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>Choose a parent habit</Text>
          <ScrollView style={styles.list}>
            <Pressable
              accessibilityRole="button"
              onPress={() => choose(null)}
              style={({ pressed }) => [
                styles.row,
                selectedId === null && styles.rowSelected,
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={styles.rowText}>No parent (top-level)</Text>
            </Pressable>
            {options.map((h) => (
              <Pressable
                key={h.id}
                accessibilityRole="button"
                onPress={() => choose(h.id)}
                style={({ pressed }) => [
                  styles.row,
                  selectedId === h.id && styles.rowSelected,
                  pressed && styles.rowPressed,
                ]}
              >
                <Text style={styles.rowText}>{h.name}</Text>
              </Pressable>
            ))}
            {options.length === 0 ? (
              <Text style={styles.empty}>No other habits available.</Text>
            ) : null}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 14,
    width: "100%",
    maxWidth: 400,
    maxHeight: "70%",
    overflow: "hidden",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.text.primary,
    textAlign: "center",
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  list: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  row: { paddingVertical: 14, paddingHorizontal: 20 },
  rowPressed: { backgroundColor: theme.colors.badge.background },
  rowSelected: { backgroundColor: theme.colors.badge.background },
  rowText: { fontSize: 16, color: theme.colors.text.primary },
  empty: {
    color: theme.colors.text.muted,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  cancelButton: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelButtonText: { fontSize: 16, fontWeight: "600", color: theme.colors.text.muted },
});
