import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default("pglite://./.data/dev"),
  BETTER_AUTH_SECRET: z.string().min(16).default("dev-insecure-secret-change-me"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:4000"),
  WEB_ORIGIN: z.string().url().default("http://localhost:8081"),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env: Env = parsed.data;

export const isPglite = env.DATABASE_URL.startsWith("pglite://");
