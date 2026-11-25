import type { Elsewhere, Game } from "./games.ts";

const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function renderPage(
  games: Game[],
  elsewhere: Elsewhere[],
  css: string,
): string {
  const items = games
    .map(
      (game) => `      <li>
        <h2><a href="/${escapeHtml(game.name)}/">${escapeHtml(game.title)}</a></h2>
        <p>${escapeHtml(game.blurb)}</p>
      </li>`,
    )
    .join("\n");
  const hosted = elsewhere
    .map(
      (game) => `        <li>
          <h3><a href="${escapeHtml(game.url)}">${escapeHtml(game.title)}</a></h3>
          <p>${escapeHtml(game.blurb)} By ${escapeHtml(game.author)}.</p>
        </li>`,
    )
    .join("\n");
  const section =
    elsewhere.length === 0
      ? ""
      : `
      <section>
        <h2 class="section">Hosted by their authors</h2>
        <ul>
${hosted}
        </ul>
      </section>`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Games · rising.sh</title>
    <meta
      name="description"
      content="Open-source browser games with seeded simulations and batch playtests."
    />
    <!-- No icon links: browsers fetch /favicon.ico and /apple-touch-icon.png
         from public/ on their own, and the page loads nothing else. -->
    <meta property="og:title" content="Games · rising.sh" />
    <meta
      property="og:description"
      content="Open-source browser games with seeded simulations and batch playtests."
    />
    <meta property="og:url" content="https://games.rising.sh/" />
    <meta property="og:image" content="https://games.rising.sh/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
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
      </ul>${section}
    </main>
  </body>
</html>
`;
}
