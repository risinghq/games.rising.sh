# games.rising.sh

Open-source browser games with seeded simulations and batch playtests.

Each game keeps its rules in a deterministic simulation. A seed fixes every
outcome, so AI players can play thousands of matches and report win rates,
draw rates and match length before a human plays.

## Games

| Game | Folder | Source |
| --- | --- | --- |
| Battle Drones | `games/battledrones` | [simonw/battledrones](https://github.com/simonw/battledrones) by Simon Willison |

## Layout

- `games/<name>/` holds one game with its own `package.json`, tests and build.
- `packages/` holds code shared by games.
- `scripts/assemble.mjs` copies each game's `dist` to `site/<name>/` and writes the index page.
- `wrangler.jsonc` serves `site/` at games.rising.sh.

## Run

Install [mise](https://mise.jdx.dev) for the pinned bun, then:

```sh
bun install
bun run check    # typecheck and tests for every game
bun run build    # build every game and assemble site/
```

To work on one game:

```sh
cd games/battledrones
bun run dev
```

## Playtest

Battle Drones plays every ordered pair of AI personalities on a map across N seeds:

```sh
cd games/battledrones
bunx vite-node tools/pacing.ts run --seeds 2 --maps frostbite
bunx vite-node tools/pacing.ts summary
```

`summary` reports win rate per personality, the draw rate and the cost per simulated minute.

## Deploy

A push to `main` runs `.github/workflows/deploy.yml`, which builds the site and
runs `wrangler deploy` in the `production` environment. It needs the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.

Online duels in Battle Drones use the relay that upstream hosts at
`wss://battledrones-relay.fly.dev`.

## Licence

Apache 2.0. See `LICENSE` and `NOTICE`. Battle Drones is by Simon Willison,
also Apache 2.0, and keeps its own `LICENSE` in `games/battledrones/`.
