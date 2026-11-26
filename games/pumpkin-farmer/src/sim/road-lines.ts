// [D] The Road's words (plan §3.6, rulings R12): one { title, why, icon, approx? } per year-1 beat id, for the Next-stop chip
// ("May 20 · Plan October ⏭") and a locked thing's caption ("Good dirt. Gran's got plans for it. · Plan October · May 20 ·
// 9 days"). A beat may also carry its own road: { ... }; story.road(s, ctx) reads either.
//
// Rules every title keeps (tests/sim/road.test.js lints them on every day of the year, for three bots):
//   - the chip "{date} · {title} ⏭" fits in T.road.chipMax (26) characters: a title is at most 15
//   - it never names a system the farm hasn't met (story.mentions / needsMet) nor a character the player hasn't met: a stop
//     is shown before its own lesson, so it can't say "fog" before Hal's report, "kelp" before Old Moss, "bugs" before Gran
//   - approx: the day comes from the farm (the first flower, the cull, a dry week), so the chip says "~Jul 1"
// Ids of beats that other tracks are re-cutting (giant.moving, crawl.crawl, patch.seedLetter) are here too: a stop only
// shows for a beat that exists.
import { label } from './calendar.js';
import { fill, own } from './util.js';
import { T } from './tuning.js';
import type { State } from './types.js';

/** A Road stop's words. approx: the day comes from the farm. when: the stop comes on this farm. */
export interface RoadMeta {
  title: string;
  why?: string;
  icon: string;
  approx?: boolean;
  when?: (s: State) => boolean;
}
/** One stop on this year's Road (story.road). */
export interface RoadStop {
  id: string;
  kind: 'beat' | 'sow' | 'weekend' | 'weighoff';
  day: number | null;
  est: boolean;
  done: boolean;
  title: string;
  why: string | null;
  icon: string | null;
  row?: number;
}
export type DatedStop = RoadStop & { day: number };

export const ROAD: Readonly<Record<string, RoadMeta>> = {
  'giant.seed': { title: "Grandpa's seed", why: 'Start her on the heat mat.', icon: 'giant' },
  'weather.marlene': { title: 'Morning radio', why: "KQSC's morning show has news about the weather.", icon: 'radio' },
  'giant.water': { title: 'Moving day', why: 'She goes out to her corner.', icon: 'giant' },
  'giant.moving': { title: 'Moving day', why: 'She goes out to her corner. Pick a clear morning.', icon: 'giant' },
  'giant.kelp': { title: 'A visitor', why: 'Somebody wise is coming to see her.', icon: 'giant' },
  'patch.plant': { title: 'Plan October', why: "Gran's seed has come: plan the four weekends.", icon: 'calendar' },
  'patch.seedLetter': { title: 'Plan October', why: "Gran's seed has come: plan the four weekends.", icon: 'calendar' },
  'patch.water': { title: 'A dry spell', why: 'Young vines get thirsty.', icon: 'drop', approx: true },
  'giant.pollinate': { title: 'First flower', why: 'At dawn, she needs pollen.', icon: 'giant', approx: true },
  'giant.cull': { title: 'Name her', why: 'Keep one fruit, and give her a name.', icon: 'giant', approx: true },
  // when(s): the stop comes on this farm (bugs only find a sown row)
  'patch.bugs': { title: 'Little pests', why: 'Something wants to eat your rows.', icon: 'patch',
    when: (s: State) => (s.patch?.rows || []).some((r) => r.open && (r.plantedDay != null || r.plan)) },
  'giant.measure': { title: 'How big is she?', why: 'Somebody brings a tape.', icon: 'giant' },
  'crawl.crawl': { title: 'The Vine Crawl', why: 'The whole Cove comes to look over your fence.', icon: 'giant' },
  'giant.shade': { title: "Heat's coming", why: 'A hot spell is on the way.', icon: 'heat' },
  'giant.creak': { title: 'Growing pains', why: 'She grows so fast she makes noises.', icon: 'giant', approx: true },
  'giant.crier': { title: 'Front page', why: 'The paper wants your number.', icon: 'giant' },
  'giant.rituals': { title: 'Superstitions', why: 'Old habits that might help. Might.', icon: 'giant' },
  'patch.barn': { title: 'Season prep', why: 'Three weeks to opening day.', icon: 'barn' },
};

// Stops that aren't beats: a planned row's sowing day ({r}: the row number) and the October weekends.
export const ROAD_STOPS = {
  sow: { title: 'Row {r} goes in', icon: 'patch' },
  weekend: { title: '{w} at the stand', icon: 'stand' },
  weighoff: { title: 'The weigh-off', icon: 'scale' },
};

// The stop's date as the chip says it: "Today", "May 20", or "~Jul 1" while it depends on the farm.
export const approx = (stop: RoadStop) => stop.est || !!own(ROAD, stop.id)?.approx;
export function whenText(stop: DatedStop, day: number) {
  if (stop.day <= day) return 'Today';
  return `${approx(stop) ? '~' : ''}${label(stop.day)}`;
}
// The Next-stop chip (rulings R12): "May 20 · Plan October ⏭", at most T.road.chipMax characters. One ⏭ only: it is the
// dock's Skip, aimed at this stop.
export const chipText = (stop: DatedStop, day: number) => `${whenText(stop, day)} · ${stop.title} ⏭`;
// The countdown: "today", "1 day", "9 days", "~9 days".
export function daysText(stop: DatedStop, day: number) {
  const n = Math.max(0, stop.day - day);
  return n === 0 ? 'today' : `${approx(stop) ? '~' : ''}${n} day${n === 1 ? '' : 's'}`;
}
// A locked thing names the stop that opens it: " · Plan October · May 20 · 9 days" (plan §3.4, §8.6).
export function lockSuffix(stop: RoadStop | null, day: number) {
  if (stop?.day == null) return '';
  const dated = { ...stop, day: stop.day };
  return dated.day <= day ? ` · ${stop.title} · today` : fill(' · {t} · {d} · {n}', { t: stop.title, d: whenText(dated, day), n: daysText(dated, day) });
}
export const CHIP_MAX = T.road.chipMax;
