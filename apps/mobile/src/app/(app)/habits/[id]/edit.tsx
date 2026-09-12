import type { HabitFormInput } from "@tracker/core";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { archiveAndCloneHabit, deleteHabit, updateHabit } from "@/api/habits";
import type { ApiHabit } from "@/api/types";
import { HabitForm, rowFromView } from "@/components/HabitForm";
import { BackButton, Screen } from "@/components/ui";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHabits } from "@/hooks/useHabits";
import { confirmAlert } from "@/lib/confirm";
import { theme } from "@/lib/theme";

export default function EditHabit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
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
        <BackButton onPress={() => router.back()} />
        <Text style={{ color: theme.colors.text.muted }}>Habit not found.</Text>
      </Screen>
    );
  }

  function onDelete() {
    if (!habit) return;
    confirmAlert("Delete habit?", `This permanently removes "${habit.name}" and its logs.`, [
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

  /**
   * If the start date moved and logs exist before the new date, prompt
   * Archive-vs-Keep (docs/DOMAIN.md's "Start-date changes"). "Keep" is just
   * an ordinary `updateHabit` — the backend auto-records history whenever
   * `startDate` differs from what's stored, so there's nothing special to do
   * here beyond calling it. "Archive" swaps in the new archive-and-clone
   * endpoint instead.
   */
  function promptArchiveOrKeep(
    current: ApiHabit,
    input: HabitFormInput,
  ): Promise<{ error?: string } | void> {
    return new Promise((resolve) => {
      confirmAlert(
        "Start date changed",
        "You have logs before the new start date. Archive this habit and start fresh with the new date, or keep it and mark those logs as history?",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve() },
          {
            text: "Keep",
            onPress: async () => {
              try {
                await updateHabit(current.id, input);
                router.back();
                resolve();
              } catch {
                resolve({ error: "Couldn't save changes. Please try again." });
              }
            },
          },
          {
            text: "Archive",
            onPress: async () => {
              try {
                await archiveAndCloneHabit(current.id, input);
                router.back();
                resolve();
              } catch {
                resolve({ error: "Couldn't save changes. Please try again." });
              }
            },
          },
        ],
      );
    });
  }

  return (
    <HabitForm
      initialName={habit.name}
      initialStartDate={habit.startDate.slice(0, 10)}
      initialViews={habit.views.map(rowFromView)}
      submitLabel="Save"
      timeZone={user?.timeZone ?? "UTC"}
      onSubmit={async (input) => {
        const startDateChanged = input.startDate !== habit.startDate.slice(0, 10);
        // Same conversion the backend applies, so client and server always
        // agree on which logs "predate" the new date.
        const newStartInstant = new Date(input.startDate).toISOString();
        const hasEarlierLogs = habit.logs.some((log) => log.timestamp < newStartInstant);

        if (startDateChanged && hasEarlierLogs) {
          return promptArchiveOrKeep(habit, input);
        }

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
