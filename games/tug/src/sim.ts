import { Fnv, seededPick } from "@rising/sim-kit";

export type Side = "blue" | "red";
export const SIDES: Side[] = ["blue", "red"];

/** The rope starts at 0; a side wins by pulling it to its own end. */
export const ROPE_END = 10;
export const MAX_TURNS = 60;
export const MAX_STAMINA = 10;
export const REGEN = 2;
export const EFFORTS = [1, 2, 3] as const;
export type Effort = (typeof EFFORTS)[number];

export interface Tug {
  seed: number;
  turn: number;
  /** Positive is blue's side. */
  rope: number;
  stamina: Record<Side, number>;
  winner: Side | "draw" | null;
}

export function newTug(seed: number): Tug {
  return {
    seed,
    turn: 0,
    rope: 0,
    stamina: { blue: MAX_STAMINA, red: MAX_STAMINA },
    winner: null,
  };
}

/** A side that pulls harder than its stamina allows pulls nothing. */
function pull(t: Tug, side: Side, effort: Effort): number {
  return effort <= t.stamina[side] ? effort : 0;
}

/**
 * Both sides choose an effort at once. A seeded gust of -1, 0 or +1 shifts the
 * rope each turn. The match ends when the rope reaches an end or after
 * MAX_TURNS, when the side the rope leans toward wins and a centred rope is a
 * draw.
 */
export function step(t: Tug, blue: Effort, red: Effort): void {
  if (t.winner) return;
  const gust = seededPick(t.seed, 3, "gust", t.turn) - 1;
  t.rope += pull(t, "blue", blue) - pull(t, "red", red) + gust;
  for (const [side, effort] of [
    ["blue", blue],
    ["red", red],
  ] as const)
    t.stamina[side] = Math.min(MAX_STAMINA, t.stamina[side] - effort + REGEN);
  t.turn++;
  if (t.rope >= ROPE_END) t.winner = "blue";
  else if (t.rope <= -ROPE_END) t.winner = "red";
  else if (t.turn >= MAX_TURNS)
    t.winner = t.rope > 0 ? "blue" : t.rope < 0 ? "red" : "draw";
}

/** A digest of the whole state: equal digests mean equal games. */
export function tugHash(t: Tug): string {
  const h = new Fnv();
  h.num(t.seed);
  h.num(t.turn);
  h.num(t.rope);
  h.num(t.stamina.blue);
  h.num(t.stamina.red);
  h.str(t.winner ?? "-");
  return h.hex();
}
