import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from "react-native";
import { deleteHabit, updateHabit } from "@/api/habits";
import { HabitForm, rowFromView } from "@/components/HabitForm";
import { Screen } from "@/components/ui";
import { useHabits } from "@/hooks/useHabits";
import { theme } from "@/lib/theme";

export default function EditHabit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { habits, loading, refetch } = useHabits();
  const habit = habits.find((h) => h.id === id);

  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!habit) {
    return (
      <Screen>
        <Text style={{ color: theme.colors.text.muted }}>Habit not found.</Text>
      </Screen>
    );
  }

  function onDelete() {
    if (!habit) return;
    Alert.alert("Delete habit?", `This permanently removes "${habit.name}" and its logs.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteHabit(habit.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <HabitForm
      initialName={habit.name}
      initialStartDate={habit.startDate.slice(0, 10)}
      initialViews={habit.views.map(rowFromView)}
      submitLabel="Save"
      onSubmit={async (input) => {
        try {
          await updateHabit(habit.id, input);
          router.back();
        } catch {
          return { error: "Couldn't save changes. Please try again." };
        }
      }}
      footer={
        <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete habit</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  deleteButton: { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  deleteButtonText: { color: theme.colors.error, fontWeight: "600" },
});
