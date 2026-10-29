import { Fnv } from "@rising/sim-kit";
import {
  MAX_PEARLS,
  MAX_TURNS,
  other,
  pearlValue,
  type Reef,
  type Side,
} from "./sim";

/** What one side may know: no later dive than the next is revealed. */
export interface View {
  /**
   * A number in [0, 1) that is a hash of the rest of this view. It is the only
   * randomness a personality gets, and it holds nothing the view does not, so
   * it cannot be run back to the seed.
   */
  noise: number;
  side: Side;
  turn: number;
  divesLeft: number;
  /** Pearls the dive on offer is worth, and the one after it, if any. */
  value: number;
  next: number | null;
  mine: { divers: number; pearls: number };
  theirs: { divers: number; pearls: number };
  /** Taking this dive would be the second in a row for me / for them. */
  myStreak: boolean;
  theirStreak: boolean;
  /** Finished dives: the bids of both sides and whether I took it. */
  history: { mine: number; theirs: number; won: boolean }[];
}

export function viewOf(t: Reef, side: Side): View {
  const foe = other(side);
  const last = t.dives.at(-1)?.taker;
  const v: Omit<View, "noise"> = {
    side,
    turn: t.turn,
    divesLeft: MAX_TURNS - t.turn,
    value: pearlValue(t.seed, t.turn),
    next: t.turn + 1 < MAX_TURNS ? pearlValue(t.seed, t.turn + 1) : null,
    mine: { divers: t.divers[side], pearls: t.pearls[side] },
    theirs: { divers: t.divers[foe], pearls: t.pearls[foe] },
    myStreak: last === side,
    theirStreak: last === foe,
    history: t.dives.map((d) => ({
      mine: d.bids[side],
      theirs: d.bids[foe],
      won: d.taker === side,
    })),
  };
  return { ...v, noise: noiseOf(v) };
}

function noiseOf(v: Omit<View, "noise">): number {
  const h = new Fnv();
  h.str(v.side);
  for (const n of [v.turn, v.value, v.next ?? 0]) h.num(n);
  for (const d of v.history) for (const n of [d.mine, d.theirs]) h.num(n);
  return (h.h >>> 0) / 4294967296;
}

export type Personality =
  | "steady"
  | "miser"
  | "hawk"
  | "gambler"
  | "shadow"
  | "sniper";
export const PERSONALITIES: Personality[] = [
  "steady",
  "miser",
  "hawk",
  "gambler",
  "shadow",
  "sniper",
];

/** The average value of a dive nobody has seen yet. */
const MEAN_PEARLS = (1 + MAX_PEARLS) / 2;

/** Spend divers in proportion to this dive's share of the pearls still to come. */
function fairShare(divers: number, value: number, divesLeft: number): number {
  const ahead = MEAN_PEARLS * (divesLeft - 1);
  return Math.round((divers * value) / (value + ahead));
}

/** A personality sees the view and nothing else, so a seed replays. */
export function choose(t: Reef, side: Side, who: Personality): number {
  return decide(viewOf(t, side), who);
}

function decide(v: View, who: Personality): number {
  if (v.divesLeft === 1) return v.mine.divers;
  switch (who) {
    case "steady":
      return fairShare(v.mine.divers, v.value, v.divesLeft);
    case "miser":
      // Hoards divers for the closing dives, where a bigger purse wins.
      return v.turn < MAX_TURNS / 2
        ? v.value
        : fairShare(v.mine.divers, v.value, v.divesLeft);
    case "hawk":
      return v.value >= MAX_PEARLS - 1 || v.myStreak
        ? Math.ceil(0.4 * v.mine.divers)
        : 1;
    case "gambler":
      return Math.floor(
        v.noise * (2 * fairShare(v.mine.divers, v.value, v.divesLeft) + 1),
      );
    case "shadow": {
      const last = v.history.at(-1);
      return last
        ? last.theirs + 1
        : fairShare(v.mine.divers, v.value, v.divesLeft);
    }
    case "sniper":
      // Outbids the steady bid by one on dives worth fighting for.
      // Concedes the rest.
      return v.value >= MAX_PEARLS - 1 || v.myStreak || v.theirStreak
        ? fairShare(v.theirs.divers, v.value, v.divesLeft) + 1
        : 0;
  }
}
