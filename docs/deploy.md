# Deploy

Each game is a static Cloudflare Worker with its own route on `games.rising.sh`.
Battle Drones is served at `/battledrones/` and Tug at `/tug/`.

The workflow
[deploy-battledrones.yml](../.github/workflows/deploy-battledrones.yml) runs on
a push to `main` that changes `games/battledrones/`, the lockfile, the tool
versions or the workflow itself. It also runs by hand from the Actions tab. It
installs with `bun install --frozen-lockfile` and runs the game's `deploy`
script:

```sh
bun run --cwd games/battledrones deploy
```

The script builds the game, copies `dist/` to `.deploy/battledrones/` and runs
`wrangler deploy`. [wrangler.jsonc](../games/battledrones/wrangler.jsonc) serves
`.deploy/` as static assets on the routes `games.rising.sh/battledrones` and
`games.rising.sh/battledrones/*`.

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

6. First deploy. Open Actions, choose `deploy battledrones`, and press Run
   workflow. Then open `https://games.rising.sh/battledrones/`.

## Deploy from your machine

Build and deploy without the workflow:

```sh
export CLOUDFLARE_API_TOKEN=<token>
export CLOUDFLARE_ACCOUNT_ID=<account id>
bun install
bun run --cwd games/battledrones deploy
```

To check the configuration without uploading anything:

```sh
bun run --cwd games/battledrones build
bun run --cwd games/battledrones stage
cd games/battledrones && bunx wrangler deploy --dry-run
```

## Add a game

Give the game its own `wrangler.jsonc` with a unique `name` and its own route
`games.rising.sh/<game>/*`, its own `stage` and `deploy` scripts, and its own
workflow whose `paths` list the game's folder and each `packages/` folder it
imports. The secrets and the DNS record are shared.
