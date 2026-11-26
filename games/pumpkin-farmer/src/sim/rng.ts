// Seeded, serializable RNG (mulberry32). All simulation randomness goes through this so that
// a game is fully determined by its seed plus the player's actions, and saves resume exactly.
//
// The RNG state is a single 32-bit integer kept inside game state (state.rng), so
// JSON round-trips preserve the stream.
import type { Rng } from './state.js';

export type { Rng };

export function makeRng(seed: number): Rng {
  return { s: (seed >>> 0) || 0x9e3779b9 };
}

// Advance and return a float in [0, 1).
export function next(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const range = (r: Rng, a: number, b: number) => a + (b - a) * next(r);
export const int = (r: Rng, a: number, b: number) => a + Math.floor(next(r) * (b - a + 1)); // inclusive
export const chance = (r: Rng, p: number) => next(r) < p;
// An empty arr has nothing to pick: callers pass non-empty lists.
export const pick = <T>(r: Rng, arr: readonly T[]): T => arr[Math.floor(next(r) * arr.length)]!;

// Weighted pick: items is [[value, weight], ...]
export function weighted<T>(r: Rng, items: readonly (readonly [T, number])[]): T | undefined {
  let total = 0;
  for (const [, w] of items) total += Math.max(0, w);
  if (total <= 0) return items[0]?.[0];
  let x = next(r) * total;
  for (const [v, w] of items) { x -= Math.max(0, w); if (x < 0) return v; }
  return items[items.length - 1]?.[0];
}

// Approximately normal (Irwin-Hall with 4 draws), mean 0, sd 1.
export function gauss(r: Rng): number {
  return (next(r) + next(r) + next(r) + next(r) - 2) * Math.sqrt(3);
}

export function shuffle<T>(r: Rng, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next(r) * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

// Derive an independent child stream (e.g. for cosmetic layout) without disturbing the parent much.
export function fork(r: Rng): Rng {
  return makeRng(Math.floor(next(r) * 4294967296));
}
