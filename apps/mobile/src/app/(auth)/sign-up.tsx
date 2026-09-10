import { signUpSchema } from "@tracker/core";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Field, FormError, PrimaryButton, Screen, Title } from "@/components/ui";
import { signUp } from "@/lib/auth";
import { fieldErrors } from "@/lib/forms";
import { getDeviceTimeZone } from "@/lib/timezone";

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setFormError(undefined);
    const parsed = signUpSchema.safeParse({
      name,
      email,
      password,
      timezone: getDeviceTimeZone(),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await signUp.email({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
      // Extra field accepted by Better Auth (user.additionalFields.timezone)
      timezone: parsed.data.timezone,
    } as Parameters<typeof signUp.email>[0]);
    setLoading(false);
    if (error) {
      setFormError(error.message ?? "Could not create account");
      return;
    }
    router.replace("/(app)");
  }

  return (
    <Screen>
      <Title>Create account</Title>
      <Field label="Name" value={name} onChangeText={setName} error={errors.name} />
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
        autoComplete="new-password"
        error={errors.password}
      />
      <FormError message={formError} />
      <PrimaryButton label="Create account" onPress={onSubmit} loading={loading} />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 4 }}>
        <Text style={{ color: "#5f6368" }}>Already have an account?</Text>
        <Link href="/(auth)/sign-in" style={{ color: "#208AEF", fontWeight: "600" }}>
          Sign in
        </Link>
      </View>
    </Screen>
  );
}
