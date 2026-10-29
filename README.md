# games.rising.sh

Open-source browser games with seeded simulations and batch playtests.

The first game is [Battle Drones](games/battledrones/), a mobile real-time
strategy game by [Simon Willison](https://github.com/simonw). It is imported
from [simonw/battledrones](https://github.com/simonw/battledrones) at a pinned
commit, recorded in [NOTICE](NOTICE).

The second is [Tug](games/tug/), a tiny two-sided rope game that proves the
shared [sim-kit](packages/sim-kit/) with a different rule set.

## Run a game

Install [mise](https://mise.jdx.dev), then:

```sh
mise install
bun install
bun run --cwd games/battledrones dev
```

Vite prints the local URL. Each game is a Vite app with its own scripts:

```sh
bun run --cwd games/battledrones check   # type check and unit tests
bun run --cwd games/battledrones build   # writes games/battledrones/dist
```

The game's own README lists its other tools, such as the AI pacing panel and the
Playwright smoke scripts.

## Layout

- `games/<name>/` holds one game, as a bun workspace package.
- `packages/` is for code shared by games. `packages/sim-kit` holds the seeded
  random numbers, the engine-independent maths, the state hash and the batch
  playtest helpers. A game never calls `Math.random`.

Play a batch of seeded Tug matches and print win shares and draws:

```sh
bun run --cwd games/tug batch --seeds 200
```

[docs/deploy.md](docs/deploy.md) explains how a game reaches Cloudflare.

## License

Apache 2.0, see [LICENSE](LICENSE). Battle Drones is by Simon Willison, also
under Apache 2.0, see [games/battledrones/LICENSE](games/battledrones/LICENSE).
Its sprites and textures were generated with an image model, as
[games/battledrones/ART.md](games/battledrones/ART.md) describes.
