import { seededPick } from "@rising/sim-kit";
import {
  MAX_AMMO,
  MOVES,
  TILES,
  canShoot,
  other,
  type Action,
  type Fen,
  type Move,
  type Side,
} from "./sim";

export type Personality =
  | "stalker"
  | "camper"
  | "dancer"
  | "gambler"
  | "hunter";
export const PERSONALITIES: Personality[] = [
  "stalker",
  "camper",
  "dancer",
  "gambler",
  "hunter",
];

const toward = (from: number, to: number): Move =>
  to > from ? 1 : to < from ? -1 : 0;

const flip = (t: Fen, salt: string): 0 | 1 =>
  seededPick(t.seed, 2, salt, t.turn) as 0 | 1;

const weave = (t: Fen, side: Side, who: string): Move =>
  MOVES[2 * flip(t, `${who}-${side}`)]!;

const aim = (t: Fen, side: Side, tile: number): number | null =>
  canShoot(t, side, tile) ? tile : null;

/**
 * Choices depend only on the shared state, so a seed replays. The state
 * includes positions, hp, rounds, reeds, and the last turn.
 */
export function choose(t: Fen, side: Side, who: Personality): Action {
  const foe = other(side);
  const me = t.pos[side];
  const them = t.pos[foe];
  const drift = t.last ? t.last.to[foe] - t.last.from[foe] : 0;
  const ahead = Math.min(TILES - 1, Math.max(0, them + drift));
  switch (who) {
    case "stalker":
      return {
        move: Math.abs(them - me) > 2 ? toward(me, them) : 0,
        shot: t.ammo[side] >= 2 ? aim(t, side, ahead) : null,
      };
    case "camper": {
      const home = t.reeds.reduce((a, b) =>
        Math.abs(b - me) < Math.abs(a - me) ? b : a,
      );
      return {
        move: toward(me, home),
        shot: t.ammo[side] === MAX_AMMO ? aim(t, side, them) : null,
      };
    }
    case "dancer":
      return {
        move: weave(t, side, "dancer"),
        shot: t.ammo[side] >= 2 ? aim(t, side, them) : null,
      };
    case "gambler": {
      const roll = (salt: string, n: number) =>
        seededPick(t.seed, n, `gambler-${side}-${salt}`, t.turn);
      const tile = them - 1 + roll("tile", 3);
      return {
        move: MOVES[roll("move", 3)]!,
        shot: roll("fire", 2) ? aim(t, side, tile) : null,
      };
    }
    case "hunter": {
      const guess = Math.min(
        TILES - 1,
        Math.max(0, them + 2 * flip(t, `hunter-aim-${side}`) - 1),
      );
      return {
        move: weave(t, side, "hunter"),
        shot: t.ammo[side] >= 2 ? aim(t, side, guess) : null,
      };
    }
  }
}
