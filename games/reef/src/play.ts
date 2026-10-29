import type { Outcome } from "@rising/sim-kit";
import { choose, type Personality } from "./ai";
import { newReef, step, type Reef } from "./sim";

export interface Match extends Outcome {
  blue: Personality;
  red: Personality;
  seed: number;
  final: Reef;
}

export function playMatch(
  blue: Personality,
  red: Personality,
  seed: number,
): Match {
  const t = newReef(seed);
  while (!t.winner) step(t, choose(t, "blue", blue), choose(t, "red", red));
  return { blue, red, seed, final: t, winner: t.winner, minutes: t.turn };
}
