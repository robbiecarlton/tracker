import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

/**
 * One view's tile on a habit card. `highlightColor` comes straight from
 * `@tracker/core`'s `computeHighlight(...)` — an opaque hex string, or
 * `null` (no target configured, or not enough data yet), rendered as a
 * neutral gray tile.
 */
export function ViewTile({
  label,
  value,
  highlightColor,
}: {
  label: string;
  value: string;
  highlightColor: string | null;
}) {
  const tint = highlightColor ?? theme.colors.border;
  return (
    <View style={[styles.tile, { borderColor: tint, backgroundColor: `${tint}1a` }]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 92,
    alignItems: "center",
    gap: 2,
  },
  value: { fontSize: 18, fontWeight: "700", color: theme.colors.text.primary },
  label: { fontSize: 11, color: theme.colors.text.muted },
});
