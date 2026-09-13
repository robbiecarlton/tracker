import { StyleSheet, Text } from "react-native";
import { theme } from "@/lib/theme";
import { APP_VERSION } from "@/lib/version";

/**
 * Small, unobtrusive version label pinned to the top-right corner of every
 * screen, auth pages included — rendered once in the root layout
 * (`app/_layout.tsx`) so it overlays every route without each screen having
 * to add it itself. `pointerEvents: "none"` so it never intercepts a tap
 * even where it happens to sit over other content.
 */
export function VersionBadge() {
  return (
    <Text style={styles.text} pointerEvents="none">
      v{APP_VERSION}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    position: "absolute",
    top: 10,
    right: 12,
    fontSize: 10,
    color: theme.colors.text.faint,
    zIndex: 1000,
  },
});
