import { Redirect, Stack } from "expo-router";
import { useSession } from "@/lib/auth";

export default function AuthLayout() {
  const { data: session, isPending } = useSession();

  if (!isPending && session) {
    return <Redirect href="/(app)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
