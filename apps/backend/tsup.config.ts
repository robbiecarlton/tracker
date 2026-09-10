import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  // Bundle the workspace package; keep node_modules external.
  noExternal: ["@tracker/core"],
  sourcemap: true,
});
