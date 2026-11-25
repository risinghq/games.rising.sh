// Small pure helpers shared by sim modules (no state, no randomness of their own).

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const round2 = (x) => Math.round(x * 100) / 100;
export const round3 = (x) => Math.round(x * 1000) / 1000;
export const round5 = (x) => Math.round(x / 5) * 5;
export const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);

// FNV-1a over the joined parts, finished with a murmur-style mix. Used to derive per-year RNG
// seeds (hash(seed, year, 'weather')) and stable per-day noise (forecasts) without consuming streams.
export function hash32(...parts) {
  const str = parts.join('|');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

// '{name} weighs {w} lb' with vars; unknown keys are left visible so missing data is obvious in playtests.
export const fill = (str, vars = {}) => String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
// Hal reads numbers out loud on air ("sixty-eight percent").
export function words(n) {
  n = Math.round(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n === 100) return 'one hundred';
  return String(n);
}

// Deep clone for plain JSON state (saves, bot forks in tests).
export const clone = (o) => JSON.parse(JSON.stringify(o));
