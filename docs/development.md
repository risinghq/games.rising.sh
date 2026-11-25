# Development

[mise](https://mise.jdx.dev) pins Bun and Node (`mise.toml`). Install them and
the workspace:

```sh
mise install
bun install
```

## Run

```sh
bun run serve                        # build every target, serve localhost:8000
bun run serve chroma emberwick       # build and serve only these
bun run --cwd games/chroma dev       # one game's Vite dev server, reloads on edit
```

`serve` ([tools/serve.ts](../tools/serve.ts)) serves the same staged files the
deploy uploads, under the same paths: `/<name>/` for a game and `/` for the
front page. `PORT` changes the port.

## Check

```sh
bun run check   # format check, tools tests, every workspace's check script
bun run gate    # every workspace's gate script
bun run fix     # format everything with oxfmt
```

The pull request check ([pr.yml](../.github/workflows/pr.yml)) runs `check`,
`gate` and `bun run deploy --dry-run`.

A game's own README lists its other scripts, such as Chroma's `batch` and Battle
Drones' `arena`, `balance` and art pipeline.
