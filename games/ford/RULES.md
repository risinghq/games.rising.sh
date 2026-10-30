# Ford rules

Two armies, blue and red, fight over three river fords. You are blue.

## Setup

Each ford has a line that runs from red's bank at -2 to blue's bank at +2. A
seed sets the opening: one ford starts one step toward blue, another one step
toward red, and the third at 0. The opening favours neither side.

Each army has 7 troops.

## A turn

1. Both armies see the lines and every finished turn, including what the other
   side sent to each ford.
2. Each army secretly sends its troops across the fords: a whole number to each
   ford, 7 in all or fewer. Troops sent beyond 7 are cut from the later fords.
3. At each ford the larger force pushes the line one step toward its bank. A
   margin of 4 or more is a rout and pushes two steps. A tie moves nothing. A
   line stops at the bank.
4. Every troop comes back for the next turn. Nothing is lost.

## The end

A side that holds two fords at its bank wins at once. If both sides reach that
on the same turn, or nobody has by the end of turn 8, the side with the higher
sum of lines wins. On equal sums the side that won more fords over the match
wins. If those are equal too, the match is a draw.

## Why it plays

- Seven troops cannot cover three fords. Strength at one ford is weakness at
  another, and the other side chooses at the same moment.
- Every ford is a first-price contest with no cost for winning: one troop more
  than the other side sends is enough, and four more is a rout. Guessing the
  other side's split is the whole game.
- What the other side sent last turn is in view. A side that repeats itself is
  read, and a side that never repeats itself is read too, by its habit.

## Opponents

Red is one of six personalities. Each chooses its orders from the state alone:
the lines and every finished turn.

| Name       | Sends                                                                    |
| ---------- | ------------------------------------------------------------------------ |
| `spreader` | an even share to each ford, the spare troop to a ford the seed picks     |
| `raider`   | everything to the two fords where the other side sent least last turn    |
| `mirror`   | one more than the other side sent to each ford last turn                 |
| `gambler`  | a random split, drawn from the seed                                      |
| `warden`   | more to the fords where the other side's line is closest to its own bank |
| `feinter`  | more to the fords where it sent least last turn, so it never repeats     |

The three adaptive personalities form a cycle: `mirror` beats `feinter`,
`feinter` beats `warden`, and `warden` beats `mirror`. `raider` beats `spreader`
and `feinter` but loses to `mirror`, which fills the ford `raider` leaves thin.
`gambler` loses to every other personality.

## The balance gate

`bun run gate` plays every ordered pair of the six personalities 100 times, 3600
matches, and exits 1 when one of these fails:

| Limit                                                             | Value          | Why                                                                                                                                                      |
| ----------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matches played                                                    | 3600           | Fewer matches make the shares below noise.                                                                                                               |
| Draw rate                                                         | 25%            | The game measures 20%. Most draws are a personality against itself or a stooge that cannot break a stalemate. More than 25% means stalemates are common. |
| Blue's share of decided wins                                      | 50% ± 4 points | With about 2,870 decided matches the sampling error is 1 point, so 4 points is four times that. A fair game does not trip it.                            |
| One personality's share of its decided matches against the others | 75%            | The strongest, `mirror`, measures 71.5%. A personality above 75% makes the others pointless to pick, and its share has a sampling error of 1.5 points.   |

Run `bun run batch --seeds 200` for the same batch with another size.
