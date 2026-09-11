import {
  habitFormSchema,
  UNITS,
  type HabitFormInput,
  type HabitViewInput,
  type TargetType,
  type Unit,
  type ViewKind,
} from "@tracker/core";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Field, FormError, PrimaryButton, Screen, Title } from "@/components/ui";
import { fieldErrors } from "@/lib/forms";
import { theme } from "@/lib/theme";
import { viewLabel } from "@/lib/view-format";
import { StreakWarning } from "./StreakWarning";

const VIEW_KINDS: ViewKind[] = ["cumulative", "streak", "percentage", "days", "since"];
const TARGET_TYPES: TargetType[] = ["at_least", "at_most", "exactly"];
const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  at_least: "At least",
  at_most: "At most",
  exactly: "Exactly",
};

/** One editable view row's local state — numeric fields as text for the input. */
interface ViewRow {
  key: string;
  kind: ViewKind;
  unit: Unit;
  days: string;
  cumulationGoal: string;
  target: string;
  targetType: TargetType | undefined;
}

let nextRowKey = 0;
function freshKey(): string {
  nextRowKey += 1;
  return `row-${nextRowKey}`;
}

export function rowFromView(view: {
  kind: ViewKind;
  unit?: Unit;
  days?: number;
  cumulationGoal?: number;
  target?: number;
  targetType?: TargetType;
}): ViewRow {
  return {
    key: freshKey(),
    kind: view.kind,
    unit: view.unit ?? "day",
    days: view.days != null ? String(view.days) : "",
    cumulationGoal: view.cumulationGoal != null ? String(view.cumulationGoal) : "",
    target: view.target != null ? String(view.target) : "",
    targetType: view.targetType,
  };
}

function rowToInput(row: ViewRow): HabitViewInput {
  const days = row.kind === "days" && row.days.trim() ? Number(row.days) : undefined;
  const cumulationGoal =
    row.kind === "cumulative" && row.cumulationGoal.trim() ? Number(row.cumulationGoal) : undefined;
  const hasTarget = (row.kind === "days" || row.kind === "percentage") && row.target.trim();
  return {
    kind: row.kind,
    unit: row.kind === "cumulative" ? undefined : row.unit,
    days,
    cumulationGoal,
    target: hasTarget ? Number(row.target) : undefined,
    targetType: hasTarget ? row.targetType : undefined,
  };
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T | undefined;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            accessibilityRole="button"
            onPress={() => onChange(opt)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {labels?.[opt] ?? opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ViewRowEditor({
  row,
  canRemove,
  onChange,
  onRemove,
}: {
  row: ViewRow;
  canRemove: boolean;
  onChange: (patch: Partial<ViewRow>) => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.viewRow}>
      <View style={styles.viewRowHeader}>
        <Text style={styles.viewRowTitle}>View</Text>
        {canRemove ? (
          <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={8}>
            <Text style={styles.removeLink}>Remove</Text>
          </Pressable>
        ) : null}
      </View>

      <ChipRow
        options={VIEW_KINDS}
        value={row.kind}
        onChange={(kind) => onChange({ kind })}
        labels={{
          cumulative: viewLabel("cumulative"),
          streak: viewLabel("streak"),
          percentage: viewLabel("percentage"),
          days: viewLabel("days"),
          since: viewLabel("since"),
        }}
      />

      {row.kind === "streak" ? <StreakWarning /> : null}

      {row.kind !== "cumulative" ? (
        <View style={styles.subField}>
          <Text style={styles.subLabel}>Unit</Text>
          <ChipRow options={UNITS} value={row.unit} onChange={(unit) => onChange({ unit })} />
        </View>
      ) : null}

      {row.kind === "cumulative" ? (
        <Field
          label="Goal (optional)"
          value={row.cumulationGoal}
          onChangeText={(cumulationGoal) => onChange({ cumulationGoal })}
          keyboardType="number-pad"
        />
      ) : null}

      {row.kind === "days" ? (
        <Field
          label="Out of how many days? (default 7)"
          value={row.days}
          onChangeText={(days) => onChange({ days })}
          keyboardType="number-pad"
          placeholder="7"
        />
      ) : null}

      {row.kind === "days" || row.kind === "percentage" ? (
        <View style={styles.subField}>
          <Field
            label="Target (optional)"
            value={row.target}
            onChangeText={(target) => onChange({ target })}
            keyboardType="number-pad"
          />
          {row.target.trim() ? (
            <ChipRow
              options={TARGET_TYPES}
              value={row.targetType}
              onChange={(targetType) => onChange({ targetType })}
              labels={TARGET_TYPE_LABELS}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function HabitForm({
  initialName = "",
  initialStartDate = new Date().toISOString().slice(0, 10),
  initialViews,
  submitLabel,
  onSubmit,
  footer,
}: {
  initialName?: string;
  initialStartDate?: string;
  initialViews: ViewRow[];
  submitLabel: string;
  onSubmit: (input: HabitFormInput) => Promise<{ error?: string } | void>;
  /** Extra content rendered below the submit button, e.g. a Delete button. */
  footer?: ReactNode;
}) {
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [views, setViews] = useState<ViewRow[]>(initialViews);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);

  function updateView(index: number, patch: Partial<ViewRow>) {
    setViews((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addView() {
    setViews((prev) => [...prev, rowFromView({ kind: "cumulative" })]);
  }

  function removeView(index: number) {
    setViews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setFormError(undefined);
    const parsed = habitFormSchema.safeParse({
      name,
      startDate,
      views: views.map(rowToInput),
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
      <Title>{submitLabel === "Save" ? "Edit habit" : "New habit"}</Title>
      <Field label="Name" value={name} onChangeText={setName} error={errors.name} />
      <Field
        label="Start date (YYYY-MM-DD)"
        value={startDate}
        onChangeText={setStartDate}
        error={errors.startDate}
        placeholder="2026-01-01"
      />

      {views.map((row, i) => (
        <ViewRowEditor
          key={row.key}
          row={row}
          canRemove={views.length > 1}
          onChange={(patch) => updateView(i, patch)}
          onRemove={() => removeView(i)}
        />
      ))}
      {errors.views ? <Text style={styles.viewsError}>{errors.views}</Text> : null}

      <Pressable accessibilityRole="button" onPress={addView} style={styles.addViewLink}>
        <Text style={styles.addViewLinkText}>+ Add view</Text>
      </Pressable>

      <FormError message={formError} />
      <PrimaryButton label={submitLabel} onPress={handleSubmit} loading={loading} />
      {footer}
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewRow: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  viewRowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  viewRowTitle: { fontSize: 13, fontWeight: "600", color: theme.colors.text.secondary },
  removeLink: { color: theme.colors.error, fontSize: 13 },
  subField: { gap: 6 },
  subLabel: { fontSize: 12, color: theme.colors.text.muted },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 13, color: theme.colors.text.secondary },
  chipTextActive: { color: theme.colors.onBrand, fontWeight: "600" },
  viewsError: { color: theme.colors.error, fontSize: 12 },
  addViewLink: { alignSelf: "flex-start" },
  addViewLinkText: { color: theme.colors.brand, fontWeight: "600" },
});
