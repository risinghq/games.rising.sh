import { defineConfig } from "vite";

export default defineConfig({
  // Relative, so the build serves from /pumpkin-farmer/.
  base: "./",
  build: { target: "es2022", outDir: "dist", chunkSizeWarningLimit: 1600 },
});
