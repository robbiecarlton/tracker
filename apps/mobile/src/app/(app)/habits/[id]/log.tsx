import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { createLog } from "@/api/habits";
import { Field, FormError, PrimaryButton, Screen, Title } from "@/components/ui";

export default function LogWithNotes() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit() {
    setLoading(true);
    setError(undefined);
    try {
      await createLog(id, { notes: notes.trim() ? notes.trim() : undefined });
      router.back();
    } catch {
      setError("Couldn't log this habit. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>Log with notes</Title>
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      <FormError message={error} />
      <PrimaryButton label="Log" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
