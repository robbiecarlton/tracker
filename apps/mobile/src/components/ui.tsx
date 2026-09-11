import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { theme } from "@/lib/theme";

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
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
    padding: 24,
    justifyContent: "center",
    gap: 16,
    backgroundColor: theme.colors.background,
  },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 8, color: theme.colors.text.primary },
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
