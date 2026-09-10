import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";

/**
 * Better Auth client shared by web and native. On native the Expo plugin stores
 * the session token in the system keychain via SecureStore; on web it falls
 * back to cookies automatically.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: "tracker",
      storagePrefix: "tracker",
      storage: SecureStore,
    }),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
