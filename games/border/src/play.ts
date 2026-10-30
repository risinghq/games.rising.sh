import type { Outcome } from "@rising/sim-kit";
import { choose, type Personality } from "./ai";
import { newBorder, other, runnerOf, step, type Border } from "./sim";

export interface Match extends Outcome {
  blue: Personality;
  red: Personality;
  seed: number;
  final: Border;
}

export function playRound(
  t: Border,
  who: Record<"blue" | "red", Personality>,
): void {
  const runner = runnerOf(t);
  const run = choose(t, runner, who[runner]);
  const watch = choose(t, other(runner), who[other(runner)]);
  step(t, run.load, run.pass, watch.pass);
}

export function playMatch(
  blue: Personality,
  red: Personality,
  seed: number,
): Match {
  const t = newBorder(seed);
  while (!t.winner) playRound(t, { blue, red });
  return { blue, red, seed, final: t, winner: t.winner, minutes: t.turn };
}
