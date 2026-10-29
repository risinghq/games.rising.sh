import type { Outcome } from "@rising/sim-kit";
import { choose, type Personality } from "./ai";
import { newTug, step, type Tug } from "./sim";

export interface Match extends Outcome {
  blue: Personality;
  red: Personality;
  seed: number;
  final: Tug;
}

/** One turn is one simulated minute. */
export function playMatch(
  blue: Personality,
  red: Personality,
  seed: number,
): Match {
  const t = newTug(seed);
  while (!t.winner) step(t, choose(t, "blue", blue), choose(t, "red", red));
  return { blue, red, seed, final: t, winner: t.winner, minutes: t.turn };
}
