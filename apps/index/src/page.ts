import type { Game } from "./games.ts";

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function renderPage(games: Game[], css: string): string {
  const items = games
    .map(
      (game) => `      <li>
        <h2><a href="/${escapeHtml(game.name)}/">${escapeHtml(game.title)}</a></h2>
        <p>${escapeHtml(game.blurb)}</p>
      </li>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Games</title>
    <meta
      name="description"
      content="Open-source browser games with seeded simulations and batch playtests."
    />
    <style>
${css}
    </style>
  </head>
  <body>
    <main>
      <h1>Games</h1>
      <p class="intro">
        Open-source browser games with seeded simulations and batch playtests.
      </p>
      <ul>
${items}
      </ul>
    </main>
  </body>
</html>
`;
}
