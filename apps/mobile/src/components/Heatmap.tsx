import {
  DEFAULT_HEATMAP_POLARITY,
  type HeatmapBucket,
  type HeatmapPolarity,
  type HeatmapResult,
} from "@tracker/core";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, ScrollView } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { HeatmapBucketDetail } from "./HeatmapBucketDetail";
import { theme } from "@/lib/theme";

const CELL_SIZE = 11;
const CELL_GAP = 2;
const CELL_STRIDE = CELL_SIZE + CELL_GAP;

/** Splits `items` into consecutive chunks of `size` (last chunk may be shorter). */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Cell color: neutral gray at 0 logs, else one of 4 increasingly-opaque
 * steps of `polarity`'s base color (`theme.colors.heatmapPolarity`),
 * scaled by this bucket's count relative to the busiest bucket shown — a
 * relative scale (not fixed thresholds) so it reads sensibly whether a
 * habit gets logged once or a dozen times a unit.
 */
function cellColor(count: number, max: number, polarity: HeatmapPolarity): string {
  if (count === 0) return theme.colors.badge.background;
  const ratio = count / max;
  const alpha = ratio <= 0.25 ? "40" : ratio <= 0.5 ? "80" : ratio <= 0.75 ? "bf" : "ff";
  return `${theme.colors.heatmapPolarity[polarity]}${alpha}`;
}

/**
 * Maps a point in the grid's own local coordinates to a bucket index,
 * mirroring the exact layout `Heatmap` below lays cells out in: `day`
 * arranges 7-row Monday-Sunday columns left to right (`col * 7 + row`);
 * `week`/`month` wrap a fixed number of cells per row, top to bottom
 * (`row * perRow + col`). Analytic rather than measured (`onLayout` per
 * cell) since the cell size/gap are fixed constants and the grid geometry
 * is fully deterministic. Used only by the native long-press-drag gesture
 * below — hovering on web instead reads the bucket straight off the
 * hovered `Cell`, no hit-testing needed.
 */
function bucketIndexAt(x: number, y: number, result: HeatmapResult): number | null {
  const col = Math.floor(x / CELL_STRIDE);
  const row = Math.floor(y / CELL_STRIDE);
  if (col < 0 || row < 0) return null;

  if (result.unit === "day") {
    if (row > 6) return null;
    const index = col * 7 + row;
    return index < result.buckets.length ? index : null;
  }

  const perRow = result.unit === "week" ? 13 : 12;
  if (col >= perRow) return null;
  const index = row * perRow + col;
  return index < result.buckets.length ? index : null;
}

function Cell({
  bucket,
  max,
  polarity,
  onHoverIn,
  onHoverOut,
}: {
  bucket: HeatmapBucket;
  max: number;
  polarity: HeatmapPolarity;
  onHoverIn: (event: unknown, bucket: HeatmapBucket) => void;
  onHoverOut: () => void;
}) {
  return (
    <Pressable
      style={[styles.cell, { backgroundColor: cellColor(bucket.count, max, polarity) }]}
      onHoverIn={(event) => onHoverIn(event, bucket)}
      onHoverOut={onHoverOut}
    />
  );
}

/**
 * GitHub/Anki-style calendar heatmap for a `heatmap` view's computed
 * result. `day` renders a real calendar grid (columns = ISO-Monday weeks,
 * per `computeHeatmap`'s window alignment); `week`/`month` have no
 * meaningful day-of-week alignment, so they just wrap a fixed number of
 * cells per row.
 *
 * Hovering (web) or long-pressing-then-dragging (native — there's no
 * hover) a cell reveals its date, count, and contributing logs via
 * `HeatmapBucketDetail`. `timeZone`/`getHabitPath` exist purely to feed
 * that detail view; this component otherwise treats them as opaque, the
 * same way it already treats `polarity`.
 */
