import { Fnv, seededPick } from "@rising/sim-kit";

export type Side = "blue" | "red";
export const SIDES: Side[] = ["blue", "red"];
export const other = (s: Side): Side => (s === "blue" ? "red" : "blue");

export const FORDS = 3;
/** A ford's line runs from -EDGE (red's bank) to EDGE (blue's bank). */
export const EDGE = 2;
/** Each side gets these troops every turn. Unsent troops return next turn. */
export const ARMY = 7;
/** A margin this wide at a ford is a rout and pushes the line two steps. */
export const ROUT = 4;
export const MAX_TURNS = 8;
/** Fords a side must hold at its bank to win outright. */
export const FORDS_TO_WIN = 2;

/** Troops sent to each ford, in ford order. */
export type Orders = number[];

export interface Clash {
  sent: Record<Side, number>;
  /** The side that pushed the line, or null when forces tie. */
  pushed: Side | null;
  steps: number;
}

export interface Turn {
  clashes: Clash[];
}

export interface Ford {
  seed: number;
  turn: number;
  /** Positive values favor blue. */
  line: number[];
  /** Finished turns in chronological order. */
  history: Turn[];
  winner: Side | "draw" | null;
}

/**
 * A seed fixes the opening line: one ford starts a step toward blue and a
 * different one a step toward red, so the opening favours neither side.
 */
export function openingLine(seed: number): number[] {
  const blue = seededPick(seed, FORDS, "blue-ford");
  const red = (blue + 1 + seededPick(seed, FORDS - 1, "red-ford")) % FORDS;
  return Array.from({ length: FORDS }, (_, i) =>
    i === blue ? 1 : i === red ? -1 : 0,
  );
}

export function newFord(seed: number): Ford {
  return {
    seed,
    turn: 0,
    line: openingLine(seed),
    history: [],
    winner: null,
  };
}

/**
 * Whole, non-negative orders for every ford, cut so a side never sends more
 * than ARMY troops. Later fords give up troops first.
 */
export function legalOrders(orders: Orders): Orders {
  let left = ARMY;
  return Array.from({ length: FORDS }, (_, i) => {
    const n = Number(orders[i]);
    const sent = Number.isFinite(n)
      ? Math.min(left, Math.max(0, Math.floor(n)))
      : 0;
    left -= sent;
    return sent;
  });
}

export function held(t: Ford, side: Side): number {
  const bank = side === "blue" ? EDGE : -EDGE;
  return t.line.filter((l) => l === bank).length;
}

export function wins(t: Ford, side: Side): number {
  return t.history.reduce(
    (n, turn) => n + turn.clashes.filter((c) => c.pushed === side).length,
    0,
  );
}

/**
 * One side holding the banks wins at once. After MAX_TURNS, or when both reach
 * them together, the sum of the lines decides, then fords won, else a draw.
 */
function finish(t: Ford): void {
  const blue = held(t, "blue") >= FORDS_TO_WIN;
  const red = held(t, "red") >= FORDS_TO_WIN;
  if (blue !== red) {
    t.winner = blue ? "blue" : "red";
    return;
  }
  if (!blue && t.turn < MAX_TURNS) return;
  const lead =
    t.line.reduce((a, b) => a + b, 0) || wins(t, "blue") - wins(t, "red");
  t.winner = lead > 0 ? "blue" : lead < 0 ? "red" : "draw";
}

/**
 * Both sides send their army across the fords at once. The larger force at a
 * ford pushes the line one step, or two by a margin of ROUT. A tie moves
 * nothing. Holding FORDS_TO_WIN banks wins; see `finish` for the cap.
 */
export function step(t: Ford, blue: Orders, red: Orders): void {
  if (t.winner) return;
  const sent = { blue: legalOrders(blue), red: legalOrders(red) };
  const clashes: Clash[] = [];
  for (let i = 0; i < FORDS; i++) {
    const b = sent.blue[i]!;
    const r = sent.red[i]!;
    const pushed = b > r ? "blue" : r > b ? "red" : null;
    const steps = Math.abs(b - r) >= ROUT ? 2 : pushed ? 1 : 0;
    t.line[i] = Math.min(
      EDGE,
      Math.max(-EDGE, t.line[i]! + (pushed === "blue" ? steps : -steps)),
    );
    clashes.push({ sent: { blue: b, red: r }, pushed, steps });
  }
  t.history.push({ clashes });
  t.turn++;
  finish(t);
}

/** Equal digests represent equal game state. */
export function fordHash(t: Ford): string {
  const h = new Fnv();
  h.num(t.seed);
  h.num(t.turn);
  for (const l of t.line) h.num(l);
  for (const turn of t.history)
    for (const c of turn.clashes) {
      h.num(c.sent.blue);
      h.num(c.sent.red);
    }
  h.str(t.winner ?? "-");
  return h.hex();
}
