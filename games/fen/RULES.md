# Fen rules

Two hunters, blue and red, stalk each other through a marsh. You are blue.

## Setup

The marsh is a row of seven tiles, 0 to 6. Blue starts on tile 0 and red on
tile 6. Each hunter has 3 hp and 2 rounds, and can hold at most 3. A seed puts
reeds on one tile from 1 to 3 and on its mirror image (tile 3 has no mirror), so
the marsh favours neither side.

## A turn

1. Both hunters see the marsh and every finished turn. Each secretly chooses a
   move (left, stay or right) and a shot: a target tile within 3 tiles of where
   the hunter stands now, or no shot.
2. Moves resolve first. A hunter cannot leave the marsh. If both would end on
   one tile, or would swap tiles, neither moves.
3. Each shot then hits if its target is the other hunter's final tile. A hit
   costs 1 hp.
4. A shot costs a round. A hunter that holds fire gains one. A shot with no
   round left, or at a tile out of range, counts as no shot.

Reeds hide a hunter from any shooter more than one tile away, measured from the
tile the shooter stood on when it fired. The reeds lie flat from the 13th turn
and hide nobody.

## The end

The match ends when a hunter reaches 0 hp, or after 24 turns. The hunter with
more hp wins. On equal hp the one with more rounds wins. If those are equal too,
the match is a draw.

## Why it plays

- A shot lands where the other hunter ends the turn, not where it stands. Aim at
  the tile you expect it to step to.
- A hunter that never moves is easy to hit, and one that always moves is easy to
  read. Mixing is the skill.
- Rounds are slow to come back. A hunter with an empty gun is hit for free.
- Reeds are a refuge for the first half. Cover is worth little if the other
  hunter walks up beside you.

## Opponents

Red is one of five personalities. Each picks its move and shot from the state
alone: positions, hp, rounds, reeds and the last turn.

| Name      | Plays                                                                       |
| --------- | --------------------------------------------------------------------------- |
| `stalker` | walks to within two tiles, then stays and shoots where the other is heading |
| `camper`  | sits in the nearest reeds and shoots the other's tile only with a full gun  |
| `dancer`  | steps left or right every turn and shoots the other's tile with 2 rounds    |
| `gambler` | moves at random and, half the time, shoots a tile next to the other         |
| `hunter`  | weaves like the dancer, but shoots a tile next to the other with 2 rounds   |

"Heading" means the other's last move repeated. The dancer beats the stalker and
the camper, which stand still. The hunter beats the dancer. The stalker and the
camper beat the hunter.

## The balance gate

`bun run gate` plays every ordered pair of the five personalities 120 times,
3000 matches, and exits 1 when one of these fails:

| Limit                                                             | Value          | Why                                                                                                                                                                                 |
| ----------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matches played                                                    | 3000           | Fewer matches make the shares below noise.                                                                                                                                          |
| Draw rate                                                         | 20%            | The game measures 15%. Most draws are a personality against its own copy: two copies play in lockstep and hit each other equally. More than 20% means standoffs have become common. |
| Blue's share of decided wins                                      | 50% ± 4 points | With about 2,550 decided matches the sampling error is 1 point, so 4 points is four times that. A fair game does not trip it. A start with 1 more hp for blue measures 70%.         |
| One personality's share of its decided matches against the others | 75%            | The strongest, the dancer, measures 69%. A personality above 75% makes the others pointless to pick, and its share has a sampling error of 1.5 points.                              |

Run `bun run batch --seeds 200` for the same batch with another size.
