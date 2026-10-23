import { sprintFormSchema, type SprintFormInput } from "@tracker/core";
import { useRouter } from "expo-router";
import { DateTime } from "luxon";
import { useState, type ReactNode } from "react";
import { BackButton, Field, FormError, PrimaryButton, Screen, Title } from "@/components/ui";
import { formatLogTimestampInput, parseLogTimestampInput } from "@/lib/date-format";
import { fieldErrors } from "@/lib/forms";

const DATETIME_HINT = "Enter as YYYY-MM-DD HH:mm";

/**
 * Plan or edit a Point Sprint. Start/end are typed as local
 * "YYYY-MM-DD HH:mm" text (same convention as `LogForm`'s timestamp),
 * converted to UTC instants before validation. A new sprint defaults to
 * starting now and running a week.
 */
export function SprintForm({
  initial,
  title,
  submitLabel,
  timeZone,
  onSubmit,
  footer,
}: {
  initial?: { name: string | null; startAt: string; endAt: string; target: number };
  title: string;
  submitLabel: string;
  timeZone: string;
  onSubmit: (input: SprintFormInput) => Promise<{ error?: string } | void>;
  /** Extra content below the submit button, e.g. a Delete button. */
  footer?: ReactNode;
}) {
  const router = useRouter();
  const now = DateTime.now().setZone(timeZone).startOf("minute");
  const [name, setName] = useState(initial?.name ?? "");
  const [start, setStart] = useState(
    formatLogTimestampInput(initial?.startAt ?? now.toISO()!, timeZone),
  );
  const [end, setEnd] = useState(
    formatLogTimestampInput(initial?.endAt ?? now.plus({ days: 7 }).toISO()!, timeZone),
  );
  const [target, setTarget] = useState(initial ? String(initial.target) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setFormError(undefined);
    const startAt = parseLogTimestampInput(start, timeZone);
    const endAt = parseLogTimestampInput(end, timeZone);
    if (!startAt || !endAt || !target.trim()) {
      setErrors({
        ...(startAt ? {} : { startAt: DATETIME_HINT }),
        ...(endAt ? {} : { endAt: DATETIME_HINT }),
        ...(target.trim() ? {} : { target: "Enter a point target" }),
      });
      return;
    }
    const parsed = sprintFormSchema.safeParse({
      name: name.trim() || null,
      startAt,
      endAt,
      target: Number(target),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    const result = await onSubmit(parsed.data);
    setLoading(false);
    if (result?.error) setFormError(result.error);
  }

  return (
    <Screen>
      <BackButton onPress={() => router.back()} />
      <Title>{title}</Title>
      <Field
        label="Name (optional)"
        value={name}
        onChangeText={setName}
        error={errors.name}
        placeholder="e.g. March push"
      />
      <Field
        label="Starts (YYYY-MM-DD HH:mm)"
        value={start}
        onChangeText={setStart}
        error={errors.startAt}
        placeholder="2026-03-01 09:00"
      />
      <Field
        label="Ends (YYYY-MM-DD HH:mm)"
        value={end}
        onChangeText={setEnd}
        error={errors.endAt}
        placeholder="2026-03-08 09:00"
      />
      <Field
        label="Point target"
        value={target}
        onChangeText={setTarget}
        error={errors.target}
        keyboardType="number-pad"
      />
      <FormError message={formError} />
      <PrimaryButton label={submitLabel} onPress={handleSubmit} loading={loading} />
      {footer}
    </Screen>
  );
}
