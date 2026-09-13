import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { theme } from "@/lib/theme";

/**
 * A plain `View` with `justifyContent: "center"` looked fine while every
 * form fit on screen, but once content grows past the viewport (e.g. the
 * habit edit form once nested-habits added a picker + toggle), there was no
 * `ScrollView` to scroll — the excess just clipped, vertically centered and
 * stuck. `ScrollView` gives normal page behavior instead: top-aligned,
 * scrolls when content overflows, unchanged when it doesn't.
 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

/** A "‹ Back" link. Router-agnostic on purpose — pass `onPress={() => router.back()}`. */
export function BackButton({ label = "Back", onPress }: { label?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={styles.backButton}>
      <Text style={styles.backButtonText}>‹ {label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...inputProps
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={theme.colors.text.faint}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.onBrand} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.formError}>{message}</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screenContent: {
    padding: 24,
    gap: 16,
  },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 8, color: theme.colors.text.primary },
  backButton: { alignSelf: "flex-start", paddingVertical: 4, marginBottom: 4 },
  backButtonText: { color: theme.colors.text.muted, fontSize: 15, fontWeight: "600" },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: theme.colors.text.secondary },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  inputError: { borderColor: theme.colors.error },
  error: { color: theme.colors.error, fontSize: 12 },
  button: {
    backgroundColor: theme.colors.brand,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { backgroundColor: theme.colors.brandDisabled },
  buttonText: { color: theme.colors.onBrand, fontSize: 16, fontWeight: "600" },
  formError: { color: theme.colors.error, fontSize: 14, textAlign: "center" },
});
