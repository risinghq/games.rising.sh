import { Fnv, seededPick } from "@rising/sim-kit";

export type Side = "blue" | "red";
export const SIDES: Side[] = ["blue", "red"];

export const other = (s: Side): Side => (s === "blue" ? "red" : "blue");

export const MAX_TURNS = 8;
export const START_DIVERS = 24;
export const MAX_PEARLS = 4;

export interface Dive {
  value: number;
  bids: Record<Side, number>;
  taker: Side;
  /** The bids were equal and the coin chose the taker. */
  coin: boolean;
  /** Pearls taken: the value plus 1 when the taker also took the dive before. */
  gain: number;
}

export interface Reef {
  seed: number;
  turn: number;
  divers: Record<Side, number>;
  pearls: Record<Side, number>;
  dives: Dive[];
  winner: Side | "draw" | null;
}

export function newReef(seed: number): Reef {
  return {
    seed,
    turn: 0,
    divers: { blue: START_DIVERS, red: START_DIVERS },
    pearls: { blue: 0, red: 0 },
    dives: [],
    winner: null,
  };
}

/** The pearl value for a turn is deterministic from the seed. */
export function pearlValue(seed: number, turn: number): number {
  return 1 + seededPick(seed, MAX_PEARLS, "pearl", turn);
}

/** A bid is a whole number of divers, from none to everyone the side has left. */
export function clampBid(bid: number, divers: number): number {
  return Math.min(divers, Math.max(0, Math.floor(bid) || 0));
}

/**
 * Both sides bid divers in secret. The higher bid takes the dive's pearls and
 * pays its bid; the loser keeps every diver. Equal bids go to a seeded coin.
 * Taking two dives in a row earns a pearl more on the second. After the last
 * dive the side with more pearls wins, then the side with more divers left,
 * else the match is a draw.
 */
export function step(t: Reef, blue: number, red: number): void {
  if (t.winner) return;
  const bids = {
    blue: clampBid(blue, t.divers.blue),
    red: clampBid(red, t.divers.red),
  };
  const coin = bids.blue === bids.red;
  const taker: Side = coin
    ? SIDES[seededPick(t.seed, 2, "coin", t.turn)]!
    : bids.blue > bids.red
      ? "blue"
      : "red";
  const value = pearlValue(t.seed, t.turn);
  const streak = t.dives.at(-1)?.taker === taker;
  const gain = value + (streak ? 1 : 0);
  t.dives.push({ value, bids, taker, coin, gain });
  t.divers[taker] -= bids[taker];
  t.pearls[taker] += gain;
  t.turn++;
  if (t.turn >= MAX_TURNS) {
    const lead = t.pearls.blue - t.pearls.red || t.divers.blue - t.divers.red;
    t.winner = lead > 0 ? "blue" : lead < 0 ? "red" : "draw";
  }
}

/** Equal digests represent equal game state. */
export function reefHash(t: Reef): string {
  const h = new Fnv();
  h.num(t.seed);
  h.num(t.turn);
  for (const s of SIDES) {
    h.num(t.divers[s]);
    h.num(t.pearls[s]);
  }
  for (const d of t.dives) {
    h.num(d.bids.blue);
    h.num(d.bids.red);
    h.str(d.taker);
  }
  h.str(t.winner ?? "-");
  return h.hex();
}
