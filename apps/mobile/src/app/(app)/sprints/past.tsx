import { sprintPoints, sprintStatus, type TimeContext } from "@tracker/core";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { BackButton } from "@/components/ui";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHabits } from "@/hooks/useHabits";
import { useSprints } from "@/hooks/useSprints";
import { formatCalendarDate } from "@/lib/date-format";
import { sprintLabel } from "@/lib/points-format";
import { theme } from "@/lib/theme";

/** Sprints whose end has passed — final total vs target, most recent first. */
export default function PastSprints() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { habits, refetch: refetchHabits } = useHabits();
  const { sprints, loading, error, refetch: refetchSprints } = useSprints();
  const timeZone = user?.timeZone ?? "UTC";
  const ctx: TimeContext = { now: new Date().toISOString(), timeZone };
  const past = sprints.filter((s) => sprintStatus(s, ctx) === "ended").reverse();

  useFocusEffect(
    useCallback(() => {
      refetchHabits();
      refetchSprints();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <View style={styles.container}>
      <View style={styles.backRow}>
        <BackButton onPress={() => router.back()} />
      </View>
      <Text style={styles.heading}>Past sprints</Text>

      {loading && past.length === 0 ? null : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : past.length === 0 ? (
        <Text style={styles.empty}>No finished sprints yet.</Text>
      ) : (
        <FlatList
          data={past}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const { total } = sprintPoints(item, habits, ctx);
            const hit = total >= item.target;
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/sprints/[id]", params: { id: item.id } })}
                style={styles.row}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.name}>{sprintLabel(item, timeZone)}</Text>
                  <Text style={styles.dates}>
                    {formatCalendarDate(item.startAt, timeZone)} –{" "}
                    {formatCalendarDate(item.endAt, timeZone)}
                  </Text>
                </View>
                <View style={styles.result}>
                  <Text style={styles.total}>
                    {total} / {item.target}
                  </Text>
                  <Text style={[styles.outcome, hit ? styles.hit : styles.miss]}>
                    {hit ? "Hit" : "Missed"}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 60 },
  backRow: { paddingHorizontal: 20 },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: theme.colors.text.primary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  error: { color: theme.colors.error, paddingHorizontal: 20 },
  empty: { color: theme.colors.text.muted, paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, gap: 10, paddingBottom: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  rowMain: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "600", color: theme.colors.text.primary },
  dates: { fontSize: 12, color: theme.colors.text.muted },
  result: { alignItems: "flex-end", gap: 2 },
  total: { fontSize: 15, fontWeight: "700", color: theme.colors.text.primary },
  outcome: { fontSize: 12, fontWeight: "600" },
  hit: { color: theme.colors.heatmapPolarity.positive },
  miss: { color: theme.colors.error },
});
