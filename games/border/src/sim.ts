import { Fnv, seededPick, seededRandom } from "@rising/sim-kit";

export type Side = "blue" | "red";
export const SIDES: Side[] = ["blue", "red"];
export const other = (s: Side): Side => (s === "blue" ? "red" : "blue");

export const PASSES = 3;
export const ROUNDS = 10;
export const STOCK = 10;
export const MAX_LOAD = 4;
/** Chance that a guard on the fogged pass catches a runner who goes there. */
export const FOG_CATCH = 0.5;

/** One finished round, public to both sides. */
export interface Round {
  runner: Side;
  fog: number;
  load: number;
  pass: number;
  guard: number;
  caught: boolean;
}

export interface Border {
  seed: number;
  turn: number;
  /** The side that runs on even turns; the other runs on odd turns. */
  first: Side;
  stock: Record<Side, number>;
  points: Record<Side, number>;
  history: Round[];
  winner: Side | "draw" | null;
}

export function newBorder(seed: number): Border {
  return {
    seed,
    turn: 0,
    first: seededPick(seed, 2, "first") === 0 ? "blue" : "red",
    stock: { blue: STOCK, red: STOCK },
    points: { blue: 0, red: 0 },
    history: [],
    winner: null,
  };
}

export function runnerOf(t: Border): Side {
  return t.turn % 2 === 0 ? t.first : other(t.first);
}

/** The pass the fog sits on this turn. The seed fixes it for both sides. */
export function fogOf(t: Border): number {
  return seededPick(t.seed, PASSES, "fog", t.turn);
}

/** Crates the runner may declare: a whole number up to its stock and the cap. */
export function legalLoad(t: Border, load: number): number {
  const most = Math.min(MAX_LOAD, t.stock[runnerOf(t)]);
  return Math.max(0, Math.min(most, Math.floor(load) || 0));
}

/** A whole pass number, clamped into range. */
export function legalPass(pass: number): number {
  return Math.max(0, Math.min(PASSES - 1, Math.floor(pass) || 0));
}

/** Points a load is worth: heavy crates fetch more than light ones. */
export const worth = (load: number): number => load * load;

/** Rounds `side` won as the watcher by catching the runner. */
export function catches(t: Border, side: Side): number {
  return t.history.filter((r) => r.runner !== side && r.caught).length;
}

/**
 * One round. The runner picks a `load` and a `pass`, the watcher a `guard`
 * pass, both in secret. A guard on the runner's pass catches the crates, except
 * on the fogged pass, where a seeded coin decides. After ROUNDS rounds the
 * higher score wins, then the side with more catches, else a draw.
 */
export function step(
  t: Border,
  load: number,
  pass: number,
  guard: number,
): void {
  if (t.winner) return;
  const runner = runnerOf(t);
  const carried = legalLoad(t, load);
  const route = legalPass(pass);
  const watch = legalPass(guard);
  const fog = fogOf(t);
  const caught =
    watch === route &&
    (route !== fog || seededRandom(t.seed, "fog-coin", t.turn) < FOG_CATCH);
  t.points[caught ? other(runner) : runner] += worth(carried);
  t.stock[runner] -= carried;
  t.history.push({
    runner,
    fog,
    load: carried,
    pass: route,
    guard: watch,
    caught,
  });
  t.turn++;
  if (t.turn < ROUNDS) return;
  const lead = (a: number, b: number): Side | "draw" =>
    a === b ? "draw" : a > b ? "blue" : "red";
  const byPoints = lead(t.points.blue, t.points.red);
  t.winner =
    byPoints !== "draw"
      ? byPoints
      : lead(catches(t, "blue"), catches(t, "red"));
}

/** A digest of the whole state: equal digests mean equal games. */
export function borderHash(t: Border): string {
  const h = new Fnv();
  h.num(t.seed);
  h.num(t.turn);
  h.str(t.first);
  h.num(t.stock.blue);
  h.num(t.stock.red);
  h.num(t.points.blue);
  h.num(t.points.red);
  for (const r of t.history) {
    h.str(r.runner);
    h.num(r.fog);
    h.num(r.load);
    h.num(r.pass);
    h.num(r.guard);
    h.str(r.caught ? "c" : "-");
  }
  h.str(t.winner ?? "-");
  return h.hex();
}
