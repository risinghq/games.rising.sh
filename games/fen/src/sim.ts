import { Fnv, seededPick } from "@rising/sim-kit";

export type Side = "blue" | "red";
export const SIDES: Side[] = ["blue", "red"];
export const other = (s: Side): Side => (s === "blue" ? "red" : "blue");

/** The marsh is a row of tiles 0 to TILES - 1. Blue starts left, red right. */
export const TILES = 7;
export const RANGE = 3;
export const START_HP = 3;
export const START_AMMO = 2;
export const MAX_AMMO = 3;
export const MAX_TURNS = 24;
/** The reeds lie flat from this turn on and hide nobody. */
export const FLAT_TURN = 12;
export const MOVES = [-1, 0, 1] as const;
export type Move = (typeof MOVES)[number];

export interface Action {
  move: Move;
  /** The tile to shoot at, or null to hold fire and reload. */
  shot: number | null;
}

/** What happened on one turn, as both sides see it afterwards. */
export interface Turn {
  actions: Record<Side, Action>;
  /** Where each side stood when it chose. */
  from: Record<Side, number>;
  to: Record<Side, number>;
  /** The side fired this turn. */
  fired: Record<Side, boolean>;
  /** The side was hit this turn. */
  hit: Record<Side, boolean>;
}

export interface Fen {
  seed: number;
  turn: number;
  pos: Record<Side, number>;
  hp: Record<Side, number>;
  ammo: Record<Side, number>;
  /** Tiles with reeds that stand until FLAT_TURN. The layout is mirrored. */
  reeds: number[];
  last: Turn | null;
  winner: Side | "draw" | null;
}

/** A seed fixes one reed tile in 1 to 3 and its mirror image. */
export function reedTiles(seed: number): number[] {
  const r = 1 + seededPick(seed, 3, "reed");
  return r === TILES - 1 - r ? [r] : [r, TILES - 1 - r];
}

export function newFen(seed: number): Fen {
  return {
    seed,
    turn: 0,
    pos: { blue: 0, red: TILES - 1 },
    hp: { blue: START_HP, red: START_HP },
    ammo: { blue: START_AMMO, red: START_AMMO },
    reeds: reedTiles(seed),
    last: null,
    winner: null,
  };
}

/** The tile a move reaches, kept on the board. */
export function destination(from: number, move: Move): number {
  return Math.min(TILES - 1, Math.max(0, from + move));
}

/** A shot needs a round in the gun and a target tile within RANGE. */
export function canShoot(t: Fen, side: Side, tile: number): boolean {
  return (
    t.ammo[side] > 0 &&
    Number.isInteger(tile) &&
    tile >= 0 &&
    tile < TILES &&
    Math.abs(tile - t.pos[side]) <= RANGE
  );
}

/**
 * Both sides move and shoot at once. Moves resolve first. A collision or swap
 * moves neither. A shot hits the foe's final tile unless reeds hide the foe.
 * Cover is measured from the shooter's start tile. An invalid shot is held and
 * holding fire reloads one round.
 */
export function step(t: Fen, blue: Action, red: Action): void {
  if (t.winner) return;
  const actions = { blue, red };
  const from = { ...t.pos };
  const to = {
    blue: destination(from.blue, blue.move),
    red: destination(from.red, red.move),
  };
  const swap = to.blue === from.red && to.red === from.blue;
  if (to.blue === to.red || swap) {
    to.blue = from.blue;
    to.red = from.red;
  }
  const fired = { blue: false, red: false };
  const hit = { blue: false, red: false };
  for (const side of SIDES) {
    const tile = actions[side].shot;
    fired[side] = tile !== null && canShoot(t, side, tile);
  }
  for (const side of SIDES) {
    const foe = other(side);
    const tile = actions[side].shot;
    if (!fired[side] || tile !== to[foe]) continue;
    const range = Math.abs(tile - from[side]);
    const hidden = t.turn < FLAT_TURN && t.reeds.includes(tile);
    hit[foe] = !hidden || range <= 1;
  }
  for (const side of SIDES) {
    t.ammo[side] = fired[side]
      ? t.ammo[side] - 1
      : Math.min(MAX_AMMO, t.ammo[side] + 1);
    if (hit[side]) t.hp[side]--;
  }
  t.pos = to;
  t.last = { actions, from, to, fired, hit };
  t.turn++;
  if (t.hp.blue <= 0 || t.hp.red <= 0 || t.turn >= MAX_TURNS) {
    const lead = t.hp.blue - t.hp.red || t.ammo.blue - t.ammo.red;
    t.winner = lead > 0 ? "blue" : lead < 0 ? "red" : "draw";
  }
}

/** A digest of the whole state: equal digests mean equal games. */
export function fenHash(t: Fen): string {
  const h = new Fnv();
  h.num(t.seed);
  h.num(t.turn);
  for (const side of SIDES) {
    h.num(t.pos[side]);
    h.num(t.hp[side]);
    h.num(t.ammo[side]);
  }
  for (const r of t.reeds) h.num(r);
  h.str(t.winner ?? "-");
  return h.hex();
}
