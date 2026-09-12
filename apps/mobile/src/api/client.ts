import { authClient } from "@/lib/auth";
import { API_URL } from "@/lib/config";
import { parseJsonPlain } from "./json";

/**
 * `authClient.$fetch` (better-auth's underlying `@better-fetch/fetch`
 * instance) already authenticates transparently on both platforms: on web it
 * defaults to `credentials: "include"` (the browser sends the session
 * cookie); on native, the `expoClient()` plugin already configured in
 * `lib/auth.ts` attaches the SecureStore-persisted session as a `cookie`
 * header. It also auto-serializes a plain-object `body` to JSON.
 *
 * One gotcha: `$fetch`'s own configured `baseURL` resolves to
 * `${API_URL}/api/auth` (better-auth's own namespace), so a relative path
 * would be misrouted. Passing a fully-qualified URL bypasses that entirely
 * — `@better-fetch/fetch` treats any URL starting with "http" as absolute.
 *
 * A second gotcha, more subtle: `authClient.$fetch`'s shared client config
 * (`better-auth/dist/client/config.mjs`) sets a custom `jsonParser` whose
 * reviver (`better-auth/dist/client/parser.mjs`'s `betterJSONParse`, with
 * `parseDates: true` by default) matches *every* ISO-8601-shaped string in a
 * response and silently replaces it with a `Date` object — useful for Better
 * Auth's own session fields, but it also mangled `startDate`/`createdAt`/
 * `timestamp` etc. on our `/api/habits*` responses (which `@tracker/core`'s
 * types and Luxon's `parseInZone` require as plain strings), causing
 * "Invalid datetime"-style crashes and `TypeError: x.slice is not a
 * function`. `@better-fetch/fetch` merges call-level options over the
 * client's (`{...config, ...options}`), so passing our own plain `jsonParser`
 * below overrides that behavior for every request through `apiFetch` — while
 * leaving it intact for Better Auth's own internal calls elsewhere.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error ${status}`);
  }
}

export async function apiFetch<T>(
  path: string,
  init?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown },
): Promise<T> {
  const { data, error } = await authClient.$fetch<T>(`${API_URL}${path}`, {
    method: init?.method ?? "GET",
    body: init?.body,
    jsonParser: parseJsonPlain,
  });
  if (error) throw new ApiError(error.status, error);
  return data as T;
}
