import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "./theme";

export type ConfirmButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void | Promise<void>;
};

type ConfirmRequest = {
  title: string;
  message?: string;
  buttons: ConfirmButton[];
};

let showRequest: ((request: ConfirmRequest) => void) | null = null;

/**
 * Drop-in replacement for `Alert.alert` (same `(title, message, buttons)`
 * shape) — needed because react-native-web ships `Alert.alert` as a complete
 * no-op (`static alert() {}`), silently swallowing every confirmation
 * dialog on web: delete habit, delete log, and the Archive-vs-Keep
 * start-date prompt. Backed by RN's `Modal`, which react-native-web *does*
 * implement for real. Requires `<ConfirmHost />` mounted once near the app
 * root (see `app/_layout.tsx`).
 */
export function confirmAlert(
  title: string,
  message?: string,
  buttons: ConfirmButton[] = [{ text: "OK" }],
) {
  if (!showRequest) {
    // Should never happen once ConfirmHost is mounted at root — fail loud
    // in dev rather than silently swallowing the dialog the way the bug
    // we're replacing did.
    console.warn("confirmAlert called before ConfirmHost mounted");
    return;
  }
  showRequest({ title, message, buttons });
}

/** Mount once near the app root. Renders whatever `confirmAlert` requests. */
export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    showRequest = (r) => setRequest(r);
    return () => {
      showRequest = null;
    };
  }, []);

  function handlePress(button: ConfirmButton) {
    setRequest(null);
    button.onPress?.();
  }

  function handleDismiss() {
    // Backdrop tap / Android back button: behave like the cancel button
    // when there is one, otherwise just close.
    const cancel = request?.buttons.find((b) => b.style === "cancel");
    setRequest(null);
    cancel?.onPress?.();
  }

  if (!request) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleDismiss}>
      <Pressable style={styles.backdrop} onPress={handleDismiss}>
        {/* Empty onPress captures the touch so it doesn't bubble to the
            backdrop's onPress above. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.content}>
            <Text style={styles.title}>{request.title}</Text>
            {request.message ? <Text style={styles.message}>{request.message}</Text> : null}
          </View>
          <View style={styles.buttons}>
            {request.buttons.map((button, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                onPress={() => handlePress(button)}
                style={({ pressed }) => [
                  styles.button,
                  i > 0 && styles.buttonBorder,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === "destructive" && styles.destructiveText,
                    button.style === "cancel" && styles.cancelText,
                  ]}
                >
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 14,
    width: "100%",
    maxWidth: 400,
    overflow: "hidden",
  },
  content: { paddingHorizontal: 20, paddingVertical: 20, gap: 8 },
  title: { fontSize: 17, fontWeight: "700", color: theme.colors.text.primary, textAlign: "center" },
  message: { fontSize: 14, color: theme.colors.text.secondary, textAlign: "center" },
  buttons: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  button: { paddingVertical: 14, alignItems: "center" },
  buttonBorder: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  buttonPressed: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: "600", color: theme.colors.brand },
  destructiveText: { color: theme.colors.error },
  cancelText: { color: theme.colors.text.muted, fontWeight: "500" },
});
