import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src", import.meta.url));
const OUT = fileURLToPath(new URL("../.typecheck", import.meta.url));

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC)
  .filter((name) => name.endsWith(".ts"))
  .sort();
writeFileSync(
  `${OUT}/game.ts`,
  files
    .map((name) => readFileSync(`${SRC}/${name}`, "utf8"))
    .join("\n")
    .replaceAll("'__THREE__'", "'three'"),
);
