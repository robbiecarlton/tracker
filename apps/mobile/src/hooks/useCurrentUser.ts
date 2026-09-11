import { normalizeTimeZone } from "@/lib/timezone";
import { useSession } from "@/lib/auth";

export interface CurrentUser {
  email: string | undefined;
  /** IANA timezone. Falls back to "UTC" if missing. */
  timeZone: string;
}

/**
 * Centralizes the session -> user cast every screen needs. The Better Auth
 * client doesn't infer server-side `additionalFields`, so `timezone` isn't
 * typed on `session.user` — read it through a narrow cast here, once.
 * `timeZone` feeds `TimeContext` for every `computeHabitView` call.
 */
export function useCurrentUser(): { user: CurrentUser | undefined; isPending: boolean } {
  const { data: session, isPending } = useSession();
  const raw = session?.user as { email?: string; timezone?: string } | undefined;

  const user: CurrentUser | undefined = raw
    ? { email: raw.email, timeZone: normalizeTimeZone(raw.timezone) }
    : undefined;

  return { user, isPending };
}
