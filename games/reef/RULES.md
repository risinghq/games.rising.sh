# Reef rules

Two crews, blue and red, dive for pearls over eight turns. You are blue.

## Setup

Each crew starts with 24 divers and no pearls. A seed fixes the pearls on offer
at each dive: 1, 2, 3 or 4, the same for both crews.

## A dive

1. Both crews see the pearls on offer now and on the next dive. Later dives are
   hidden. Both see every finished dive and the bids of both crews.
2. Each crew secretly bids a whole number of divers, from none to all it has
   left.
3. The higher bid takes the pearls and loses that many divers for good. The
   other crew keeps all its divers.
4. Equal bids go to a seeded coin, one flip per dive. The winner pays its bid.
5. A crew that takes two dives in a row gets one extra pearl on the second.

## The end

After dive eight the crew with more pearls wins. If pearls are equal, the crew
with more divers left wins. If those are equal too, the match is a draw.

## Why it plays

- Divers are the only currency and never come back, so a big bid now is a small
  bid later. The last dive is the one place to spend everything.
- A loser pays nothing, so bidding high costs nothing unless you win. Bidding
  just above the other crew's bid, and no more, is the skill.
- The next dive is in view, so a crew can save for a rich one, or cut a streak.

## Opponents

Red is one of six personalities. Each picks its bid from what its side can see:

| Name      | Bids                                                                              |
| --------- | --------------------------------------------------------------------------------- |
| `steady`  | its divers times this dive's share of the pearls still to come                    |
| `miser`   | the dive's pearl count for four dives, then like `steady`                         |
| `hawk`    | 40% of its divers on a rich dive or a streak, else 1                              |
| `gambler` | a number up to twice the `steady` bid, drawn by hashing what its side can see     |
| `shadow`  | one more than the other crew's last bid                                           |
| `sniper`  | one more than the `steady` bid of the other crew on a rich or streak dive, else 0 |

All of them send every diver on the last dive. A rich dive is worth 3 or 4
pearls.

## The balance gate

`bun run gate` plays every ordered pair of the six personalities 100 times, 3600
matches, and exits 1 when one of these fails:

| Limit                                                             | Value          | Why                                                                                                                                                           |
| ----------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matches played                                                    | 3000           | Fewer matches make the shares below noise.                                                                                                                    |
| Draw rate                                                         | 5%             | A draw needs equal pearls and equal divers. The game measures 1%; more means ties have become common.                                                         |
| Blue's share of decided wins                                      | 50% ± 4 points | With about 3,500 decided matches the sampling error is 0.8 points, so 4 points is five times that: a fair game does not trip it and a bias of that size does. |
| One personality's share of its decided matches against the others | 75%            | The strongest measures 70%. A personality above 75% makes the others pointless to pick, and its win share has a sampling error of 1.5 points.                 |

Run `bun run batch --seeds 200` for the same batch with another size.
