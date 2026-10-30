import { seededPick } from "@rising/sim-kit";
import {
  MAX_LOAD,
  PASSES,
  ROUNDS,
  fogOf,
  legalLoad,
  other,
  runnerOf,
  type Border,
  type Round,
  type Side,
} from "./sim";

export type Personality =
  | "gambler"
  | "creature"
  | "ghost"
  | "hammer"
  | "warden"
  | "miser";
export const PERSONALITIES: Personality[] = [
  "gambler",
  "creature",
  "ghost",
  "hammer",
  "warden",
  "miser",
];

const passes = [...Array(PASSES).keys()];

/** Choice randomness comes only from the state and seed. */
const roll = (t: Border, who: string, side: Side, n: number, salt: string) =>
  seededPick(t.seed, n, `${who}-${side}-${salt}`, t.turn);

/** Turns left, this one included, on which `side` is the runner. */
function runsLeft(t: Border, side: Side): number {
  let n = 0;
  for (let k = t.turn; k < ROUNDS; k++)
    if ((k % 2 === 0) === (side === t.first)) n++;
  return n;
}

/** The load that spends the stock evenly over the runs left. */
function share(t: Border, side: Side): number {
  return Math.min(MAX_LOAD, Math.ceil(t.stock[side] / runsLeft(t, side)));
}

const ranBy = (t: Border, side: Side): Round[] =>
  t.history.filter((r) => r.runner === side);

const guardedBy = (t: Border, side: Side): Round[] =>
  t.history.filter((r) => r.runner !== side);

/** One turn in three, a seeded pass instead of the personality's habit. */
function deviate(t: Border, who: string, side: Side): number | undefined {
  return roll(t, who, side, 3, "deviate") === 0
    ? roll(t, who, side, PASSES, "stray")
    : undefined;
}

/** The pass with the extreme count, ties broken by the seed. */
function extreme(
  t: Border,
  who: string,
  side: Side,
  counts: number[],
  most: boolean,
): number {
  const sign = most ? 1 : -1;
  const top = Math.max(...counts.map((c) => sign * c));
  const tied = passes.filter((p) => sign * counts[p]! === top);
  return tied[roll(t, who, side, tied.length, "tie")]!;
}

function tally(rounds: Round[], field: "pass" | "guard"): number[] {
  const out = passes.map(() => 0);
  for (const r of rounds) out[r[field]]!++;
  return out;
}

/** A random pass other than the fogged one. */
function clear(t: Border, who: string, side: Side): number {
  const open = passes.filter((p) => p !== fogOf(t));
  return open[roll(t, who, side, open.length, "clear")]!;
}

/** Fog on half the rounds, else one of the clear passes: the one-round mix. */
function mixed(t: Border, who: string, side: Side): number {
  return roll(t, who, side, 2, "fog") === 0 ? fogOf(t) : clear(t, who, side);
}

export interface Order {
  /** Crates a runner carries; a watcher's order carries none. */
  load: number;
  /** The pass a runner takes, or a watcher guards. */
  pass: number;
}

export function choose(t: Border, side: Side, who: Personality): Order {
  const run = runnerOf(t) === side;
  return run
    ? { load: runLoad(t, side, who), pass: runPass(t, side, who) }
    : { load: 0, pass: guardPass(t, side, who) };
}

function runLoad(t: Border, side: Side, who: Personality): number {
  switch (who) {
    case "gambler":
      return legalLoad(t, 1 + roll(t, who, side, MAX_LOAD, "load"));
    case "hammer":
    case "warden":
      return legalLoad(t, MAX_LOAD);
    case "miser":
      return legalLoad(t, runsLeft(t, side) > 2 ? 1 : t.stock[side]);
    default:
      // Shift the even share so repeated turns do not use a fixed load.
      return legalLoad(
        t,
        runsLeft(t, side) === 1
          ? t.stock[side]
          : share(t, side) + roll(t, who, side, 3, "load") - 1,
      );
  }
}

function runPass(t: Border, side: Side, who: Personality): number {
  const foe = other(side);
  switch (who) {
    case "gambler":
      return roll(t, who, side, PASSES, "pass");
    case "creature": {
      const home = ranBy(t, side).filter((r) => !r.caught);
      return home.length
        ? home.at(-1)!.pass
        : roll(t, who, side, PASSES, "pass");
    }
    case "ghost":
      // Prefer the pass the other side has guarded least.
      return extreme(t, who, side, tally(guardedBy(t, foe), "guard"), false);
    case "hammer":
      return deviate(t, who, side) ?? fogOf(t);
    case "warden":
      return mixed(t, who, side);
    case "miser":
      return deviate(t, who, side) ?? clear(t, who, side);
  }
}

function guardPass(t: Border, side: Side, who: Personality): number {
  const foe = other(side);
  const foeRuns = ranBy(t, foe);
  switch (who) {
    case "gambler":
      return roll(t, who, side, PASSES, "guard");
    case "creature":
      return extreme(t, who, side, tally(foeRuns, "pass"), true);
    case "ghost":
      // Repeat the runner's most recent pass.
      return foeRuns.length
        ? foeRuns.at(-1)!.pass
        : roll(t, who, side, PASSES, "guard");
    case "hammer": {
      const seen = tally(foeRuns, "pass");
      seen[fogOf(t)] = -1;
      return deviate(t, who, side) ?? extreme(t, who, side, seen, true);
    }
    case "warden":
      return mixed(t, who, side);
    case "miser":
      // The fogged pass gives the runner the best chance to avoid capture.
      return fogOf(t);
  }
}
