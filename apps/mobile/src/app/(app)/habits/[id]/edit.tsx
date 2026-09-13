import { getDescendants, type HabitFormInput } from "@tracker/core";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { archiveAndCloneHabit, archiveHabit, deleteHabit, updateHabit } from "@/api/habits";
import { ApiError } from "@/api/client";
import type { ApiHabit } from "@/api/types";
import { HabitForm, rowFromView } from "@/components/HabitForm";
import { BackButton, Screen } from "@/components/ui";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHabits } from "@/hooks/useHabits";
import { confirmAlert, type ConfirmButton } from "@/lib/confirm";
import { theme } from "@/lib/theme";

/** How to resolve a habit's active subhabits when it's deleted or archived — mirrors the backend's `childrenAction`. */
type ChildrenAction = "cascade" | "top_level" | "grandparent";

/**
 * Builds and shows the "this habit has subhabits" confirmation shared by
 * delete and archive: lists every active descendant, then offers promoting
 * direct children to top-level, rehoming them under this habit's own parent
 * (only when it has one), or applying `cascadeLabel`'s action to the whole
 * subtree too. A habit with no active descendants skips straight to a plain
 * confirm with just the cascade action (today's simple single-habit case).
 */
function confirmChildrenAction(
  target: ApiHabit,
  habits: ApiHabit[],
  opts: {
    cascadeLabel: string;
    cascadeStyle: "destructive" | "default";
    noChildrenTitle: string;
    noChildrenMessage: string;
    onApply: (action: ChildrenAction) => void | Promise<void>;
  },
) {
  const activeDescendants = getDescendants(target.id, habits).filter((d) => !d.habit.archivedAt);

  if (activeDescendants.length === 0) {
    confirmAlert(opts.noChildrenTitle, opts.noChildrenMessage, [
      { text: "Cancel", style: "cancel" },
      { text: opts.cascadeLabel, style: opts.cascadeStyle, onPress: () => opts.onApply("cascade") },
    ]);
    return;
  }

  const list = activeDescendants
    .map((d) => `${"  ".repeat(d.depth - 1)}• ${d.habit.name}`)
    .join("\n");
  const grandparent = target.parentId ? habits.find((h) => h.id === target.parentId) : undefined;

  const buttons: ConfirmButton[] = [
    { text: "Cancel", style: "cancel" },
    { text: "Promote to top-level", onPress: () => opts.onApply("top_level") },
  ];
  if (grandparent) {
    buttons.push({
      text: `Rehome under ${grandparent.name}`,
      onPress: () => opts.onApply("grandparent"),
    });
  }
  buttons.push({ text: opts.cascadeLabel, style: opts.cascadeStyle, onPress: () => opts.onApply("cascade") });

  confirmAlert(
    `"${target.name}" has subhabits`,
    `${list}\n\nWhat should happen to them?`,
    buttons,
  );
}

/** True if an `ApiError`'s body contains this backend error code, whatever its exact shape. */
function isApiErrorCode(err: unknown, code: string): boolean {
  return err instanceof ApiError && JSON.stringify(err.body).includes(code);
}

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
    confirmChildrenAction(habit, habits, {
      cascadeLabel: "Delete all",
      cascadeStyle: "destructive",
      noChildrenTitle: "Delete habit?",
      noChildrenMessage: `This permanently removes "${habit.name}" and its logs.`,
      onApply: async (action) => {
        await deleteHabit(habit.id, { childrenAction: action });
        router.back();
      },
    });
  }

  function onArchive() {
    if (!habit) return;
    confirmChildrenAction(habit, habits, {
      cascadeLabel: "Archive all",
      cascadeStyle: "default",
      noChildrenTitle: "Archive habit?",
      noChildrenMessage: `"${habit.name}" will leave the main list. You can unarchive it later.`,
      onApply: async (action) => {
        await archiveHabit(habit.id, { childrenAction: action });
        router.back();
      },
    });
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
              } catch (err) {
                resolve({
                  error: isApiErrorCode(err, "has_active_subhabits")
                    ? "This habit has active subhabits — archive or move them first from the Delete/Archive actions below, then try again."
                    : "Couldn't save changes. Please try again.",
                });
              }
            },
          },
        ],
      );
    });
  }

  return (
    <HabitForm
      habitId={habit.id}
      habits={habits}
      initialName={habit.name}
      initialStartDate={habit.startDate.slice(0, 10)}
      initialViews={habit.views.map(rowFromView)}
      initialParentId={habit.parentId}
      initialAllowDirectLogging={habit.allowDirectLogging}
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
        <>
          <Pressable accessibilityRole="button" onPress={onArchive} style={styles.archiveButton}>
            <Text style={styles.archiveButtonText}>Archive habit</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>Delete habit</Text>
          </Pressable>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  archiveButton: { alignItems: "center", paddingVertical: 12, marginTop: 8 },
  archiveButtonText: { color: theme.colors.text.muted, fontWeight: "600" },
  deleteButton: { alignItems: "center", paddingVertical: 4 },
  deleteButtonText: { color: theme.colors.error, fontWeight: "600" },
});
