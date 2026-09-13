import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

/**
 * A horizontal row of pill-style options, one active at a time — this
 * app's one general "choose from a small fixed set" control (view kind,
 * unit, target type in `HabitForm.tsx`; the direct-logging toggle and the
 * log-list source filter). Lifted out of `HabitForm.tsx` once a second
 * screen needed it.
 */
export function ChipRow<T extends string>({
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

const styles = StyleSheet.create({
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
});
