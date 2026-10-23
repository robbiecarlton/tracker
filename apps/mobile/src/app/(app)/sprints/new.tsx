import { useRouter } from "expo-router";
import { createSprint } from "@/api/sprints";
import { SprintForm } from "@/components/SprintForm";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function NewSprint() {
  const router = useRouter();
  const { user } = useCurrentUser();

  return (
    <SprintForm
      title="Plan a point sprint"
      submitLabel="Create"
      timeZone={user?.timeZone ?? "UTC"}
      onSubmit={async (input) => {
        try {
          await createSprint(input);
          router.back();
        } catch {
          return { error: "Couldn't create this sprint. Please try again." };
        }
      }}
    />
  );
}
