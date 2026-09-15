import {
  childrenOf,
  DEFAULT_HEATMAP_POLARITY,
  habitFormSchema,
  UNITS,
  type HabitFormInput,
  type HabitViewInput,
  type HeatmapPolarity,
  type TargetType,
  type Unit,
  type ViewKind,
} from "@tracker/core";
import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ApiHabit } from "@/api/types";
import { BackButton, Field, FormError, PrimaryButton, Screen, Title } from "@/components/ui";
import { todayInZone } from "@/lib/date-format";
import { fieldErrors } from "@/lib/forms";
import { theme } from "@/lib/theme";
import { viewLabel } from "@/lib/view-format";
import { ChipRow } from "./ChipRow";
import { HabitPickerModal } from "./HabitPickerModal";
import { StreakWarning } from "./StreakWarning";

const VIEW_KINDS: ViewKind[] = ["cumulative", "streak", "percentage", "days", "since", "heatmap"];
/** Heatmap's box size is day/week/month only — no hour (schema-enforced too). */
const HEATMAP_UNITS = UNITS.filter((u) => u !== "hour");
const TARGET_TYPES: TargetType[] = ["at_least", "at_most", "exactly"];
const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  at_least: "At least",
  at_most: "At most",
  exactly: "Exactly",
};
const HEATMAP_POLARITIES: HeatmapPolarity[] = ["neutral", "positive", "negative"];
const HEATMAP_POLARITY_LABELS: Record<HeatmapPolarity, string> = {
  neutral: "Neutral",
  positive: "Positive",
  negative: "Negative",
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
  heatmapPolarity: HeatmapPolarity;
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
  heatmapPolarity?: HeatmapPolarity;
}): ViewRow {
  return {
    key: freshKey(),
    kind: view.kind,
    unit: view.unit ?? "day",
    days: view.days != null ? String(view.days) : "",
    cumulationGoal: view.cumulationGoal != null ? String(view.cumulationGoal) : "",
    target: view.target != null ? String(view.target) : "",
    targetType: view.targetType,
    heatmapPolarity: view.heatmapPolarity ?? DEFAULT_HEATMAP_POLARITY,
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
    heatmapPolarity: row.kind === "heatmap" ? row.heatmapPolarity : undefined,
  };
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
        onChange={(kind) =>
          // Heatmap can't take "hour" as its box size — clamp back to the
          // default rather than carrying over whatever unit the row had
          // under its previous kind.
          onChange(kind === "heatmap" && row.unit === "hour" ? { kind, unit: "day" } : { kind })
        }
        labels={{
          cumulative: viewLabel("cumulative"),
          streak: viewLabel("streak"),
          percentage: viewLabel("percentage"),
          days: viewLabel("days"),
          since: viewLabel("since"),
          heatmap: viewLabel("heatmap"),
        }}
      />

      {row.kind === "streak" ? <StreakWarning /> : null}

      {row.kind !== "cumulative" ? (
        <View style={styles.subField}>
          <Text style={styles.subLabel}>{row.kind === "heatmap" ? "Box size" : "Unit"}</Text>
          <ChipRow
            options={row.kind === "heatmap" ? HEATMAP_UNITS : UNITS}
            value={row.unit}
            onChange={(unit) => onChange({ unit })}
          />
        </View>
      ) : null}

      {row.kind === "heatmap" ? (
        <View style={styles.subField}>
          <Text style={styles.subLabel}>Color</Text>
          <ChipRow
            options={HEATMAP_POLARITIES}
            value={row.heatmapPolarity}
            onChange={(heatmapPolarity) => onChange({ heatmapPolarity })}
            labels={HEATMAP_POLARITY_LABELS}
          />
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
  initialStartDate,
  initialViews,
  initialParentId = null,
  initialAllowDirectLogging = true,
  habitId,
  habits,
  submitLabel,
  timeZone,
  onSubmit,
  footer,
}: {
  initialName?: string;
  initialStartDate?: string;
  initialViews: ViewRow[];
  initialParentId?: string | null;
  initialAllowDirectLogging?: boolean;
  /** Undefined when creating — there's no habit yet to exclude from its own parent picker. */
  habitId?: string;
  /** The user's full habit list — powers the parent picker and the direct-logging toggle's
   * "does this habit have a subhabit yet?" check. */
  habits: ApiHabit[];
  submitLabel: string;
  /** Used to default a new habit's start date to "today" in the user's own
   * calendar day, not UTC's (see `todayInZone`). Unused when
   * `initialStartDate` is given (editing an existing habit). */
  timeZone: string;
  onSubmit: (input: HabitFormInput) => Promise<{ error?: string } | void>;
  /** Extra content rendered below the submit button, e.g. a Delete button. */
  footer?: ReactNode;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState(initialStartDate ?? todayInZone(timeZone));
  const [views, setViews] = useState<ViewRow[]>(initialViews);
  const [parentId, setParentId] = useState<string | null>(initialParentId);
  const [allowDirectLogging, setAllowDirectLogging] = useState(initialAllowDirectLogging);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const hasActiveSubhabit =
    habitId != null && childrenOf(habitId, habits).some((h) => !h.archivedAt);
  const selectedParentName = parentId ? habits.find((h) => h.id === parentId)?.name : undefined;

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
      parentId,
      allowDirectLogging,
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
      <Title>{submitLabel === "Save" ? "Edit habit" : "New habit"}</Title>
      <Field label="Name" value={name} onChangeText={setName} error={errors.name} />
      <Field
        label="Start date (YYYY-MM-DD)"
        value={startDate}
        onChangeText={setStartDate}
        error={errors.startDate}
        placeholder="2026-01-01"
      />

      <View style={styles.field}>
        <Text style={styles.label}>Parent habit (optional)</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPickerOpen(true)}
          style={styles.pickerTrigger}
        >
          <Text style={styles.pickerTriggerText}>
            {selectedParentName ?? "No parent (top-level)"}
          </Text>
        </Pressable>
        {errors.parentId ? <Text style={styles.error}>{errors.parentId}</Text> : null}
      </View>
      <HabitPickerModal
        visible={pickerOpen}
        habits={habits}
        excludeHabitId={habitId}
        selectedId={parentId}
        onSelect={setParentId}
        onClose={() => setPickerOpen(false)}
      />

      {hasActiveSubhabit ? (
        <View style={styles.field}>
          <Text style={styles.label}>Direct logging</Text>
          <ChipRow
            options={["on", "off"] as const}
            value={allowDirectLogging ? "on" : "off"}
            onChange={(v) => setAllowDirectLogging(v === "on")}
            labels={{ on: "Allowed", off: "Only via subhabits" }}
          />
          <Text style={styles.directLoggingCaption}>
            Only shown once a habit has a subhabit — turn this off to require logging through a
            subhabit instead of this one directly.
          </Text>
        </View>
      ) : null}

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
  viewsError: { color: theme.colors.error, fontSize: 12 },
  addViewLink: { alignSelf: "flex-start" },
  addViewLinkText: { color: theme.colors.brand, fontWeight: "600" },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: theme.colors.text.secondary },
  error: { color: theme.colors.error, fontSize: 12 },
  pickerTrigger: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pickerTriggerText: { fontSize: 16, color: theme.colors.text.primary },
  directLoggingCaption: { fontSize: 12, color: theme.colors.text.muted },
});
