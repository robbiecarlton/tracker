import { DEFAULT_HABIT_VIEWS } from "@tracker/core";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { createHabit } from "@/api/habits";
import { HabitForm, rowFromView } from "@/components/HabitForm";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHabits } from "@/hooks/useHabits";

export default function NewHabit() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { habits, refetch } = useHabits();

  // Needed for the parent-habit picker — see HabitForm's `habits` prop.
  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <HabitForm
      habits={habits}
      initialViews={DEFAULT_HABIT_VIEWS.map(rowFromView)}
      submitLabel="Create"
      timeZone={user?.timeZone ?? "UTC"}
      onSubmit={async (input) => {
        try {
          await createHabit(input);
          router.back();
        } catch {
          return { error: "Couldn't create this habit. Please try again." };
        }
      }}
    />
  );
}
