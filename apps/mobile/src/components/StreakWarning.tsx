import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

/**
 * Shown under a view row set to Streak on the habit form. Informational, not
 * an error — distinct styling from `FormError`. Exact copy per docs/DOMAIN.md.
 */
export function StreakWarning() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Be careful, tracking streaks has mixed benefits and can actually long term demotivate you.
        We suggest using cumulative and percentage or days instead.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.warning.background,
    borderWidth: 1,
    borderColor: theme.colors.warning.border,
    borderRadius: 8,
    padding: 10,
  },
  text: { color: theme.colors.warning.text, fontSize: 13, lineHeight: 18 },
});
