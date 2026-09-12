/**
 * A plain JSON parser — no date-string auto-coercion. Kept in its own
 * dependency-free module (rather than inline in `client.ts`) so it's
 * testable without pulling in `lib/auth.ts`'s Expo/SecureStore
 * side-effecting imports, which don't run in a plain Node test environment.
 *
 * See `client.ts`'s doc comment for why this exists: `authClient.$fetch`'s
 * default `jsonParser` (Better Auth's `betterJSONParse`) silently converts
 * every ISO-8601-shaped string in a response into a `Date` object.
 */
export function parseJsonPlain(text: string): unknown {
  if (!text) return null;
  return JSON.parse(text);
}
