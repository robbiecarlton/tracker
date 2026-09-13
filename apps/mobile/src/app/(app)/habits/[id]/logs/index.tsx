import { aggregatedLogs, childrenOf, type HabitLog, type HabitStartDateChange } from "@tracker/core";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { deleteLog } from "@/api/habits";
import { ChipRow } from "@/components/ChipRow";
import { BackButton, Screen } from "@/components/ui";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHabits } from "@/hooks/useHabits";
import { confirmAlert } from "@/lib/confirm";
import { formatCalendarDate, formatLogTimestamp } from "@/lib/date-format";
import { theme } from "@/lib/theme";

type FeedItem =
  | { kind: "log"; sortKey: string; log: HabitLog }
  | { kind: "history"; sortKey: string; change: HabitStartDateChange };

type LogFilter = "all" | "own";

export default function LogList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useCurrentUser();
  const { habits, loading, refetch } = useHabits();
  const habit = habits.find((h) => h.id === id);
  const [filter, setFilter] = useState<LogFilter>("all");

  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!habit) {
    return (
      <Screen>
        <BackButton onPress={() => router.back()} />
        <Text style={{ color: theme.colors.text.muted }}>Habit not found.</Text>
      </Screen>
    );
  }

  const timeZone = user?.timeZone ?? "UTC";
  const hasSubhabits = childrenOf(id, habits).length > 0;
  const logsInScope = filter === "all" ? aggregatedLogs(id, habits) : habit.logs;

  const feed: FeedItem[] = [
    ...logsInScope.map((log): FeedItem => ({ kind: "log", sortKey: log.timestamp, log })),
    ...habit.startDateHistory.map((change): FeedItem => ({
      kind: "history",
      sortKey: change.createdAt,
      change,
    })),
  ].sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0));

  function onDeleteLog(logHabitId: string, logId: string) {
    confirmAlert("Delete log?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteLog(logHabitId, logId);
          refetch();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.backRow}>
        <BackButton onPress={() => router.back()} />
      </View>
      <View style={styles.header}>
        <Text style={styles.heading}>{habit.name} — Logs</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/habits/[id]/logs/new", params: { id } })}
        >
          <Text style={styles.addLink}>+ Add</Text>
        </Pressable>
      </View>

      {hasSubhabits ? (
        <View style={styles.filterRow}>
          <ChipRow
            options={["all", "own"] as const}
            value={filter}
            onChange={setFilter}
            labels={{ all: "All logs", own: "This habit only" }}
          />
        </View>
      ) : null}

      {feed.length === 0 ? (
        <Text style={styles.empty}>No logs yet.</Text>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => (item.kind === "log" ? item.log.id : item.change.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            if (item.kind === "history") {
              return (
                <Text style={styles.historyRow}>
                  Start date changed from{" "}
                  {formatCalendarDate(item.change.previousStartDate, timeZone)} to{" "}
                  {formatCalendarDate(item.change.newStartDate, timeZone)}
                </Text>
              );
            }

            // A rolled-up log from a subhabit was recorded against *its own*
            // habit, not this page's — every lookup/action below has to use
            // that source habit, not the page's `habit`/`id`.
            const sourceHabit = habits.find((h) => h.id === item.log.habitId) ?? habit;
            const isFromChild = item.log.habitId !== id;
            const isArchiveLog = item.log.timestamp < sourceHabit.startDate;
            return (
              <View style={styles.logRow}>
                <View style={styles.logRowMain}>
                  <View style={styles.logRowHeader}>
                    <Text style={styles.logTimestamp}>
                      {formatLogTimestamp(item.log.timestamp, timeZone)}
                    </Text>
                    {isFromChild ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>From: {sourceHabit.name}</Text>
                      </View>
                    ) : null}
                    {isArchiveLog ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>Archive log</Text>
                      </View>
                    ) : null}
                  </View>
                  {item.log.notes ? <Text style={styles.logNotes}>{item.log.notes}</Text> : null}
                </View>
                <View style={styles.logActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/habits/[id]/logs/[logId]",
                        params: { id: item.log.habitId, logId: item.log.id },
                      })
                    }
                    hitSlop={8}
                  >
                    <Text style={styles.actionLink}>Edit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onDeleteLog(item.log.habitId, item.log.id)}
                    hitSlop={8}
                  >
                    <Text style={[styles.actionLink, styles.deleteLink]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 60 },
  backRow: { paddingHorizontal: 20, marginBottom: 4 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  heading: { fontSize: 20, fontWeight: "700", color: theme.colors.text.primary, flexShrink: 1 },
  addLink: { color: theme.colors.brand, fontWeight: "600", fontSize: 16 },
  filterRow: { paddingHorizontal: 20, marginBottom: 12 },
  empty: {
    color: theme.colors.text.muted,
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 20,
  },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  historyRow: {
    fontSize: 13,
    color: theme.colors.text.muted,
    fontStyle: "italic",
    paddingVertical: 6,
  },
  logRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  logRowMain: { flex: 1, gap: 4 },
  logRowHeader: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  logTimestamp: { fontSize: 14, fontWeight: "600", color: theme.colors.text.primary },
  logNotes: { fontSize: 14, color: theme.colors.text.secondary },
  badge: {
    backgroundColor: theme.colors.badge.background,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, color: theme.colors.badge.text, fontWeight: "600" },
  logActions: { flexDirection: "row", gap: 12 },
  actionLink: { color: theme.colors.brand, fontSize: 13, fontWeight: "600" },
  deleteLink: { color: theme.colors.error },
});
