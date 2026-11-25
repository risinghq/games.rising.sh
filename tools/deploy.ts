// Builds one target and deploys it as its own Cloudflare Worker. A target is a
// folder under games/ or the front page, "index". Each game is served on
// games.rising.sh/<name>; the front page takes every other path.
//
//   bun run deploy <target>...        build and deploy each target
//   bun run deploy --dry-run          build and check every target, no upload
//   bun run deploy --changed <base>   print the targets changed since <base>
import { $ } from "bun";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const HOST = "games.rising.sh";
const ZONE = "rising.sh";
const COMPATIBILITY_DATE = "2026-10-01";
const INDEX = "index";

// A change under one of these paths can change every build.
const SHARED = [
  "package.json",
  "bun.lock",
  "mise.toml",
  "packages/",
  "tools/deploy.ts",
  ".github/workflows/deploy.yml",
];

export function listTargets(root: string): string[] {
  const games = readdirSync(join(root, "games"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
    .map((entry) => entry.name)
    .sort();
  return [...games, INDEX];
}

/** The targets a change to `files` affects, in `targets` order. */
export function affectedTargets(files: string[], targets: string[]): string[] {
  const hit = new Set<string>();
  for (const file of files) {
    if (SHARED.some((path) => file === path || file.startsWith(path)))
      return targets;
    if (file.startsWith("apps/index/")) hit.add(INDEX);
    const game = /^games\/([^/]+)\/(.*)$/.exec(file);
    if (!game) continue;
    hit.add(game[1]);
    // The front page lists every game from its game.json.
    if (game[2] === "game.json") hit.add(INDEX);
  }
  return targets.filter((target) => hit.has(target));
}

/** The Worker config for a target whose assets sit in ./assets. */
export function workerConfig(target: string) {
  const routes =
    target === INDEX
      ? // Cloudflare picks the most specific route, so the game Workers keep
        // their paths and no path falls through to the zone's empty origin.
        [`${HOST}/*`]
      : [`${HOST}/${target}`, `${HOST}/${target}/*`];
  return {
    name: `games-${target}`,
    compatibility_date: COMPATIBILITY_DATE,
    assets: { directory: "./assets" },
    routes: routes.map((pattern) => ({ pattern, zone_name: ZONE })),
  };
}

async function deploy(root: string, target: string, dryRun: boolean) {
  const dir = join(root, target === INDEX ? "apps/index" : `games/${target}`);
  if (!existsSync(join(dir, "package.json")))
    throw new Error(`unknown target "${target}"`);
  await $`bun run build`.cwd(dir);
  // A game's files go under assets/<name>/ so they serve from /<name>/.
  const stage = join(root, ".deploy", target);
  rmSync(stage, { recursive: true, force: true });
  const assets = join(stage, "assets", target === INDEX ? "" : target);
  mkdirSync(assets, { recursive: true });
  cpSync(join(dir, "dist"), assets, { recursive: true });
  const config = join(stage, "wrangler.json");
  await Bun.write(config, JSON.stringify(workerConfig(target), null, 2));
  const flags = dryRun ? ["--dry-run"] : [];
  await $`bunx wrangler deploy --config ${config} ${flags}`.cwd(root);
}

async function changedFiles(
  root: string,
  base: string,
): Promise<string[] | null> {
  const known = await $`git cat-file -e ${base}^{commit}`
    .cwd(root)
    .nothrow()
    .quiet();
  if (/^0+$/.test(base) || known.exitCode !== 0) return null;
  const out = await $`git diff --name-only ${base} HEAD`.cwd(root).text();
  return out.split("\n").filter(Boolean);
}

if (import.meta.main) {
  const root = join(import.meta.dir, "..");
  const args = Bun.argv.slice(2);
  const targets = listTargets(root);
  if (args[0] === "--changed") {
    if (!args[1]) throw new Error("usage: deploy --changed <base>");
    // A base git cannot resolve, such as the zero sha of a new branch,
    // deploys everything.
    const files = await changedFiles(root, args[1]);
    console.log(
      JSON.stringify(files ? affectedTargets(files, targets) : targets),
    );
  } else {
    const dryRun = args[0] === "--dry-run";
    const named = dryRun ? args.slice(1) : args;
    if (named.length === 0 && !dryRun)
      throw new Error("usage: deploy <target>...");
    for (const target of named.length ? named : targets)
      await deploy(root, target, dryRun);
  }
}
