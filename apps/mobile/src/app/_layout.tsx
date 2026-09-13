import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { VersionBadge } from "@/components/VersionBadge";
import { ConfirmHost } from "@/lib/confirm";

// Required by react-native-gesture-handler (drag-to-reorder on the
// dashboard) — must wrap the whole app, exactly once, at the root.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <ConfirmHost />
      <VersionBadge />
    </GestureHandlerRootView>
  );
}
