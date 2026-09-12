import { useLocalSearchParams, useRouter } from "expo-router";
import { createLog } from "@/api/habits";
import { LogForm } from "@/components/LogForm";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function NewLog() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();

  return (
    <LogForm
      submitLabel="Log"
      timeZone={user?.timeZone ?? "UTC"}
      onSubmit={async (input) => {
        try {
          await createLog(id, input);
          router.back();
        } catch {
          return { error: "Couldn't log this habit. Please try again." };
        }
      }}
    />
  );
}
