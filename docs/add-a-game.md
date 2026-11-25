# Add a game

Make a folder under `games/` whose name is the game's path on the site:

```
games/<name>/
  package.json    a workspace package with a build script
  game.json       the front page entry
  vite.config.ts  base "./"
  index.html
```

`game.json` holds the folder name, a title and a one-line blurb:

```json
{
  "name": "<name>",
  "title": "Title",
  "blurb": "One line that says what the game is."
}
```

The `build` script runs `vite build` and writes `dist/`. Set `base: "./"` in
`vite.config.ts` so the build serves from `/<name>/`. A `dev` script running
`vite` gives the game a dev server.

Two scripts are optional:

- `check` runs in `bun run check`: type check and unit tests.
- `gate` runs in `bun run gate`: the batch playtest that fails the pull request
  when the game's pacing or balance leaves its thresholds.

A game with a seeded simulation depends on `@rising/sim-kit` and never calls
`Math.random` (see [architecture](architecture.md#seeded-simulations)).

Add the game to the list in the root [README](../README.md). The front page
lists it from `game.json`; the index tests fail when a folder has no
`game.json`. The next push to `master` that touches the folder deploys it
([deploy](deploy.md)).
