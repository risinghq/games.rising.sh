# Chroma

A shooting gallery: paint each duck with the paint of its own colour. The wrong
paint mixes and changes the duck. [RULES.md](RULES.md) has the rules. The
in-game text is in Spanish.

```sh
bun run --cwd games/chroma dev     # local server
bun run --cwd games/chroma check   # type check and unit tests
bun run --cwd games/chroma batch   # seeded runs for each scripted shooter
bun run --cwd games/chroma gate    # the pacing gate the PR check runs
```

- `src/rules.ts` holds the colour, score and difficulty rules, and `src/save.ts`
  the save format.
- `src/run.ts` draws each run's ducks from a seeded stream. The Phaser scene in
  `src/scenes/play.ts` and the headless run in `src/sim.ts` share it.
- `src/stage.ts` builds the booth and its light, and `src/audio.ts` synthesizes
  the music and the effects.

Settings and statistics stay in the browser's local storage.
