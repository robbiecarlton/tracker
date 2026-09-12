import type { FastifyInstance } from "fastify";
import { expect } from "vitest";

/** Extracts a usable `cookie:` header value from an `app.inject()` response's `set-cookie`. */
export function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : [String(raw)];
  return list.map((c) => c.split(";")[0]).join("; ");
}

/** Signs up a fresh, uniquely-emailed test user against `app` and returns their session cookie. */
export async function signUpAndGetCookie(
  app: FastifyInstance,
  emailPrefix: string,
): Promise<string> {
  const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const signUp = await app.inject({
    method: "POST",
    url: "/api/auth/sign-up/email",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ name: "Test User", email, password: "password123" }),
  });
  expect(signUp.statusCode).toBe(200);
  return cookieFrom(signUp);
}
