import { DEFAULT_HABIT_VIEWS } from "@tracker/core";
import { useRouter } from "expo-router";
import { createHabit } from "@/api/habits";
import { HabitForm, rowFromView } from "@/components/HabitForm";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function NewHabit() {
  const router = useRouter();
  const { user } = useCurrentUser();

  return (
    <HabitForm
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
