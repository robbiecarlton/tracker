import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Logic-only tests (no React Native renderer). Screens are not unit tested.
export default defineConfig({
  resolve: {
    // Matches tsconfig.json's "@/*" -> "./src/*" path alias, which Metro/tsc
    // resolve on their own but Vitest needs told about explicitly.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
