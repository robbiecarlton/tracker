import {
  dailyAverageNeeded,
  remainingSprintDays,
  sprintPoints,
  sprintStatus,
  type TimeContext,
} from "@tracker/core";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ApiHabit, ApiSprint } from "@/api/types";
import { formatLogTimestamp } from "@/lib/date-format";
import { formatDailyAverage, sprintLabel } from "@/lib/points-format";
import { theme } from "@/lib/theme";

/**
 * One Point Sprint's mini-dashboard at the top of the home screen: total vs
 * target, the conservative points-per-day still needed, and its dates.
 * Tapping it opens the sprint's own screen (suggestions); "Edit" goes
 * straight to its form.
 */
export function SprintCard({
  sprint,
  habits,
  timeZone,
  onPress,
  onEdit,
}: {
  sprint: ApiSprint;
  habits: ApiHabit[];
  timeZone: string;
  onPress: () => void;
  onEdit: () => void;
}) {
  const ctx: TimeContext = { now: new Date().toISOString(), timeZone };
  const { total } = sprintPoints(sprint, habits, ctx);
  const status = sprintStatus(sprint, ctx);
  const avg = dailyAverageNeeded(sprint, total, ctx);
  const days = remainingSprintDays(sprint, ctx);
  const progress = Math.min(1, total / sprint.target);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>
          {sprintLabel(sprint, timeZone)}
        </Text>
        {status === "upcoming" ? <Text style={styles.upcoming}>Upcoming</Text> : null}
        <Pressable accessibilityRole="button" onPress={onEdit} hitSlop={8}>
          <Text style={styles.editLink}>Edit</Text>
        </Pressable>
      </View>

      <Text style={styles.total}>
        {total} <Text style={styles.target}>/ {sprint.target} pts</Text>
      </Text>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={styles.detail}>
        {total >= sprint.target
          ? "Target hit!"
          : `${formatDailyAverage(avg)} pts/day needed · ${days} ${days === 1 ? "day" : "days"} left`}
      </Text>
      <Text style={styles.dates}>
        {formatLogTimestamp(sprint.startAt, timeZone)} →{" "}
        {formatLogTimestamp(sprint.endAt, timeZone)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: theme.colors.background,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1, fontSize: 15, fontWeight: "700", color: theme.colors.text.primary },
  upcoming: {
    fontSize: 11,
    color: theme.colors.badge.text,
    backgroundColor: theme.colors.badge.background,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  editLink: { marginLeft: "auto", color: theme.colors.brand, fontWeight: "600", fontSize: 14 },
  total: { fontSize: 24, fontWeight: "700", color: theme.colors.text.primary },
  target: { fontSize: 15, fontWeight: "400", color: theme.colors.text.muted },
  bar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.backgroundAlt,
    overflow: "hidden",
  },
  barFill: { height: 6, backgroundColor: theme.colors.brand },
  detail: { fontSize: 13, color: theme.colors.text.secondary },
  dates: { fontSize: 12, color: theme.colors.text.muted },
});
