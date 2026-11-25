// Rebuilds the published single-file page from shell.html and src/, the way
// upstream assembles v11: every src/*.js file in name order, each under a
// "// ---- NAME ----" header, with the three.js placeholder resolved.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const THREE =
  "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const body = readdirSync("src")
  .filter((name) => name.endsWith(".js"))
  .sort()
  .map((name) => `// ---- ${name} ----\n${readFileSync(`src/${name}`, "utf8")}`)
  .join("\n")
  .replaceAll("'__THREE__'", `'${THREE}'`);

const shell = readFileSync("shell.html", "utf8");
if (shell.split("__SOURCE__").length !== 2)
  throw new Error("shell.html must hold __SOURCE__ exactly once");

mkdirSync("dist", { recursive: true });
writeFileSync(
  "dist/index.html",
  shell.replace("__SOURCE__", () => body),
);
