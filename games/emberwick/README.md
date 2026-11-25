# Emberwick

A 3D adventure game by [Simon Willison](https://github.com/simonw). On Harvest
Eve the Hearthstone is gone, and every fire in the village dies at midnight
unless it is lit again. Walk the village, talk to its people, cast what your
lantern has learned and find out who took the stone.

The game is imported from the v11 build Simon Willison published at
[simonw.github.io/emberwick](https://simonw.github.io/emberwick/v11/emberwick.html).
Upstream carries no licence. See [NOTICE](../../NOTICE).

Upstream ships one page whose module script is the files in `src/`, joined in
name order. `shell.html` is that page with the script replaced by `__SOURCE__`,
and `build.ts` joins `src/` back in. On import, `dist/index.html` matched the
published v11 page byte for byte (sha256 `86d2fefc…bbef`). Then
`<meta charset="utf-8">` was added to the shell: GitHub Pages names the charset
in its response header, Cloudflare does not, and without it the browser garbles
the page's dashes and ellipses. The page loads three.js 0.170.0 from jsDelivr
and its fonts from Google Fonts.

```sh
bun run serve emberwick               # build, then serve localhost:8000/emberwick/
bun run --cwd games/emberwick build   # writes dist/index.html
```

Edit a file in `src/`, then build. The `// ---- NAME ----` headers in the built
page name the source file of each part.
