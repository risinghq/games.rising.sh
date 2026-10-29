import { seededPick } from "@rising/sim-kit";
import { EFFORTS, type Effort, type Side, type Tug } from "./sim";

export type Personality = "steady" | "burst" | "gambler" | "saver";
export const PERSONALITIES: Personality[] = [
  "steady",
  "burst",
  "gambler",
  "saver",
];

/** Every choice is a pure function of the state, so a seed replays. */
export function choose(t: Tug, side: Side, who: Personality): Effort {
  const stamina = t.stamina[side];
  switch (who) {
    case "steady":
      return 2;
    case "burst":
      return stamina >= 6 ? 3 : 1;
    case "gambler":
      return EFFORTS[
        seededPick(t.seed, EFFORTS.length, `gambler-${side}`, t.turn)
      ]!;
    case "saver":
      return stamina >= 9 ? 3 : stamina >= 3 ? 2 : 1;
  }
}
