import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { rawClient } from "../src/db";
import { runMigrations } from "../src/db/migrator";

let app: FastifyInstance;

beforeAll(async () => {
  await runMigrations();
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await rawClient.close().catch(() => {});
});

function cookieFrom(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : [String(raw)];
  return list.map((c) => c.split(";")[0]).join("; ");
}

describe("auth + /api/me", () => {
  it("GET /api/me is 401 without a session", async () => {
    const res = await app.inject({ method: "GET", url: "/api/me" });
    expect(res.statusCode).toBe(401);
  });

  it("sign up, then /api/me returns the user with the timezone from signup", async () => {
    const email = `user-${Date.now()}@example.com`;
    const signUp = await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        name: "Test User",
        email,
        password: "password123",
        timezone: "Europe/London",
      }),
    });
    expect(signUp.statusCode).toBe(200);

    const me = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { cookie: cookieFrom(signUp) },
    });
    expect(me.statusCode).toBe(200);
    const body = me.json() as { user: { email: string; timezone: string } };
    expect(body.user.email).toBe(email);
    expect(body.user.timezone).toBe("Europe/London");
  });
});
