import type { HeatmapBucket, HeatmapUnit } from "@tracker/core";
import { StyleSheet, Text, View } from "react-native";
import { formatCalendarDate, formatMonthYear } from "@/lib/date-format";
import { theme } from "@/lib/theme";

/** "Sep 11, 2026" (day) / "Week of Sep 7, 2026" (week) / "September 2026" (month). */
function dateLabel(bucket: HeatmapBucket, unit: HeatmapUnit, timeZone: string): string {
  switch (unit) {
    case "day":
      return formatCalendarDate(bucket.start, timeZone);
    case "week":
      return `Week of ${formatCalendarDate(bucket.start, timeZone)}`;
    case "month":
      return formatMonthYear(bucket.start, timeZone);
  }
}

/**
 * A heatmap cell's contents: the bucket's date, its log count, and the
 * individual logs that landed in it (each showing which habit it actually
 * came from — a habit's heatmap rolls up its sub-habits' logs too — plus
 * its notes). Pure presentation, no gesture/hover logic of its own, so the
 * same content renders inside both the web hover tooltip and the native
 * long-press readout (see `Heatmap.tsx`).
 */
export function HeatmapBucketDetail({
  bucket,
  unit,
  timeZone,
  getHabitPath,
}: {
  bucket: HeatmapBucket;
  unit: HeatmapUnit;
  timeZone: string;
  getHabitPath: (habitId: string) => string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>{dateLabel(bucket, unit, timeZone)}</Text>
      <Text style={styles.count}>{bucket.count === 1 ? "1 log" : `${bucket.count} logs`}</Text>
      {bucket.logs.length > 0 ? (
        <View style={styles.logList}>
          {bucket.logs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logPath}>{getHabitPath(log.habitId)}</Text>
              {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 160,
    maxWidth: 260,
    gap: 4,
  },
  header: { fontSize: 13, fontWeight: "700", color: theme.colors.text.primary },
  count: { fontSize: 12, color: theme.colors.text.muted },
  logList: { marginTop: 4, gap: 6 },
  logRow: { gap: 1 },
  logPath: { fontSize: 12, fontWeight: "600", color: theme.colors.text.secondary },
  logNotes: { fontSize: 12, color: theme.colors.text.muted },
});
