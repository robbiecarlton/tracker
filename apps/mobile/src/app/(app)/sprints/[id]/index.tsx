import {
  dailyAverageNeeded,
  remainingSprintDates,
  remainingSprintDays,
  sprintPoints,
  sprintStatus,
  suggestDailyPlan,
  type SuggestionItem,
  type TimeContext,
} from "@tracker/core";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BackButton, Screen, Title } from "@/components/ui";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHabits } from "@/hooks/useHabits";
import { useSprints } from "@/hooks/useSprints";
import { formatLogTimestamp } from "@/lib/date-format";
import {
  formatDailyAverage,
  sprintLabel,
  suggestionDayLabel,
  suggestionLabel,
  suggestionRollupLabel,
} from "@/lib/points-format";
import { theme } from "@/lib/theme";

/**
 * One sprint's points view: its stats, then for each remaining day a random
 * set of point-earning habits that would hit the daily average (rounded up).
 * Suggestions are just ideas — regenerated on every visit and on Reroll,
 * never saved.
 */
export default function SprintDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const { habits, loading: habitsLoading, refetch: refetchHabits } = useHabits();
  const { sprints, loading: sprintsLoading, refetch: refetchSprints } = useSprints();
  // Bumped by Reroll (and on every focus) to regenerate the suggestions.
  const [rollKey, setRollKey] = useState(0);
  const sprint = sprints.find((s) => s.id === id);
  const timeZone = user?.timeZone ?? "UTC";

  useFocusEffect(
    useCallback(() => {
      refetchHabits();
      refetchSprints();
      setRollKey((k) => k + 1);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // `now` is captured per roll, so stats and suggestions agree on "today".
  const view = useMemo(() => {
    if (!sprint) return null;
    const ctx: TimeContext = { now: new Date().toISOString(), timeZone };
    const { total } = sprintPoints(sprint, habits, ctx);
    const avg = dailyAverageNeeded(sprint, total, ctx);
    const dailyTarget = Math.ceil(avg);
    return {
      ctx,
      total,
      avg,
      dailyTarget,
      status: sprintStatus(sprint, ctx),
      daysLeft: remainingSprintDays(sprint, ctx),
      days: remainingSprintDates(sprint, ctx).map((date) => ({
        date,
        plan: dailyTarget > 0 ? suggestDailyPlan(habits, dailyTarget) : null,
      })),
    };
    // rollKey is deliberately a dependency: changing it rerolls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprint, habits, timeZone, rollKey]);

  if ((habitsLoading || sprintsLoading) && !view) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!sprint || !view) {
    return (
      <Screen>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.muted}>Sprint not found.</Text>
      </Screen>
    );
  }

  const habitName = (habitId: string) => habits.find((h) => h.id === habitId)?.name ?? "?";
  const hasPointHabits = habits.some((h) => !h.archivedAt && h.pointsKind);

  return (
    <Screen>
      <View style={styles.topRow}>
        <BackButton onPress={() => router.back()} />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/sprints/[id]/edit", params: { id: sprint.id } })}
          hitSlop={8}
        >
          <Text style={styles.editLink}>Edit</Text>
        </Pressable>
      </View>
      <Title>{sprintLabel(sprint, timeZone)}</Title>

      <View style={styles.stats}>
        <Stat label="Points" value={`${view.total} / ${sprint.target}`} />
        <Stat
          label="Needed per day"
          value={view.status === "ended" ? "—" : formatDailyAverage(view.avg)}
        />
        <Stat label="Days left" value={String(view.daysLeft)} />
      </View>
      <Text style={styles.muted}>
        {formatLogTimestamp(sprint.startAt, timeZone)} →{" "}
        {formatLogTimestamp(sprint.endAt, timeZone)}
      </Text>

      {view.status === "ended" ? (
        <Text style={styles.muted}>
          This sprint has ended — {view.total >= sprint.target ? "target hit!" : "target missed."}
        </Text>
      ) : view.dailyTarget === 0 ? (
        <Text style={styles.muted}>Target hit — nothing more needed.</Text>
      ) : !hasPointHabits ? (
        <Text style={styles.muted}>
          No habits earn points yet. Edit a habit and give it a point value to get suggestions.
        </Text>
      ) : (
        <>
          <View style={styles.suggestionsHeader}>
            <Text style={styles.sectionTitle}>
              One way to get {view.dailyTarget} {view.dailyTarget === 1 ? "point" : "points"} a day
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setRollKey((k) => k + 1)}
              style={styles.rerollButton}
            >
              <Text style={styles.rerollText}>Reroll</Text>
            </Pressable>
          </View>
          {view.days.map(({ date, plan }) => (
            <View key={date} style={styles.day}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{suggestionDayLabel(date, view.ctx)}</Text>
                {plan ? <Text style={styles.dayTotal}>{plan.total} pts</Text> : null}
              </View>
              {plan?.items.map((item) => (
                <SuggestionRow key={item.habitId} item={item} nameOf={habitName} />
              ))}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** "Skip" (clean-day) suggestions are styled apart from ordinary logs. */
function SuggestionRow({
  item,
  nameOf,
}: {
  item: SuggestionItem;
  nameOf: (habitId: string) => string;
}) {
  const skip = item.kind === "clean_day";
  const rollup = suggestionRollupLabel(item, nameOf);
  return (
    <View style={[styles.suggestion, skip && styles.suggestionSkip]}>
      <View style={styles.suggestionMain}>
        <Text style={[styles.suggestionText, skip && styles.suggestionSkipText]}>
          {suggestionLabel(item, nameOf(item.habitId))}
        </Text>
        {rollup ? <Text style={styles.suggestionRollup}>{rollup}</Text> : null}
      </View>
      <Text style={[styles.suggestionPoints, skip && styles.suggestionSkipText]}>
        +{item.points}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  editLink: { color: theme.colors.brand, fontWeight: "600", fontSize: 15 },
  muted: { color: theme.colors.text.muted, fontSize: 13 },
  stats: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "700", color: theme.colors.text.primary },
  statLabel: { fontSize: 11, color: theme.colors.text.muted },
  suggestionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  sectionTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text.primary,
  },
  rerollButton: {
    borderWidth: 1,
    borderColor: theme.colors.brand,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  rerollText: { color: theme.colors.brand, fontWeight: "600" },
  day: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  dayHeader: { flexDirection: "row", justifyContent: "space-between" },
  dayTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text.secondary },
  dayTotal: { fontSize: 13, color: theme.colors.text.muted },
  suggestion: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: theme.colors.points.background,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  suggestionSkip: { backgroundColor: theme.colors.points.skipBackground },
  suggestionMain: { flexShrink: 1, gap: 2 },
  suggestionText: { color: theme.colors.points.text, fontWeight: "600" },
  suggestionRollup: { color: theme.colors.points.text, fontSize: 12 },
  suggestionSkipText: { color: theme.colors.points.skipText },
  suggestionPoints: { color: theme.colors.points.text },
});
