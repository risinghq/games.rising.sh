// Builds site/: each game's dist at /<game>/, and an index page that links them.
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const games = readdirSync("games", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

rmSync("site", { recursive: true, force: true });
mkdirSync("site");
for (const game of games) {
  cpSync(`games/${game}/dist`, `site/${game}`, { recursive: true });
}

const items = games.map((game) => `<li><a href="/${game}/">${game}</a></li>`).join("\n");
writeFileSync(
  "site/index.html",
  `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>games.rising.sh</title>
<h1>games.rising.sh</h1>
<p>Open-source browser games. <a href="https://github.com/risinghq/games.rising.sh">Source</a>.</p>
<ul>
${items}
</ul>
`,
);
