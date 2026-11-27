# Architecture

The repository is a Bun workspace. Each game is a package that builds a static
site; one tool stages every build and deploys it as its own Cloudflare Worker.

```
games/<name>/        one game, served at games.rising.sh/<name>/
apps/index/          the front page, served at games.rising.sh/
packages/sim-kit/    seeded randomness, exact maths, state hashes, batch playtests
tools/deploy.ts      build, stage and deploy a target
tools/serve.ts       serve the staged targets locally
```

## From a game folder to the site

1. A target is a folder name under `games/`, or `index` for the front page. Its
   `build` script writes `dist/`. Games build with Vite.
   [apps/index/src/build.ts](../apps/index/src/build.ts) writes the front page
   from every `games/*/game.json`, as one HTML file with inline CSS.
2. `stage` in [tools/deploy.ts](../tools/deploy.ts) copies `dist/` to
   `.deploy/<target>/assets/<target>/`, or `.deploy/index/assets/` for the front
   page, so the files sit under the path they are served from.
3. `bun run deploy <target>` writes the Worker config next to the staged assets
   and runs `wrangler deploy`. Each game is the Worker `games-<name>` on the
   routes `games.rising.sh/<name>` and `games.rising.sh/<name>/*`.
4. `bun run serve` stages the same files and serves `/<name>/` from each game's
   assets and everything else from the front page, as the routes do.

[deploy.md](deploy.md) covers the routes, the workflow and the one-time
Cloudflare setup.

## Seeded simulations

A game with a seeded simulation keeps its rules in code that runs without a
renderer, and draws every random value from
[packages/sim-kit](../packages/sim-kit/src/):

- `rand.ts`: seeded random streams and hashes. A run replays from its seed.
- `fmath.ts`: sin, cos, atan2, hypot and pow built from operations every engine
  computes the same way, so a replay recorded in one browser matches in another.
- `fnv.ts`: an FNV-1a digest a game folds its state into to detect drift.
- `batch.ts` and `gate.ts`: seed a batch of matches, summarize the outcomes and
  list where they break a game's thresholds.

Each game's `gate` script plays a seeded batch headless and exits 1 when it
breaks the thresholds:

- Chroma ([tools/gate.ts](../games/chroma/tools/gate.ts)) plays seeded runs for
  each scripted shooter and checks run length, score steps and runs that never
  end. [RULES.md](../games/chroma/RULES.md) justifies the thresholds.
- Battle Drones ([tools/gate.ts](../games/battledrones/tools/gate.ts)) plays a
  seeded roster of AI-versus-AI skirmishes and checks draw rate and side skew.

## Imported games

Battle Drones, Tree Appreciator, Emberwick and Pumpkin Farmer are by Simon
Willison. An import starts as the upstream code, and every later change is a
diff against that import. [NOTICE](../NOTICE) records each source and what this
repository changed. Each game's README describes how its build wraps or converts
the upstream files.
