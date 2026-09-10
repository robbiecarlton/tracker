import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "pglite://memory://",
      BETTER_AUTH_SECRET: "test-secret-at-least-16-characters",
      BETTER_AUTH_URL: "http://localhost:4000",
      WEB_ORIGIN: "http://localhost:8081",
    },
  },
});
