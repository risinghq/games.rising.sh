# Border rules

Two houses, blue and red, smuggle crates over three passes for ten rounds. You
are blue.

## Setup

The passes are A, B and C. Each house starts with 10 crates and no points. A
seed picks which house runs first. The houses then alternate: each one runs five
rounds and guards five.

## A round

1. Both houses see which pass lies under fog this round. The seed fixes it, and
   it changes from round to round. Both see every finished round.
2. The runner secretly picks a load, from none to 4 crates and no more than it
   has left, and a pass to carry it through. The other house, the watcher,
   secretly guards one pass.
3. A guard on the runner's pass catches the load. On the fogged pass the guard
   catches only when a seeded coin lands heads, one flip per round, so half the
   time.
4. A caught load scores for the watcher. A load that gets through scores for the
   runner. Either way, a load of `n` crates scores `n × n` points, and the
   runner's crates are gone.

## The end

After round ten the house with more points wins. On equal points the house that
caught more runners wins. If those are equal too, the match is a draw.

## Why it plays

- The watcher guesses a pass and the runner guesses what it will guess. A runner
  that repeats itself is caught, and so is a watcher that does.
- Fog is a cheap route: a guard there fails half the time. A runner who always
  takes it is read, and a watcher who only guards it gives up the other two
  passes.
- Points grow with the square of the load, so four crates in one run beat two
  runs of two. Both houses see how many crates each has left, so the watcher can
  tell which runs are still to come and how heavy they can be.
- Crates unspent at the end are worth nothing.

## Opponents

Red is one of six personalities. Each chooses from the state alone: crates, the
fog and every finished round.

| Name       | Plays                                                                              |
| ---------- | ---------------------------------------------------------------------------------- |
| `gambler`  | a load of 1 to 4, a pass and a guard, all drawn by hashing the state               |
| `creature` | runs the pass of its last run that got through, and guards the pass most run       |
| `ghost`    | runs the pass the other house has guarded least, and guards the last run pass      |
| `hammer`   | up to 4 crates every run, through the fog; guards the clear pass most run          |
| `warden`   | up to 4 crates every run; runs and guards the fog half the time, else a clear pass |
| `miser`    | 1 crate until two runs are left, then the rest; runs a clear pass, guards fog      |

`creature` and `ghost` spend their crates evenly over their runs, shifted by a
seeded step of one up or down. `hammer` and `miser` take a seeded pass instead
of their habit one turn in three. A clear pass is one without fog.

## The balance gate

`bun run gate` plays every ordered pair of the six personalities 100 times, 3600
matches, and exits 1 when one of these fails:

| Limit                                                             | Value          | Why                                                                                                                                                                                      |
| ----------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Matches played                                                    | 3000           | Fewer matches make the shares below noise.                                                                                                                                               |
| Draw rate                                                         | 6%             | A draw needs equal points and equal catches. The game measures 4.9%, mostly from pairs such as `hammer` against `hammer` that rarely meet on a pass. More means ties have become common. |
| Blue's share of decided wins                                      | 50% ± 4 points | The game measures 50.2%. With 3,425 decided matches the sampling error is 0.9 points, so 4 points is over four times that: a fair game does not trip it and a bias of that size does.    |
| One personality's share of its decided matches against the others | 75%            | The strongest, `hammer`, measures 69.2%. A personality above 75% makes the others pointless to pick, and its win share has a sampling error of 1.5 points.                               |

Run `bun run batch --seeds 200` for the same batch with another size.
