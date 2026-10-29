import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface Game {
  /** The folder under games/, and the path the game is served under. */
  name: string;
  title: string;
  /** One line that says what the game is. */
  blurb: string;
}

/**
 * Reads games/<folder>/game.json for every folder in `dir`. Throws, naming the
 * folder, when a folder has no game.json or the file is not a valid entry.
 * Games come back sorted by title.
 */
export function loadGames(dir: string): Game[] {
  const games = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
    .map((entry) => readGame(dir, entry.name));
  return games.sort((a, b) => a.title.localeCompare(b.title, "en"));
}

function readGame(dir: string, folder: string): Game {
  const file = join(dir, folder, "game.json");
  if (!existsSync(file)) throw new Error(`games/${folder} has no game.json`);
  const data: unknown = JSON.parse(readFileSync(file, "utf8"));
  const entry = data as Record<string, unknown> | null;
  const problem = (field: string) =>
    new Error(`games/${folder}/game.json: ${field}`);
  if (entry === null || typeof entry !== "object")
    throw problem("expected an object");
  const { name, title, blurb } = entry;
  if (name !== folder) throw problem(`"name" must be "${folder}"`);
  if (typeof title !== "string" || title.trim() === "")
    throw problem(`"title" must be a non-empty string`);
  if (typeof blurb !== "string" || blurb.trim() === "" || /\n/.test(blurb))
    throw problem(`"blurb" must be one non-empty line`);
  return { name, title, blurb };
}
