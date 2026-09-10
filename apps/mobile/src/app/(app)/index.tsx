import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/ui";
import { signOut, useSession } from "@/lib/auth";

export default function Dashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  // The Better Auth client doesn't infer server-side additionalFields, so read
  // the custom `timezone` field through a narrow cast.
  const user = session?.user as { email?: string; timezone?: string } | undefined;

  async function onSignOut() {
    await signOut();
    router.replace("/(auth)/sign-in");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Dashboard</Text>
      <Text style={styles.body}>
        Signed in as {user?.email ?? "unknown"}
        {"\n"}Timezone: {user?.timezone ?? "—"}
      </Text>
      <Text style={styles.soon}>Habit tracking arrives in the next build.</Text>
      <PrimaryButton label="Sign out" onPress={onSignOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", gap: 12, backgroundColor: "#fff" },
  heading: { fontSize: 28, fontWeight: "700", color: "#1a1a1a" },
  body: { fontSize: 15, color: "#3c4043", lineHeight: 22 },
  soon: { fontSize: 14, color: "#5f6368", marginBottom: 8 },
});
