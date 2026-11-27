import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { defineConfig, type Plugin } from "vite";

const SRC = fileURLToPath(new URL("src", import.meta.url));
const GAME = "\0emberwick-game.ts";

/**
 * Serves /game.js as one module built the way upstream assembles v11: every
 * src/*.ts file in name order, each under a "// ---- NAME ----" header. The
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
        .filter((name) => name.endsWith(".ts"))
        .sort();
      for (const name of files) this.addWatchFile(`${SRC}/${name}`);
      const joined = files
        .map(
          (name) =>
            `// ---- ${name} ----\n${readFileSync(`${SRC}/${name}`, "utf8")}`,
        )
        .join("\n")
        .replaceAll("'__THREE__'", "'three'");
      return transpileModule(joined, {
        compilerOptions: {
          target: ScriptTarget.ES2022,
          module: ModuleKind.ESNext,
        },
      }).outputText;
    },
  };
}

export default defineConfig({
  // Relative, so the build serves from /emberwick/.
  base: "./",
  build: { target: "es2022", outDir: "dist", chunkSizeWarningLimit: 2000 },
  plugins: [game()],
});
