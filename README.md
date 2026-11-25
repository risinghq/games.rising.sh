<a href="https://rising.sh"><picture><source media="(prefers-color-scheme: dark)" srcset="https://rising.sh/brand/rising-sh-dark.svg"><img alt="rising.sh" src="https://rising.sh/brand/rising-sh-light.svg" height="28"></picture></a>

# games.rising.sh

Open-source browser games with seeded simulations and batch playtests.

The first game is [Battle Drones](games/battledrones/), a mobile real-time
strategy game by [Simon Willison](https://github.com/simonw). It is imported
from [simonw/battledrones](https://github.com/simonw/battledrones) at a pinned
commit, recorded in [NOTICE](NOTICE).

The second is [Chroma](games/chroma/), a Phaser shooting gallery where each duck
takes the paint of its own colour and the wrong paint mixes into a new one. Its
[rules](games/chroma/RULES.md) fit one page.

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

A game whose code has no licence that lets this repo copy it stays on its
author's site. [apps/index/elsewhere.json](apps/index/elsewhere.json) lists
those games with a `title`, `blurb`, `author` and `url`, and the page links them
under "Hosted by their authors". Emberwick and Pumpkin Farmer, from Simon
Willison's
[article](https://simonwillison.net/2026/Oct/28/vibe-game-development/), are
there until they carry a licence.

```sh
bun run --cwd apps/index build   # writes apps/index/dist/index.html
```

## Layout

- `games/<name>/` holds one game, as a bun workspace package.
- `apps/index/` holds the front page.
- `packages/` is for code shared by games. `packages/sim-kit` holds the seeded
  random numbers, the engine-independent maths, the state hash and the batch
  playtest helpers. A game never calls `Math.random`.

Play seeded Chroma runs with each scripted shooter and print their pacing:

```sh
bun run --cwd games/chroma batch
```

[docs/deploy.md](docs/deploy.md) explains how a game reaches Cloudflare.

## License

Apache 2.0, see [LICENSE](LICENSE). Battle Drones is by Simon Willison, also
under Apache 2.0, see [games/battledrones/LICENSE](games/battledrones/LICENSE).
Its images were generated with an image model, except the HUD portraits, which
are renders of its 3D models, as
[games/battledrones/ART.md](games/battledrones/ART.md) describes.