export function Heatmap({
  result,
  polarity = DEFAULT_HEATMAP_POLARITY,
  timeZone,
  getHabitPath,
}: {
  result: HeatmapResult;
  polarity?: HeatmapPolarity;
  timeZone: string;
  getHabitPath: (habitId: string) => string;
}) {
  const max = Math.max(1, ...result.buckets.map((b) => b.count));
  const rootRef = useRef<View>(null);

  // Web: a tooltip anchored to whichever cell is currently hovered.
  const [webTooltip, setWebTooltip] = useState<{
    bucket: HeatmapBucket;
    x: number;
    y: number;
  } | null>(null);

  function handleHoverIn(event: unknown, bucket: HeatmapBucket) {
    if (Platform.OS !== "web") return;
    // react-native-web forwards a real DOM event; measuring the hovered
    // cell against the grid's own root (rather than the window) keeps the
    // tooltip's position correct regardless of where the card sits on the
    // page or whether the day-unit grid has been scrolled.
    const cellEl = (event as { currentTarget?: unknown }).currentTarget as HTMLElement | undefined;
    const rootEl = rootRef.current as unknown as HTMLElement | null;
    if (!cellEl || !rootEl) return;
    const cellRect = cellEl.getBoundingClientRect();
    const rootRect = rootEl.getBoundingClientRect();
    setWebTooltip({
      bucket,
      x: cellRect.left - rootRect.left,
      y: cellRect.bottom - rootRect.top + 6,
    });
  }

  function handleHoverOut() {
    setWebTooltip(null);
  }

  // Native: long-press a cell, then drag across the grid; a floating
  // readout above it tracks whichever cell is currently under the finger.
  const [inspectedBucket, setInspectedBucket] = useState<HeatmapBucket | null>(null);

  function updateInspectedBucket(x: number, y: number) {
    const index = bucketIndexAt(x, y, result);
    setInspectedBucket(index !== null ? (result.buckets[index] ?? null) : null);
  }

  const inspectGesture = Gesture.Pan()
    .activateAfterLongPress(350)
    .onStart((e) => runOnJS(updateInspectedBucket)(e.x, e.y))
    .onUpdate((e) => runOnJS(updateInspectedBucket)(e.x, e.y))
    .onFinalize(() => runOnJS(setInspectedBucket)(null));

  const isNative = Platform.OS !== "web";

  const dayContent = (
    <View style={styles.dayGrid}>
      {chunk(result.buckets, 7).map((week, i) => (
        <View key={i} style={styles.dayColumn}>
          {week.map((bucket) => (
            <Cell
              key={bucket.start}
              bucket={bucket}
              max={max}
              polarity={polarity}
              onHoverIn={handleHoverIn}
              onHoverOut={handleHoverOut}
            />
          ))}
        </View>
      ))}
    </View>
  );

  const wrapContent = (
    <View style={styles.wrapGrid}>
      {chunk(result.buckets, result.unit === "week" ? 13 : 12).map((row, i) => (
        <View key={i} style={styles.wrapRow}>
          {row.map((bucket) => (
            <Cell
              key={bucket.start}
              bucket={bucket}
              max={max}
              polarity={polarity}
              onHoverIn={handleHoverIn}
              onHoverOut={handleHoverOut}
            />
          ))}
        </View>
      ))}
    </View>
  );

  const grid =
    result.unit === "day" ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll}>
        {isNative ? (
          <GestureDetector gesture={inspectGesture}>{dayContent}</GestureDetector>
        ) : (
          dayContent
        )}
      </ScrollView>
    ) : isNative ? (
      <GestureDetector gesture={inspectGesture}>{wrapContent}</GestureDetector>
    ) : (
      wrapContent
    );

  return (
    <View ref={rootRef} style={styles.root}>
      {grid}
      {!isNative && webTooltip ? (
        <View
          pointerEvents="none"
          style={[styles.tooltip, { left: webTooltip.x, top: webTooltip.y }]}
        >
          <HeatmapBucketDetail
            bucket={webTooltip.bucket}
            unit={result.unit}
            timeZone={timeZone}
            getHabitPath={getHabitPath}
          />
        </View>
      ) : null}
      {isNative && inspectedBucket ? (
        <View pointerEvents="none" style={styles.nativeReadout}>
          <HeatmapBucketDetail
            bucket={inspectedBucket}
            unit={result.unit}
            timeZone={timeZone}
            getHabitPath={getHabitPath}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "relative", alignSelf: "stretch" },
  cell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: 2 },
  dayScroll: { alignSelf: "stretch" },
  dayGrid: { flexDirection: "row", gap: CELL_GAP },
  dayColumn: { gap: CELL_GAP },
  wrapGrid: { gap: CELL_GAP },
  wrapRow: { flexDirection: "row", gap: CELL_GAP },
  tooltip: { position: "absolute", zIndex: 10 },
  nativeReadout: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "100%",
    marginBottom: 8,
    alignItems: "center",
    zIndex: 10,
  },
});
