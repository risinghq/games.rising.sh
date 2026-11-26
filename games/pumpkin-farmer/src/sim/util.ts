// Small pure helpers shared by sim modules (no state, no randomness of their own).
import type { Vars } from './types.js';

export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const round2 = (x: number) => Math.round(x * 100) / 100;
export const round3 = (x: number) => Math.round(x * 1000) / 1000;
export const round5 = (x: number) => Math.round(x / 5) * 5;
export function sum(arr: readonly number[]): number;
export function sum<T>(arr: readonly T[], f: (x: T) => number): number;
export function sum<T>(arr: readonly T[], f: (x: T) => number = Number): number {
  return arr.reduce((a, x) => a + f(x), 0);
}

// FNV-1a over the joined parts, finished with a murmur-style mix. Used to derive per-year RNG
// seeds (hash(seed, year, 'weather')) and stable per-day noise (forecasts) without consuming streams.
export function hash32(...parts: (string | number | boolean | null | undefined)[]) {
  const str = parts.join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

// '{name} weighs {w} lb' with vars; unknown keys are left visible so missing data is obvious in playtests.
export const fill = (str: string, vars: Vars = {}) => String(str).replace(/\{(\w+)\}/g, (m, k: string) => String(vars[k] ?? m));

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
// Hal reads numbers out loud on air ("sixty-eight percent").
export function words(n: number): string {
  n = Math.round(n);
  if (n < 20) return ONES[n] ?? String(n);
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n === 100) return 'one hundred';
  return String(n);
}

// Object.keys and Object.entries for a table typed Record<K, V>: its own keys come back as K, not string.
export const keys = <K extends string>(o: Partial<Record<K, unknown>>) => Object.keys(o) as K[];
export const entries = <K extends string, V>(o: Partial<Record<K, V>>) => Object.entries(o) as [K, V][];
// A table's own value for a key read from data (a save, a goal id): inherited keys like 'toString' miss.
export const own = <V>(table: Readonly<Record<string, V>>, key: string): V | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;
// A table with one row per key, in key order.
export const tabulate = <K extends string, V>(ids: readonly K[], row: (id: K) => V) =>
  Object.fromEntries(ids.map((id) => [id, row(id)])) as Record<K, V>;

// Deep clone for plain JSON state (saves, bot forks in tests).
export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
