import { seededPick, seededRandom } from "@rising/sim-kit";
import type { World } from "./types";

/**
 * Deterministic randomness for the simulation. The sim must never call
 * Math.random(): everything random is a pure hash of the match seed plus
 * whatever identifies the decision (tick, entity id, a salt string…), so
 * a match replays identically from the same seed and commands.
 */

export { hash32, saltOf } from "@rising/sim-kit";

/** Uniform float in [0, 1) derived from the match seed and the given keys. */
export function worldRandom(w: World, salt: string, ...keys: number[]): number {
  return seededRandom(w.seed, salt, ...keys);
}

/** Integer in [0, n) derived from the match seed and the given keys. */
export function worldPick(w: World, n: number, salt: string, ...keys: number[]): number {
  return seededPick(w.seed, n, salt, ...keys);
}
