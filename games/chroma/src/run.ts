// What a run spawns and how its ducks move, without Phaser. The play scene and
// the headless simulation both draw from here, so a seed gives the same ducks in
// either.
import { seededRandom } from "@rising/sim-kit";
import { pickDuck, type Difficulty, type DuckSpec } from "./rules";

export const WIDTH = 1280;
export const HEIGHT = 720;

// A duck enters and leaves this far beyond the screen edge.
export const OFFSCREEN = 80;
// The pool of duck sprites. A spawn that finds every one busy is skipped.
export const MAX_DUCKS = 14;
// The first duck waits this long beyond the first spawn interval.
export const FIRST_SPAWN_DELAY_MS = 1500;

export interface LaneSpec {
  top: number;
  dir: 1 | -1;
  speed: number;
}

// Back to front. A duck floats at its lane's top plus SURFACE_OFFSET.
export const LANES: readonly LaneSpec[] = [
  { top: 330, dir: 1, speed: 0.8 },
  { top: 440, dir: -1, speed: 1 },
  { top: 545, dir: 1, speed: 1.2 },
];
export const SURFACE_OFFSET = 26;

// A ruined duck flies up at this speed, 1.5 times its swim speed sideways.
export const FLEE_RISE = 320;

/** A stream of uniform floats in [0, 1) for one seed and salt. */
export function stream(seed: number, salt: string): () => number {
  let i = 0;
  return () => seededRandom(seed, salt, i++);
}

export interface Spawn {
  spec: DuckSpec;
  lane: number;
  speed: number;
  phase: number;
}

/** The next duck of a run, drawn from the run's spawn stream. */
export function nextSpawn(d: Difficulty, rng: () => number): Spawn {
  const spec = pickDuck(d, rng);
  const lane = Math.floor(rng() * LANES.length);
  const speed = d.speed * LANES[lane]!.speed * (0.9 + rng() * 0.2);
  const phase = rng() * Math.PI * 2;
  return { spec, lane, speed, phase };
}

/** A fresh seed for a run the player starts. */
export function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}
