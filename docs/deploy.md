# Deploy

Each game is a static Cloudflare Worker with its own route on `games.rising.sh`.

| Game          | Workflow                                                                | Route                           |
| ------------- | ----------------------------------------------------------------------- | ------------------------------- |
| Battle Drones | [deploy-battledrones.yml](../.github/workflows/deploy-battledrones.yml) | `games.rising.sh/battledrones/` |
| Tug           | [deploy-tug.yml](../.github/workflows/deploy-tug.yml)                   | `games.rising.sh/tug/`          |
| Reef          | [deploy-reef.yml](../.github/workflows/deploy-reef.yml)                 | `games.rising.sh/reef/`         |
| Fen           | [deploy-fen.yml](../.github/workflows/deploy-fen.yml)                   | `games.rising.sh/fen/`          |
| Ford          | [deploy-ford.yml](../.github/workflows/deploy-ford.yml)                 | `games.rising.sh/ford/`         |

A workflow runs on a push to `main` that changes the game's folder, a
`packages/` folder it imports, the lockfile, the tool versions or the workflow
itself. It also runs by hand from the Actions tab. It installs with
`bun install --frozen-lockfile` and runs the game's `deploy` script:

```sh
bun run --cwd games/<game> deploy
```

The script builds the game, copies `dist/` to `.deploy/<game>/` and runs
`wrangler deploy`. The game's `wrangler.jsonc` serves `.deploy/` as static
assets on the routes `games.rising.sh/<game>` and `games.rising.sh/<game>/*`.

## Front page

The front page is its own Worker, [apps/index](../apps/index/). Its route is
`games.rising.sh/`, which matches `/` only, so each game keeps its own paths.
Wrangler warns that the route serves assets on a path. It is expected: `/`
serves `index.html`. A request with a query string, such as `/?x=1`, does not
match the route. [deploy-index.yml](../.github/workflows/deploy-index.yml) also
runs when a `games/*/game.json` changes, because the page is built from those
files. Deploy it like a game: `bun run --cwd apps/index deploy`.

## One-time setup

1. DNS. In the Cloudflare dashboard, open the `rising.sh` zone, then DNS, then
   Records. Add an `AAAA` record named `games` with the content `100::` and the
   proxy on. A Worker route only runs for a proxied hostname.
2. API token. Open My Profile, then API Tokens, then Create Token, then Custom
   token. Give it these permissions:
   - Account, Workers Scripts, Edit
   - Zone, Workers Routes, Edit
   - Zone, Zone, Read

   Limit the zone to `rising.sh`. Limit the account to the account that owns the
   zone. Copy the token once, when Cloudflare shows it.

3. Account id. In the dashboard, open Workers & Pages. The right-hand column
   shows the Account ID.
4. GitHub environment. In the repository, open Settings, then Environments, then
   New environment. Name it `production`.
5. GitHub secrets. Open Settings, then Secrets and variables, then Actions, and
   add two repository secrets:

   | Name                    | Value                  |
   | ----------------------- | ---------------------- |
   | `CLOUDFLARE_API_TOKEN`  | the token from step 2  |
   | `CLOUDFLARE_ACCOUNT_ID` | the account id, step 3 |

6. First deploy. Open Actions, choose `deploy <game>`, and press Run workflow.
   Then open `https://games.rising.sh/<game>/`. Repeat for each game. Run
   `deploy index` last and open `https://games.rising.sh/`.

## Deploy from your machine

Build and deploy without the workflow:

```sh
export CLOUDFLARE_API_TOKEN=<token>
export CLOUDFLARE_ACCOUNT_ID=<account id>
bun install
bun run --cwd games/<game> deploy
```

To check the configuration without uploading anything:

```sh
bun run --cwd games/<game> build
bun run --cwd games/<game> stage
cd games/<game> && bunx wrangler deploy --dry-run
```

## Add a game

Give the game its own `wrangler.jsonc` with a unique `name` and its own route
`games.rising.sh/<game>/*`, its own `stage` and `deploy` scripts, and its own
workflow whose `paths` list the game's folder and each `packages/` folder it
imports. Add a `game.json` so the front page lists it. The secrets and the DNS
record are shared.
