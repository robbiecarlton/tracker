import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { HabitCard } from "@/components/HabitCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useHabits } from "@/hooks/useHabits";
import { signOut } from "@/lib/auth";
import { theme } from "@/lib/theme";

export default function Dashboard() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { habits: allHabits, loading, error, refetch } = useHabits();
  const habits = allHabits.filter((h) => !h.archivedAt);

  // The dashboard, create/edit/log screens each own an independent fetch —
  // there's no shared cache yet (see useHabits' doc comment) — so refetch
  // whenever this screen regains focus (e.g. navigating back after an edit).
  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function onSignOut() {
    await signOut();
    router.replace("/(auth)/sign-in");
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Habits</Text>
        <View style={styles.headerLinks}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/habits/archived")}>
            <Text style={styles.archivedLink}>Archived</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push("/habits/new")}>
            <Text style={styles.addLink}>+ New</Text>
          </Pressable>
        </View>
      </View>

      {loading && habits.length === 0 ? (
        <ActivityIndicator style={styles.spinner} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : habits.length === 0 ? (
        <Text style={styles.empty}>No habits yet — tap &ldquo;+ New&rdquo; to add one.</Text>
      ) : (
        <FlatList
          data={habits}
          keyExtractor={(h) => h.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <HabitCard habit={item} timeZone={user?.timeZone ?? "UTC"} onChanged={refetch} />
          )}
        />
      )}

      <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 60 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  heading: { fontSize: 28, fontWeight: "700", color: theme.colors.text.primary },
  headerLinks: { flexDirection: "row", alignItems: "center", gap: 16 },
  archivedLink: { color: theme.colors.text.muted, fontSize: 14 },
  addLink: { color: theme.colors.brand, fontWeight: "600", fontSize: 16 },
  spinner: { marginTop: 40 },
  error: { color: theme.colors.error, textAlign: "center", marginTop: 40, paddingHorizontal: 20 },
  empty: {
    color: theme.colors.text.muted,
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 20,
  },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  signOut: { alignItems: "center", paddingVertical: 16 },
  signOutText: { color: theme.colors.text.muted, fontSize: 14 },
});
