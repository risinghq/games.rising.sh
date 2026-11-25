# Tree Appreciator

A slow spot-the-difference game by [Simon Willison](https://github.com/simonw).
Each round grows two 3D trees from one seed. Tap a difference in either tree,
drag or pinch to turn and zoom, and fill the herbarium with finished pairs.
Progress stays in the browser's local storage.

The game is one file, `index.html`, imported unchanged from
[simonw/tools](https://github.com/simonw/tools/blob/dafb677a5d54a89c32a80d1c9b6a7ab7318d55c3/tree-appreciator.html)
at commit `dafb677`, under Apache 2.0 ([LICENSE](LICENSE)). It loads three.js
r128 from cdnjs and its fonts from Google Fonts.

```sh
bun run --cwd games/tree-appreciator dev     # local server
bun run --cwd games/tree-appreciator build   # writes dist/index.html
```
