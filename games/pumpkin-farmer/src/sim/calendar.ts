// The fixed farm calendar (design §2). Sim day 0 = Apr 1 ... 213 = Oct 31, the same every year,
// and Oct 1 is always a Thursday so the four October weekends always fall on Oct 3-4, 10-11, 17-18, 24-25.
// Winter (Nov-Mar) has no sim days: it is menus.
import { T, type Month } from './tuning.js';

export type { Month };
const C = T.calendar;
export const MONTHS: Month[] = C.months.map(([m]) => m);
const START = new Map<string, number>();
{ let d = 0; for (const [m, n] of C.months) { START.set(m, d); d += n; } }
const startOf = (m: Month) => START.get(m) ?? 0;
export const LAST_DAY = C.lastDay;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

// 'Jun 1' -> 61. Accepts a number (returned as is) so tuning can hold either.
export function dayOf(str: string | number): number {
  if (typeof str === 'number') return str;
  const [m = '', d = ''] = str.trim().split(/\s+/);
  const start = START.get(m);
  if (start === undefined) throw new Error(`calendar: bad date ${str}`);
  return start + (+d - 1);
}
export const monthOf = (d: number): Month => { let m: Month = 'Apr'; for (const k of MONTHS) if (d >= startOf(k)) m = k; return m; };
export const dateOf = (d: number) => { const m = monthOf(d); return { month: m, date: d - startOf(m) + 1 }; };
export const label = (d: number) => { const { month, date } = dateOf(d); return `${month} ${date}`; };

const OCT1 = dayOf('Oct 1');
export const dow = (d: number) => (((d - OCT1 + C.oct1Dow) % 7) + 7) % 7;      // 0 = Sun
export const dowName = (d: number, long = false): string => (long ? DOW_LONG : DOW)[dow(d)] ?? '';

// October weekends W1-W4 (Halloween Saturday is not a selling weekend).
const WEEKENDS = C.weekends.map((w, i) => ({ ...w, i, sat: dayOf(w.sat), sun: dayOf(w.sat) + 1 }));
export const weekends = () => WEEKENDS;
export const weekendIndex = (d: number) => WEEKENDS.findIndex((w) => d === w.sat || d === w.sun);
export const isWeekend = (d: number) => weekendIndex(d) >= 0;
export const isSaturday = (d: number) => isWeekend(d) && dow(d) === 6;
export const weekendMult = (d: number) => { const w = WEEKENDS[weekendIndex(d)]; return !w ? 0 : w.mult * (dow(d) === 6 ? C.dayMult.sat : C.dayMult.sun); };
export const nextWeekendDay = (d: number) => { for (let k = d + 1; k <= LAST_DAY; k++) if (isWeekend(k)) return k; return -1; };

export const WEIGHOFF = dayOf(C.weighoff), EVE = dayOf(C.eve), HALLOWEEN = dayOf(C.halloween);

// Which phase a sim day belongs to when the clock is running (the beat-driven phases are entered by game.js).
export function phaseOf(d: number) {
  if (d < OCT1) return 'grow';
  if (d <= EVE) return 'october';
  if (d === WEIGHOFF) return 'weighoff';
  return 'halloween';
}
export const season = (d: number) => (d < dayOf('Jun 1') ? 'spring' : d < dayOf('Sep 1') ? 'summer' : d < OCT1 ? 'september' : 'october');

// ------------------------------------------------------------ real time at 1x
const SPD = C.secondsPerDay.map(([from, s]): [number, number] => [dayOf(from), s]);
export const TICKS_PER_SECOND = C.weekend.ticksPerSecond;
export const OPEN = C.weekend.open, CLOSE = C.weekend.close, GATE_CLOSE = C.weekend.gateClose;
export const TICKS_PER_DAY = CLOSE - OPEN;

// Real seconds one sim day takes at 1x (a weekend day is its 480 ticks at 6 per second = 80 s).
export function secondsPerDay(d: number) {
  if (d >= OCT1) return isWeekend(d) ? TICKS_PER_DAY / TICKS_PER_SECOND : C.weekdaySeconds;
  let s = 0;
  for (const [from, v] of SPD) if (d >= from || !s) s = v;
  return s;
}
// 1x-seconds from the start of day d0 to the start of day d1 (the director and onboarding clock).
export function realSeconds(d0: number, d1: number) {
  let t = 0;
  for (let d = d0; d < d1; d++) t += secondsPerDay(d);
  return t;
}
export const tickSeconds = 1 / TICKS_PER_SECOND;

// 540 -> '9:00 am'
export function clockLabel(minute: number) {
  const h = Math.floor(minute / 60), m = minute % 60, h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// The moon for the full-moon pollination superstition: a 29.5-day cycle with a per-year offset.
export const moonPhase = (d: number, offset = 0) => ((((d + offset) / T.giant.rituals.moonCycle) % 1) + 1) % 1; // 0.5 = full
export const daysFromFull = (d: number, offset = 0) => Math.abs(moonPhase(d, offset) - 0.5) * T.giant.rituals.moonCycle;

export const cal = { dayOf, monthOf, dateOf, label, dow, dowName, weekends, weekendIndex, isWeekend, isSaturday, weekendMult,
  nextWeekendDay, phaseOf, season, secondsPerDay, realSeconds, tickSeconds, clockLabel, moonPhase, daysFromFull,
  WEIGHOFF, EVE, HALLOWEEN, OPEN, CLOSE, GATE_CLOSE, TICKS_PER_DAY, TICKS_PER_SECOND, LAST_DAY, MONTHS };
export default cal;
