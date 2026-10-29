/**
 * Deterministic randomness. A simulation never calls Math.random(): every
 * random value is a pure hash of the match seed plus whatever identifies the
 * decision (tick, entity id, a salt string), so a match replays identically
 * from the same seed and commands.
 */

/** 32-bit integer hash of any number of integers (murmur-style finaliser). */
export function hash32(...xs: number[]): number {
  let h = 0x9e3779b9 | 0;
  for (const x of xs) {
    h = Math.imul(h ^ (x | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}

/** Stable integer for a short string salt (e.g. "drop", "wave"). */
export function saltOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Uniform float in [0, 1) derived from the seed, a salt and the given keys. */
export function seededRandom(
  seed: number,
  salt: string,
  ...keys: number[]
): number {
  return hash32(seed, saltOf(salt), ...keys) / 4294967296;
}

/** Integer in [0, n) derived from the seed, a salt and the given keys. */
export function seededPick(
  seed: number,
  n: number,
  salt: string,
  ...keys: number[]
): number {
  return Math.floor(seededRandom(seed, salt, ...keys) * n) % Math.max(1, n);
}
