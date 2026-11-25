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

The third is [Tree Appreciator](games/tree-appreciator/), Simon Willison's calm
3D spot-the-difference game with a herbarium of finished trees. It is imported
unchanged from [simonw/tools](https://github.com/simonw/tools) at a pinned
commit, recorded in [NOTICE](NOTICE).

[Emberwick](games/emberwick/) is Simon Willison's 3D village adventure on the
night its fires go out, and [Pumpkin Farmer](games/pumpkin-farmer/) is his
giant-pumpkin farm on a foggy coast. Both are imported from the builds he
published, as source files that build into the published page. Neither carries a
licence; see [License](#license).

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
  playtest helpers. A game with a seeded simulation never calls `Math.random`.
  An imported game keeps its upstream code.

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
[games/battledrones/ART.md](games/battledrones/ART.md) describes. Tree
Appreciator is by Simon Willison under Apache 2.0, see
[games/tree-appreciator/LICENSE](games/tree-appreciator/LICENSE).

Emberwick and Pumpkin Farmer are by Simon Willison and carry no licence: all
rights stay with him. They are imported at the repository owner's risk and will
be removed if he objects. The Apache 2.0 licence of this repository does not
cover them. [NOTICE](NOTICE) records where each came from.
