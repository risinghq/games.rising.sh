import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const SRC = fileURLToPath(new URL("src", import.meta.url));
const GAME = "\0emberwick-game.js";

/**
 * Serves /game.js as one module built the way upstream assembles v11: every
 * src/*.js file in name order, each under a "// ---- NAME ----" header. The
 * files share one scope, so they cannot be imported one by one. Upstream's
 * '__THREE__' placeholder becomes the three package.
 */
function game(): Plugin {
  return {
    name: "emberwick-game",
    resolveId: (id) => (id === "/game.js" ? GAME : null),
    load(id) {
      if (id !== GAME) return null;
      const files = readdirSync(SRC)
        .filter((name) => name.endsWith(".js"))
        .sort();
      for (const name of files) this.addWatchFile(`${SRC}/${name}`);
      return files
        .map(
          (name) =>
            `// ---- ${name} ----\n${readFileSync(`${SRC}/${name}`, "utf8")}`,
        )
        .join("\n")
        .replaceAll("'__THREE__'", "'three'");
    },
  };
}

export default defineConfig({
  // Relative, so the build serves from /emberwick/.
  base: "./",
  build: { target: "es2022", outDir: "dist", chunkSizeWarningLimit: 2000 },
  plugins: [game()],
});
