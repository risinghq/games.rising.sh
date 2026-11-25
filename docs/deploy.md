# Deploy

Each game is a static Cloudflare Worker named `games-<name>`, served on
`games.rising.sh/<name>` and `games.rising.sh/<name>/*`. The front page,
[apps/index](../apps/index/), is the Worker `games-index` on
`games.rising.sh/*`. Cloudflare picks the most specific route, so each game
keeps its own paths and no path falls through to the zone's empty origin.

A deploy target is a folder name under `games/`, or `index` for the front page.
[tools/deploy.ts](../tools/deploy.ts) deploys one:

```sh
bun run deploy chroma           # build, stage and deploy one target
bun run deploy --dry-run        # build every target and check its Worker config
```

It runs the target's `build` script, copies `dist/` to
`.deploy/<target>/assets/<target>/` (`assets/` for the front page), writes the
Worker config to `.deploy/<target>/wrangler.json` and runs `wrangler deploy`.
Wrangler warns that a game's routes serve assets on a path. It is expected.

[deploy.yml](../.github/workflows/deploy.yml) runs on every push to `master`.
`bun tools/deploy.ts --changed <before>` lists the targets the push changed: a
game's folder deploys that game, a `game.json` or `apps/index/` change also
deploys the front page, and a change to `packages/`, the root `package.json`,
the lockfile, `mise.toml`, the deploy tool or the workflow deploys everything.
Each target deploys in its own matrix job, so one failed game does not block the
others. A run by hand from the Actions tab takes a space-separated list of
targets, or deploys all of them when the list is empty.

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

6. First deploy. Open Actions, choose `deploy`, and press Run workflow with an
   empty target list. Then open `https://games.rising.sh/`.

## Deploy from your machine

```sh
export CLOUDFLARE_API_TOKEN=<token>
export CLOUDFLARE_ACCOUNT_ID=<account id>
bun install
bun run deploy <target>
```

## Add a game

Add a folder under `games/` with a `package.json` whose `build` script writes
`dist/`, and a `game.json` so the front page lists it. Every game builds with
Vite, with `base: "./"` so the build serves from `/<name>/`. A `check` script
runs in `bun run check` and a `gate` script in `bun run gate`. The deploy needs
nothing else: the next push to `master` that touches the folder deploys it.
