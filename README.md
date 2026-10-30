# games.rising.sh

Open-source browser games with seeded simulations and batch playtests.

The first game is [Battle Drones](games/battledrones/), a mobile real-time
strategy game by [Simon Willison](https://github.com/simonw). It is imported
from [simonw/battledrones](https://github.com/simonw/battledrones) at a pinned
commit, recorded in [NOTICE](NOTICE).

The second is [Tug](games/tug/), a tiny two-sided rope game that proves the
shared [sim-kit](packages/sim-kit/) with a different rule set.

The third is [Reef](games/reef/), a sealed-bid pearl-diving game. Its
[rules](games/reef/RULES.md) fit one page.

The fourth is [Fen](games/fen/), a marsh hunt where both hunters move and fire
at once. Its [rules](games/fen/RULES.md) fit one page.

The fifth is [Ford](games/ford/), where both armies split their troops across
three river fords at once. Its [rules](games/ford/RULES.md) fit one page.

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

## Front page

[apps/index](apps/index/) builds the front page, a static HTML page that lists
every game and links to it. Each game has a `games/<name>/game.json` with its
`name` (the folder), `title` and one-line `blurb`. To add a game to the page,
add its `game.json`. The tests fail when a folder under `games/` has none.

```sh
bun run --cwd apps/index build   # writes apps/index/dist/index.html
```

## Layout

- `games/<name>/` holds one game, as a bun workspace package.
- `apps/index/` holds the front page.
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
Its images were generated with an image model, except the HUD portraits, which
are renders of its 3D models, as
[games/battledrones/ART.md](games/battledrones/ART.md) describes.
