import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { deleteSprint, updateSprint } from "@/api/sprints";
import { SprintForm } from "@/components/SprintForm";
import { BackButton, Screen } from "@/components/ui";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSprints } from "@/hooks/useSprints";
import { confirmAlert } from "@/lib/confirm";
import { sprintLabel } from "@/lib/points-format";
import { theme } from "@/lib/theme";

export default function EditSprint() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const { sprints, loading, refetch } = useSprints();
  const sprint = sprints.find((s) => s.id === id);
  const timeZone = user?.timeZone ?? "UTC";

  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (loading && !sprint) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!sprint) {
    return (
      <Screen>
        <BackButton onPress={() => router.back()} />
        <Text style={{ color: theme.colors.text.muted }}>Sprint not found.</Text>
      </Screen>
    );
  }

  function onDelete() {
    if (!sprint) return;
    confirmAlert(
      "Delete sprint?",
      `"${sprintLabel(sprint, timeZone)}" will be removed. Your habits and logs aren't affected.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSprint(sprint.id);
            // Back past the sprint's own screen too, which no longer exists.
            router.dismissTo("/");
          },
        },
      ],
    );
  }

  return (
    <SprintForm
      // Remount once the fetched sprint arrives so the fields prefill.
      key={sprint.id}
      initial={sprint}
      title="Edit sprint"
      submitLabel="Save"
      timeZone={timeZone}
      onSubmit={async (input) => {
        try {
          await updateSprint(sprint.id, input);
          router.back();
        } catch {
          return { error: "Couldn't save changes. Please try again." };
        }
      }}
      footer={
        <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete sprint</Text>
        </Pressable>
      }
    />
  );
}

const styles = StyleSheet.create({
  deleteButton: { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  deleteButtonText: { color: theme.colors.error, fontWeight: "600" },
});
