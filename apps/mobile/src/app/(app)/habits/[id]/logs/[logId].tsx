import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { deleteLog, updateLog } from "@/api/habits";
import { LogForm } from "@/components/LogForm";
import { Screen } from "@/components/ui";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHabits } from "@/hooks/useHabits";
import { confirmAlert } from "@/lib/confirm";
import { formatLogTimestampInput } from "@/lib/date-format";
import { theme } from "@/lib/theme";

export default function EditLog() {
  const { id, logId } = useLocalSearchParams<{ id: string; logId: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const { habits, loading, refetch } = useHabits();
  const habit = habits.find((h) => h.id === id);
  const log = habit?.logs.find((l) => l.id === logId);

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

  if (!log) {
    return (
      <Screen>
        <Text style={{ color: theme.colors.text.muted }}>Log not found.</Text>
      </Screen>
    );
  }

  const timeZone = user?.timeZone ?? "UTC";

  function onDelete() {
    if (!log) return;
    confirmAlert("Delete log?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteLog(id, log.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <LogForm
      initialTimestampInput={formatLogTimestampInput(log.timestamp, timeZone)}
      initialNotes={log.notes ?? ""}
      requireTimestamp
      submitLabel="Save"
      timeZone={timeZone}
      onSubmit={async (input) => {
        if (!input.timestamp) return { error: "Enter a date and time" };
        try {
          await updateLog(id, log.id, { timestamp: input.timestamp, notes: input.notes });
          router.back();
        } catch {
          return { error: "Couldn't save changes. Please try again." };
        }
      }}
      footer={
        <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete log</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  deleteButton: { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  deleteButtonText: { color: theme.colors.error, fontWeight: "600" },
});
