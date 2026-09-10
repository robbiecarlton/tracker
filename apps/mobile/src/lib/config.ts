/**
 * Runtime config. `EXPO_PUBLIC_*` vars are inlined by Metro at build time and
 * are safe to expose to the client.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
