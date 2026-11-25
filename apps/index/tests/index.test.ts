import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadGames } from "../src/games.ts";
import { renderPage } from "../src/page.ts";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const css = readFileSync(here("../src/style.css"), "utf8");

function gamesDir(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "games-"));
  for (const [folder, game] of Object.entries(files)) {
    mkdirSync(join(dir, folder));
    if (game !== undefined)
      writeFileSync(join(dir, folder, "game.json"), JSON.stringify(game));
  }
  return dir;
}

const entry = { name: "a", title: "A", blurb: "One line." };

describe("loadGames", () => {
  it("finds a game.json in every folder under games/", () => {
    const dir = here("../../../games");
    const folders = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== "node_modules")
      .map((e) => e.name);
    expect(
      loadGames(dir)
        .map((g) => g.name)
        .sort(),
    ).toEqual(folders.sort());
  });

  it.each([
    [
      "a folder without game.json",
      { a: undefined },
      "games/a has no game.json",
    ],
    ["a name that is not the folder", { a: { ...entry, name: "b" } }, '"name"'],
    ["an empty title", { a: { ...entry, title: " " } }, '"title"'],
    ["a blurb of two lines", { a: { ...entry, blurb: "x\ny" } }, '"blurb"'],
    ["a missing blurb", { a: { name: "a", title: "A" } }, '"blurb"'],
  ])("rejects %s", (_case, files, message) => {
    expect(() => loadGames(gamesDir(files))).toThrow(message);
  });

  it("sorts by title", () => {
    const dir = gamesDir({
      b: { ...entry, name: "b", title: "Apple" },
      a: { ...entry, name: "a", title: "Zebra" },
    });
    expect(loadGames(dir).map((g) => g.title)).toEqual(["Apple", "Zebra"]);
  });
});

describe("renderPage", () => {
  const games = [
    { name: "one", title: "One", blurb: "The first game." },
    { name: "two", title: "Two", blurb: "The second game." },
  ];
  const html = renderPage(games, css);

  it("links each game at /<name>/ with its title and blurb", () => {
    for (const game of games) {
      expect(html).toContain(`<a href="/${game.name}/">${game.title}</a>`);
      expect(html).toContain(game.blurb);
    }
  });

  it("escapes markup in a title and a blurb", () => {
    const page = renderPage(
      [{ name: "a", title: "<b>&", blurb: 'say "hi" <i>' }],
      css,
    );
    expect(page).toContain("&lt;b&gt;&amp;");
    expect(page).toContain("say &quot;hi&quot; &lt;i&gt;");
    expect(page).not.toContain("<b>");
  });

  it("runs no script and fetches nothing", () => {
    expect(html).not.toMatch(/<script|<link|src=|@import|url\(/i);
  });

  it("follows the colour scheme of the visitor", () => {
    expect(html).toContain("prefers-color-scheme: dark");
  });

  it("stays under 20 KB with the real games", () => {
    const real = renderPage(loadGames(here("../../../games")), css);
    expect(Buffer.byteLength(real)).toBeLessThan(20 * 1024);
  });
});
