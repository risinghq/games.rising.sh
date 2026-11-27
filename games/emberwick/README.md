# Emberwick

A 3D adventure game by [Simon Willison](https://github.com/simonw). On Harvest
Eve the Hearthstone is gone, and every fire in the village dies at midnight
unless it is lit again. Walk the village, talk to its people, cast what your
lantern has learned and find out who took the stone.

The game is imported from the v11 build Simon Willison published at
[simonw.github.io/emberwick](https://simonw.github.io/emberwick/v11/emberwick.html).
Upstream carries no licence. See [NOTICE](../../NOTICE).

Upstream ships one page whose module script is the files in `src/`, joined in
name order. They share one scope, so they cannot be imported one by one.
`index.html` is that page with the script replaced by `<script src="/game.js">`.
The plugin in `vite.config.ts` serves `/game.js` as `src/` joined the way
upstream joins it, with `// ---- NAME ----` headers. It also points upstream's
`'__THREE__'` placeholder at the `three` package, pinned to upstream's 0.170.0.

The source is TypeScript checked with `strict`. Because the files share one
scope only after concatenation, `tools/typecheck.ts` writes the same joined
module to `.typecheck/game.ts` and `tsc` checks that compilation unit. The first
conversion pass uses broad `any` annotations at the migration seams; tighten
them when a file changes. The page loads its fonts from Google Fonts.

`<meta charset="utf-8">` was added to the page: GitHub Pages names the charset
in its response header, Cloudflare does not, and without it the browser garbles
the page's dashes and ellipses.

```sh
bun run --cwd games/emberwick dev     # Vite dev server, reloads on edit
bun run serve emberwick               # the built game at localhost:8000/emberwick/
```
