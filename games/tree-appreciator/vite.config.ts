import { defineConfig } from "vite";

export default defineConfig({
  // Relative, so the build serves from /tree-appreciator/.
  base: "./",
  build: { outDir: "dist" },
});
