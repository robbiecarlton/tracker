import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { unarchiveHabit } from "@/api/habits";
import { BackButton } from "@/components/ui";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHabits } from "@/hooks/useHabits";
import { formatCalendarDate } from "@/lib/date-format";
import { theme } from "@/lib/theme";

export default function ArchivedHabits() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { habits, loading, error, refetch } = useHabits();
  const archived = habits.filter((h) => h.archivedAt);
  const timeZone = user?.timeZone ?? "UTC";

  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function onUnarchive(id: string) {
    await unarchiveHabit(id);
    refetch();
  }

  return (
    <View style={styles.container}>
      <View style={styles.backRow}>
        <BackButton onPress={() => router.back()} />
      </View>
      <Text style={styles.heading}>Archived habits</Text>

      {loading && archived.length === 0 ? null : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : archived.length === 0 ? (
        <Text style={styles.empty}>No archived habits.</Text>
      ) : (
        <FlatList
          data={archived}
          keyExtractor={(h) => h.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.name}>{item.name}</Text>
                {item.archivedAt ? (
                  <Text style={styles.archivedOn}>
                    Archived on {formatCalendarDate(item.archivedAt, timeZone)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: "/habits/[id]/edit", params: { id: item.id } })
                  }
                  hitSlop={8}
                >
                  <Text style={styles.actionLink}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onUnarchive(item.id)}
                  hitSlop={8}
                >
                  <Text style={styles.actionLink}>Unarchive</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 60 },
  backRow: { paddingHorizontal: 20, marginBottom: 4 },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text.primary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  error: { color: theme.colors.error, textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
  empty: {
    color: theme.colors.text.muted,
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 20,
  },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
  },
  rowMain: { gap: 2, flexShrink: 1 },
  name: { fontSize: 16, fontWeight: "600", color: theme.colors.text.primary },
  archivedOn: { fontSize: 13, color: theme.colors.text.muted },
  actions: { flexDirection: "row", gap: 16 },
  actionLink: { color: theme.colors.brand, fontSize: 13, fontWeight: "600" },
});
