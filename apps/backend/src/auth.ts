import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { schema } from "./db/schema";
import { env } from "./env";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [env.WEB_ORIGIN, "tracker://"],
  plugins: [expo()],
  advanced: {
    // In production the web frontend and this API are deployed as separate
    // services on different domains (e.g. two Railway subdomains) — a
    // cross-site `fetch`, not just cross-origin like local dev's two
    // localhost ports. Better Auth's cookie default (`sameSite: "lax"`)
    // is same-site-only and browsers won't attach it there, silently
    // breaking sign-in. `secure` doesn't need forcing here — it's already
    // auto-true whenever BETTER_AUTH_URL starts with "https://". Must stay
    // "lax" in dev: WEB_ORIGIN is http:// there, and a SameSite=None cookie
    // without Secure is just dropped by the browser.
    defaultCookieAttributes: {
      sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    },
  },
  user: {
    additionalFields: {
      // IANA timezone, captured at signup. Used by view calculations later.
      timezone: {
        type: "string",
        required: false,
        defaultValue: "UTC",
        input: true,
      },
    },
  },
});

export type Auth = typeof auth;
