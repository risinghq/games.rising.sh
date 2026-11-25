# Pumpkin Farmer

A giant-pumpkin farming game by [Simon Willison](https://github.com/simonw). The
page calls itself Quarter Sun Cove, a foggy coastal farm. Breed seeds, tend the
patch through the seasons and the weather, and take a pumpkin to the weigh-off.
Progress stays in the browser's local storage.

The game is imported from the build Simon Willison published at
[simonw.github.io/pumpkin-farmer](https://simonw.github.io/pumpkin-farmer/).
Upstream carries no licence. See [NOTICE](../../NOTICE).

The code is plain ES modules, built with Vite. `src/sim/` holds the simulation,
`src/render/` the three.js scene and `src/ui/` the interface. `?render=stub`
swaps the 3D scene for `dev/stub-render.js`. three.js comes from the `three`
package, pinned to upstream's 0.170.0; upstream loaded it from jsDelivr through
an import map. The page loads its fonts from Google Fonts.

```sh
bun run --cwd games/pumpkin-farmer dev     # Vite dev server, reloads on edit
bun run serve pumpkin-farmer               # the built game at localhost:8000/pumpkin-farmer/
```
