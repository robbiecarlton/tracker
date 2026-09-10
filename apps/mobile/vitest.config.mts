import { defineConfig } from "vitest/config";

// Logic-only tests (no React Native renderer). Screens are not unit tested.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
