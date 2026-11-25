<a href="https://rising.sh"><picture><source media="(prefers-color-scheme: dark)" srcset="https://rising.sh/brand/rising-sh-dark.svg"><img alt="rising.sh" src="https://rising.sh/brand/rising-sh-light.svg" height="28"></picture></a>

# games.rising.sh

Open-source browser games with seeded simulations and batch playtests. Each game
is a static Vite build, served at `games.rising.sh/<name>/`. A game with a
seeded simulation replays any run from its seed, and a pacing gate plays
hundreds of seeded runs on every pull request.

```sh
mise install
bun install
bun run serve   # every game at http://localhost:8000/
```

## Games

- [Battle Drones](games/battledrones/): a mobile real-time strategy game by
  Simon Willison. Two drone armies fight for territory; the sim is deterministic
  and a balance gate plays AI skirmishes.
- [Chroma](games/chroma/): a Phaser shooting gallery where the wrong paint mixes
  and changes the duck. A pacing gate plays seeded runs per scripted shooter.
- [Emberwick](games/emberwick/): Simon Willison's 3D village adventure on the
  night its fires go out.
- [Pumpkin Farmer](games/pumpkin-farmer/): Simon Willison's giant-pumpkin farm
  on a foggy coast.
- [Tree Appreciator](games/tree-appreciator/): Simon Willison's 3D
  spot-the-difference game with a herbarium of finished trees.

## Documentation

[docs/](docs/README.md) holds the manual: the architecture, development
commands, adding a game and deploying.

## License

Apache 2.0, see [LICENSE](LICENSE). Battle Drones and Tree Appreciator keep
their own Apache 2.0 licences in their folders. Emberwick and Pumpkin Farmer
carry no licence: all rights stay with Simon Willison, the Apache 2.0 licence of
this repository does not cover them, and they will be removed if he objects.
[NOTICE](NOTICE) records where each game came from and what changed.
