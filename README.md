# games.rising.sh

Open-source browser games with seeded simulations and batch playtests.

The first game is [Battle Drones](games/battledrones/), a mobile real-time
strategy game by [Simon Willison](https://github.com/simonw). It is imported
from [simonw/battledrones](https://github.com/simonw/battledrones) at a pinned
commit, recorded in [NOTICE](NOTICE).

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
- `packages/` is for code shared by games.

[docs/deploy.md](docs/deploy.md) explains how a game reaches Cloudflare.

## License

Apache 2.0, see [LICENSE](LICENSE). Battle Drones is by Simon Willison, also
under Apache 2.0, see [games/battledrones/LICENSE](games/battledrones/LICENSE).
Its sprites and textures were generated with an image model, as
[games/battledrones/ART.md](games/battledrones/ART.md) describes.
