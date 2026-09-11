import { authClient } from "@/lib/auth";
import { API_URL } from "@/lib/config";

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
  });
  if (error) throw new ApiError(error.status, error);
  return data as T;
}
