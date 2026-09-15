import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { BackButton, Field, FormError, PrimaryButton, Screen, Title } from "@/components/ui";
import { formatLogTimestampInput, parseLogTimestampInput } from "@/lib/date-format";

/**
 * Shared create/edit form for a log — merges what used to be two separate
 * flows ("log with notes" and "add a past log"): both are "create a log with
 * optional notes and optional custom timestamp." `requireTimestamp` is the
 * one behavioral difference: a create defaults the field to *now* but the
 * field can still be cleared to mean "now at submit time" (matching
 * `createLogSchema`); an edit always requires an explicit value (matching
 * `updateLogSchema` — no "now" fallback once a log exists).
 *
 * The create default is deliberately the form-open time, not submit time:
 * the user is almost always logging something that just happened, so the
 * moment they started filling out the form is a better guess than whenever
 * they get around to hitting submit.
 */
export function LogForm({
  initialTimestampInput = "",
  initialNotes = "",
  requireTimestamp = false,
  submitLabel,
  timeZone,
  onSubmit,
  footer,
}: {
  initialTimestampInput?: string;
  initialNotes?: string;
  requireTimestamp?: boolean;
  submitLabel: string;
  timeZone: string;
  onSubmit: (input: {
    timestamp?: string;
    notes: string | null;
  }) => Promise<{ error?: string } | void>;
  /** Extra content rendered below the submit button, e.g. a Delete button. */
  footer?: ReactNode;
}) {
  const router = useRouter();
  const [timestampInput, setTimestampInput] = useState(
    () =>
      initialTimestampInput ||
      (requireTimestamp ? "" : formatLogTimestampInput(new Date().toISOString(), timeZone)),
  );
  const [notes, setNotes] = useState(initialNotes);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setFormError(undefined);
    const trimmed = timestampInput.trim();
    const notesValue = notes.trim() ? notes.trim() : null;

    let timestamp: string | undefined;
    if (trimmed) {
      const parsed = parseLogTimestampInput(trimmed, timeZone);
      if (!parsed) {
        setErrors({ timestamp: "Enter the date and time as YYYY-MM-DD HH:mm" });
        return;
      }
      timestamp = parsed;
    } else if (requireTimestamp) {
      setErrors({ timestamp: "Enter a date and time" });
      return;
    }

    setErrors({});
    setLoading(true);
    const result = await onSubmit({ timestamp, notes: notesValue });
    setLoading(false);
    if (result?.error) setFormError(result.error);
  }

  return (
    <Screen>
      <BackButton onPress={() => router.back()} />
      <Title>{submitLabel === "Save" ? "Edit log" : "Add log"}</Title>
      <Field
        label="Date & time (YYYY-MM-DD HH:mm)"
        value={timestampInput}
        onChangeText={setTimestampInput}
        error={errors.timestamp}
        placeholder="2026-01-01 08:00"
      />
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline />
      <FormError message={formError} />
      <PrimaryButton label={submitLabel} onPress={handleSubmit} loading={loading} />
      {footer}
    </Screen>
  );
}
