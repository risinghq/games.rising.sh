# Chroma rules

Ducks swim across three lanes. You hold six paints: the primaries red, yellow
and blue, and the secondaries orange, green and purple. Shoot a duck with the
paint of its own colour to knock it down.

- A wrong primary mixes into the duck: red on a blue duck makes it purple. A
  paint the duck already holds does nothing. A shot that would hold all three
  primaries ruins the duck, and it flies off.
- Each knocked-down duck scores 100 for a primary and 150 for a secondary. A
  golden duck takes any paint and scores 500. The score multiplies by one more
  for every five hits in a row, up to five times. Any other shot breaks the
  streak.
- You start with three lives. A coloured duck that swims off costs a life. A
  grey decoy costs a life when you shoot it.
- A wave lasts 30 seconds. Each wave spawns ducks faster and swims them faster.
  Decoys arrive in wave 2, secondary ducks in wave 3, and from wave 4 some ducks
  carry a sign that names a different colour.

## Pacing gate

`bun run gate` plays 200 seeded runs for each of three scripted shooters,
defined in `src/sim.ts`: a novice, a regular and a sharp player. They differ in
reaction time, rate of fire, wrong-paint rate, how often a sign fools them and
how often they shoot a decoy. The gate fails when:

- The novice's median run is under 60 seconds. A newcomer must get past the
  first wave and see the decoys arrive. The game shows it in about 117 seconds.
- A stronger shooter's mean score is under 1.5 times the weaker one's. Skill
  must show in the score. The game shows about 3.7 and 5.2 times.
- More than 15% of any shooter's runs last the 15-minute cap. Every run should
  end, even a good player's. The sharp shooter reaches the cap in about 7.5% of
  runs.
