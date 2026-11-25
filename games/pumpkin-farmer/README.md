# Pumpkin Farmer

A giant-pumpkin farming game by [Simon Willison](https://github.com/simonw). The
page calls itself Quarter Sun Cove, a foggy coastal farm. Breed seeds, tend the
patch through the seasons and the weather, and take a pumpkin to the weigh-off.
Progress stays in the browser's local storage.

The game is imported from the build Simon Willison published at
[simonw.github.io/pumpkin-farmer](https://simonw.github.io/pumpkin-farmer/).
Upstream carries no licence. See [NOTICE](../../NOTICE).

The code is plain ES modules with no build step. `src/sim/` holds the
simulation, `src/render/` the three.js scene and `src/ui/` the interface.
`?render=stub` swaps the 3D scene for `dev/stub-render.js`. The page loads
three.js 0.170.0 from jsDelivr through an import map and its fonts from Google
Fonts.

```sh
bun run --cwd games/pumpkin-farmer dev     # local server
bun run --cwd games/pumpkin-farmer build   # copies the game to dist/
```
