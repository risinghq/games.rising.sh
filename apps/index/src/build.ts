import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadGames } from "./games.ts";
import { renderPage } from "./page.ts";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const games = loadGames(here("../../../games"));
const css = readFileSync(here("./style.css"), "utf8").trimEnd();
mkdirSync(here("../dist"), { recursive: true });
writeFileSync(here("../dist/index.html"), renderPage(games, css));
cpSync(here("../public"), here("../dist"), { recursive: true });
console.log(`dist/index.html lists ${games.length} games`);
