import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface Game {
  /** The folder under games/, and the path the game is served under. */
  name: string;
  title: string;
  /** One line that says what the game is. */
  blurb: string;
}

/** A game its author hosts. Its code has no licence that lets this repo copy it. */
export interface Elsewhere {
  title: string;
  blurb: string;
  author: string;
  url: string;
}

/**
 * Reads the list of games hosted by their authors. Throws, naming the entry,
 * when one is not valid. Keeps the file's order.
 */
export function loadElsewhere(file: string): Elsewhere[] {
  const data: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(data)) throw new Error(`${file}: expected an array`);
  return data.map((item: unknown, index) => {
    const entry = item as Record<string, unknown> | null;
    const problem = (field: string) =>
      new Error(`${file} entry ${index}: ${field}`);
    if (entry === null || typeof entry !== "object")
      throw problem("expected an object");
    const { title, blurb, author, url } = entry;
    for (const [field, value] of Object.entries({ title, author }))
      if (typeof value !== "string" || value.trim() === "")
        throw problem(`"${field}" must be a non-empty string`);
    if (typeof blurb !== "string" || blurb.trim() === "" || /\n/.test(blurb))
      throw problem(`"blurb" must be one non-empty line`);
    if (typeof url !== "string" || !url.startsWith("https://"))
      throw problem(`"url" must start with https://`);
    return {
      title: title as string,
      blurb,
      author: author as string,
      url,
    };
  });
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
