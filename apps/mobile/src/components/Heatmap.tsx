import type { HeatmapResult } from "@tracker/core";
import { ScrollView, StyleSheet, View } from "react-native";
import { theme } from "@/lib/theme";

const CELL_SIZE = 11;
const CELL_GAP = 2;

/** Splits `items` into consecutive chunks of `size` (last chunk may be shorter). */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Cell color: neutral gray at 0 logs, else one of 4 increasingly-opaque
 * steps of the app's brand blue, scaled by this bucket's count relative to
 * the busiest bucket shown — a relative scale (not fixed thresholds) so it
 * reads sensibly whether a habit gets logged once or a dozen times a unit.
 */
function cellColor(count: number, max: number): string {
  if (count === 0) return theme.colors.badge.background;
  const ratio = count / max;
  const alpha = ratio <= 0.25 ? "40" : ratio <= 0.5 ? "80" : ratio <= 0.75 ? "bf" : "ff";
  return `${theme.colors.brand}${alpha}`;
}

function Cell({ count, max }: { count: number; max: number }) {
  return <View style={[styles.cell, { backgroundColor: cellColor(count, max) }]} />;
}

/**
 * GitHub/Anki-style calendar heatmap for a `heatmap` view's computed
 * result. `day` renders a real calendar grid (columns = ISO-Monday weeks,
 * per `computeHeatmap`'s window alignment); `week`/`month` have no
 * meaningful day-of-week alignment, so they just wrap a fixed number of
 * cells per row.
 */
export function Heatmap({ result }: { result: HeatmapResult }) {
  const max = Math.max(1, ...result.buckets.map((b) => b.count));

  if (result.unit === "day") {
    const columns = chunk(result.buckets, 7); // each: one Monday-Sunday week
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
        <View style={styles.dayGrid}>
          {columns.map((week, i) => (
            <View key={i} style={styles.dayColumn}>
              {week.map((bucket) => (
                <Cell key={bucket.start} count={bucket.count} max={max} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  const perRow = result.unit === "week" ? 13 : 12;
  const rows = chunk(result.buckets, perRow);
  return (
    <View style={styles.wrapGrid}>
      {rows.map((row, i) => (
        <View key={i} style={styles.wrapRow}>
          {row.map((bucket) => (
            <Cell key={bucket.start} count={bucket.count} max={max} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 2 },
  dayScroll: { alignSelf: "stretch" },
  dayGrid: { flexDirection: "row", gap: CELL_GAP },
  dayColumn: { gap: CELL_GAP },
  wrapGrid: { gap: CELL_GAP },
  wrapRow: { flexDirection: "row", gap: CELL_GAP },
});
