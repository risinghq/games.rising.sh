import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  build: { outDir: "dist" },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
