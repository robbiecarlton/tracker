import { signInSchema } from "@tracker/core";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Field, FormError, PrimaryButton, Screen, Title } from "@/components/ui";
import { signIn } from "@/lib/auth";
import { fieldErrors } from "@/lib/forms";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setFormError(undefined);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) {
      setFormError(error.message ?? "Could not sign in");
      return;
    }
    router.replace("/(app)");
  }

  return (
    <Screen>
      <Title>Sign in</Title>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        error={errors.email}
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        error={errors.password}
      />
      <FormError message={formError} />
      <PrimaryButton label="Sign in" onPress={onSubmit} loading={loading} />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}>
        <Text style={{ color: "#5f6368" }}>No account?</Text>
        <Link href="/(auth)/sign-up" style={{ color: "#208AEF", fontWeight: "600" }}>
          Create one
        </Link>
      </View>
    </Screen>
  );
}
