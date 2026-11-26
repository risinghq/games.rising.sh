// The surprise director (design §10). Every catalogued event is declared by its owning module:
//   { id, cls: 'notable'|'minor'|'story'|'chain', per: 'day'|'tick', when(s, ctx), rate(s, ctx) -> probability,
//     cooldownDays?, cooldownTicks?, capYear?, capSeason?, urgent?, quiet?, text?(s), fire(s, ctx), tap?(s, ctx, active) }
// The director applies the §10 spacing in 1x-seconds, the pity timer, novelty decay, the 25% share cap and the
// year-1 gap rule, and logs every firing so tests can measure rates. Chains bypass spacing via fireNow().
// Urgent events (weather-driven ones the player must hear about) bypass spacing and the share cap.
//
// s.events = { last: { [id]: { y, d, t } }, count: { [id]: n } (lifetime), year: { [id]: n }, season: { [id]: n },
//              byYear: { [y]: { [id]: n } } (last 3 years, for novelty), notables: n (this year), lastNotable1x,
//              active: [{ id, until, x?, z?, data? }] (pins and timed effects), log: [{ y, d, m, t, id, cls }], logbook }
// Out-events: { type: 'event', id, cls, text, urgent, x?, z? }, { type: 'toast', text, cls }.
//
// [A] The delight lane (plan §3.1; rulings R2, R4, R10): cls 'delight' entries are surprises with a ✦ pin, caused by the
// farm's state. They never go through the notable pass: the lane (section below) gives them their own cadence, guarantees
// year 1's slots, and queues each one as a moment (kind 'delight'), so it lands 12 s of 1x clear of every lesson. Out-events:
// { type: 'event', id, cls: 'delight', pin, text, x, z, cause, slot, fallback } (Skip stops on it: game.stopsSkip), and
// { type: 'lane/skip', slot } when a year-1 slot found no quiet day in its window.
import { T } from './tuning.js';
import { monthOf, isWeekend, dayOf, realSeconds, secondsPerDay } from './calendar.js';
import { next, makeRng } from './rng.js';
import { hash32, own, entries } from './util.js';
import { PLACES } from './layout.js';
import { LINES, introNear, line, fresh, quietForChatter, quietWindow, needsMet, momentWaiting } from './story.js';
import { HAL, heatCount } from './lines-mischief.js';
import type { SimModule, State, Ctx, DirectorEvent, FireData, DelightShown } from './types.js';
import type { EventsActive, SlotKey } from './state.js';

const E = T.events, CAT = E.cat;
const growing = (s: State) => s.clock.phase === 'grow';
const weekendNow = (s: State) => s.clock.phase === 'october' && isWeekend(s.clock.day);
const inMonths = (s: State, months: string|string[]) => months.includes(monthOf(s.clock.day));

// ------------------------------------------------------------ cross-cutting catalogue (weather and sea)
const OWN: DirectorEvent[] = [
  { // Marlene packs her bags: a toast on the first day of every heat wave (the season slice adds the crowd).
    id: 'heat_wave', cls: 'notable', per: 'day', urgent: true,
    when: (s: State) => (growing(s) || s.clock.phase === 'october') && s.weather.heat > 0 && !s.weather.days[s.clock.day - 1]?.heat,
    rate: () => 1,
    // [A] Hal never says the same heat line twice in a row (plan §3.1: heatToday x9, fresh() with a keyed pick)
    text: (s: State) => {
      if (s.clock.phase === 'october') return LINES.hal.heatSeason;
      const t = fresh(s, makeRng(hash32(s.seed, s.clock.year, s.clock.day, 'heatToday')), 'hal.heatToday', HAL.heatToday);
      return t == null ? null : line(s, t, { n: heatCount(s) });
    },
    fire(s: State, ctx: Ctx) {
      let end = s.clock.day; while (s.weather.days[end + 1]?.heat) end++;
      activate(s, { id: 'heat_wave', until: end });
      ctx.alert('heat_wave', { cls: 'heat', speaker: 'hal' });       // auto-slow; the event toast carries Hal's line
    },
  },
  { // Quarter Sun Day: f under 0.08 in summer. Giant growth x1.15 and sunscald x2 today (giant slice reads isActive).
    id: 'quarter_sun', cls: 'notable', per: 'day', urgent: true, cooldownDays: CAT.quarter_sun.cooldown, capYear: CAT.quarter_sun.cap,
    when: (s: State) => growing(s) && inMonths(s, CAT.quarter_sun.months) && s.weather.f < CAT.quarter_sun.f && !s.weather.heat,
    rate: () => 1,
    fire(s: State) { activate(s, { id: 'quarter_sun', until: s.clock.day }); },
  },
  { // [A] The growing-season whale, a delight (plan §3.2): she rolls and spouts off the bluff on a clear day (Marlene's out),
    // a ✦ pin over her; tap it to log her. (The weekend crowd version is the season slice's own whale_weekend.)
    id: 'whale', cls: 'delight', per: 'day', cooldownDays: CAT.whale.cooldown, capYear: CAT.whale.capGrow,
    when: (s: State) => growing(s) && inMonths(s, CAT.whale.months) && s.weather.f < CAT.whale.f,
    base: (s: State) => growing(s) && inMonths(s, CAT.whale.months),
    cause: (s: State) => (s.weather.f < CAT.whale.f ? 'clear' : null),
    rate: (s: State) => (s.clock.year === 1 ? CAT.whale.y1Rate : CAT.whale.rate),
    fire(s: State, ctx: Ctx) {
      activate(s, { id: 'whale', until: s.clock.day + CAT.whale.tapDays, x: PLACES.whale.x, z: PLACES.whale.z });
      ctx.emit({ type: 'sound', name: 'foghorn' });
      return { at: { x: PLACES.whale.x, y: 0.5, z: PLACES.whale.z }, label: 'A whale!' };
    },
    look(s: State, ctx: Ctx) {
      const n = (s.events.logbook.whales = (s.events.logbook.whales || 0) + 1);
      ctx.story('whale', 5, { n });
      ctx.emit({ type: 'sound', name: 'plink' });
      return { caption: ctx.line(LINES.events.whaleLogged, { n }) };
    },
  },
];

// ------------------------------------------------------------ helpers
type Modules = readonly SimModule[];
const catCache = new WeakMap<Modules, DirectorEvent[]>();
export function catalogue(modules: Modules) {
  let list = catCache.get(modules);
  if (!list) {
    list = [...OWN];
    for (const m of modules) if (m.id !== 'events') list.push(...(m.events ?? []));
    const seen = new Set<string>();
    for (const e of list) { if (seen.has(e.id)) throw new Error(`events: duplicate id ${e.id}`); seen.add(e.id); }
    catCache.set(modules, list);
  }
  return list;
}
// The director's pass lists: the catalogue's 'day' and 'tick' entries (chains fire from their parents), in catalogue order.
type Pass = 'day' | 'tick';
const passCache = new WeakMap<Modules, Record<Pass, DirectorEvent[]>>();
function passList(modules: Modules, per: Pass) {
  let lists = passCache.get(modules);
  if (!lists) {
    lists = { day: [], tick: [] };
    for (const ev of catalogue(modules)) if (ev.cls !== 'chain' && ev.cls !== 'delight') lists[ev.per ?? 'day'].push(ev);   // [A] delights: the lane
    passCache.set(modules, lists);
  }
  return lists[per];
}
export const isActive = (s: State, id: string) => s.events.active.some((a) => a.id === id);
export const getActive = (s: State, id: string) => s.events.active.find((a) => a.id === id);
export function activate(s: State, a: EventsActive) { s.events.active = s.events.active.filter((x) => x.id !== a.id); s.events.active.push(a); return a; }
export function deactivate(s: State, id: string) { s.events.active = s.events.active.filter((x) => x.id !== id); }

const yearCount = (s: State, id: string) => s.events.year[id] || 0;
const seenRecent = (s: State, id: string) => (s.events.byYear[s.clock.year]?.[id] || 0) + (s.events.byYear[s.clock.year - 1]?.[id] || 0);

function cooledDown(s: State, ev: DirectorEvent) {
  const L = s.events.last[ev.id];
  if (!L) return true;
  if (ev.cooldownDays && L.y === s.clock.year && s.clock.day - L.d < ev.cooldownDays) return false;
  if (ev.cooldownTicks && L.y === s.clock.year && L.d === s.clock.day && (s.clock.clock1x - L.t) * T.calendar.weekend.ticksPerSecond < ev.cooldownTicks) return false;
  return true;
}
// (a visitor's yearly cap may grow with the farm: capByYear [year 1, year 2, ...], capYear being its largest)
const capOf = (s: State, ev: DirectorEvent) => (ev.capByYear ? ev.capByYear[Math.min(s.clock.year, ev.capByYear.length) - 1] : ev.capYear);
function capped(s: State, ev: DirectorEvent) {
  const cap = capOf(s, ev);
  return (ev.capYear != null && cap != null && yearCount(s, ev.id) >= cap) || (ev.capSeason != null && (s.events.season[ev.id] || 0) >= ev.capSeason);
}

// The §10 spacing rule for random notables at the current moment, in 1x-seconds. With ctx, a year-1 growing day also
// keeps a surprise from landing just before a lesson (design §3: one new thing at a time).
export function spacingOk(s: State, ctx: Ctx) {
  const now = s.clock.clock1x, wk = weekendNow(s);
  const lastN = s.events.lastNotable1x, lastI = s.story.lastIntro1x;
  if (lastN != null && now - lastN < (wk ? E.gap.weekend : E.gap.grow)) return false;
  // [A] a notable keeps the same gap from the last delight (rulings R10: never more than 2 surprises in any 60 s)
  if (s.events.lastDelight1x != null && now - s.events.lastDelight1x < (wk ? E.gap.weekend : E.gap.grow)) return false;
  if (lastI != null && now - lastI < E.afterIntro) return false;
  if (s.clock.year === 1) {                       // year 1: the director only fills gaps between intros
    const last = Math.max(lastN ?? -Infinity, lastI ?? -Infinity);
    if (last > -Infinity && now - last < E.y1Gap) return false;
    if (ctx && s.clock.phase === 'grow' && introNear(s, ctx, T.story.chatterGap1x)) return false;
  }
  return true;
}
export function pityOn(s: State) {
  const since = s.clock.clock1x - (s.events.lastNotable1x ?? 0);
  return since > (weekendNow(s) ? E.pity.weekend : E.pity.grow);
}
// "No event type may exceed 25% of a year's notables": judged against a full year (at least the 13-notable target),
// not the year so far, so a type may repeat early but never more than ~3 times in an ordinary year.
function shareOk(s: State, id: string) {
  const n = yearCount(s, id);
  return n === 0 || n + 1 <= E.maxShare * Math.max(E.target.notablesPerYear[0], s.events.notables + 1);
}

function record(s: State, ev: DirectorEvent) {
  const E2 = s.events, y = s.clock.year;
  E2.last[ev.id] = { y, d: s.clock.day, t: s.clock.clock1x };
  E2.count[ev.id] = (E2.count[ev.id] || 0) + 1;
  E2.year[ev.id] = (E2.year[ev.id] || 0) + 1;
  E2.season[ev.id] = (E2.season[ev.id] || 0) + 1;
  const by = (E2.byYear[y] ||= {});
  by[ev.id] = (by[ev.id] || 0) + 1;
  if (ev.cls === 'notable') { E2.notables++; E2.lastNotable1x = s.clock.clock1x; }
  E2.log.push({ y, d: s.clock.day, m: s.clock.minute, t: s.clock.clock1x, id: ev.id, cls: ev.cls });
  if (E2.log.length > E.logKeep) E2.log.splice(0, E2.log.length - E.logKeep);
}
// The UI toasts this: the entry's text(s), else its LINES.events line. An entry with quiet: true announces itself.
function eventText(s: State, ev: DirectorEvent) {
  if (ev.quiet) return null;
  if (ev.text) return ev.text(s);
  const t = own(LINES.events, ev.id);
  return typeof t === 'string' ? t : null;
}

function fire(s: State, ctx: Ctx, ev: DirectorEvent, data: FireData = {}) {
  record(s, ev);
  ev.fire?.(s, ctx, data);
  if (s.clock.speed > 4 && ev.cls !== 'minor') s.clock.speed = 1;   // Skip stops at a surprise (minors are ambient)
  const a = getActive(s, ev.id);
  ctx.emit({ type: 'event', id: ev.id, cls: ev.cls, urgent: !!ev.urgent, text: eventText(s, ev), x: a?.x, z: a?.z });
}

// Fire a catalogued event right now (chains, scripted teaching events). Respects caps and cooldowns, not spacing.
// (A delight fired this way skips the lane and the moments queue, but still puts up its ✦ pin.)
export function fireNow(s: State, ctx: Ctx, id: string, data: FireData = {}) {
  const ev = catalogue(ctx.modules).find((e) => e.id === id);
  if (!ev || capped(s, ev) || !cooledDown(s, ev)) return false;
  if (ev.cls === 'delight') fireDelight(s, ctx, ev, data);
  else fire(s, ctx, ev, data);
  return true;
}

// One director pass ('day' at each day start, 'tick' each weekend minute). At most one notable per pass.
export function runDirector(s: State, ctx: Ctx, per: Pass) {
  const rng = ctx.rng('events');
  let spaced = null, pity = null, notableFired = false;
  for (const ev of passList(ctx.modules, per)) {
    if ((ev.cooldownDays || ev.cooldownTicks) && !cooledDown(s, ev)) continue;
    if ((ev.capYear != null || ev.capSeason != null) && capped(s, ev)) continue;
    if (!ev.when?.(s, ctx)) continue;
    const notable = ev.cls === 'notable';
    if (notable && !ev.urgent) {
      if (notableFired) continue;
      if ((spaced ??= spacingOk(s, ctx)) === false || !shareOk(s, ev.id)) continue;
    }
    let p = ev.rate?.(s, ctx) ?? 0;
    if (!(p > 0)) continue;
    if (!ev.urgent) {
      if (notable && (pity ??= pityOn(s))) p *= E.pity.mul;
      p *= Math.pow(E.novelty, seenRecent(s, ev.id));
    }
    if (p < 1 && next(rng) >= p) continue;
    fire(s, ctx, ev);
    if (notable) { notableFired = true; spaced = false; }
  }
  if (per === 'day') runLane(s, ctx);
}

// ------------------------------------------------------------ [A] the delight lane (plan §3.1; rulings R2, R4, R10, R19)
// What the player should feel: the Cove notices the farm. Something charming turns up every minute or so of 1x clock in
// year 1 (Biscuit digs up Grandpa's old biscuit tin by 0:20, a seal in pea soup, Pamela in the sun, a possum on a grey day),
// never on top of a lesson or another surprise, never more than two in any minute, and almost always *because* of the
// weather or the farm. A ✦ pin over it says "have a look"; tapping it is a camera moment (ui/mischief.js), leaving it alone
// is always fine. Nothing here ever drops the speed; Skip stops at every delight with a pin.
//
// A delight entry (declared in its owner's `events`; the visitors are in mischief.js):
//   { id, cls: 'delight', per: 'day', needs?: [unlock flags], visit?: true (a visitor: one at a time, s.mischief.visit),
//     when(s, ctx) -> its cause holds today, base?(s, ctx) -> what a slot's fallback still needs (default: true),
//     cause?(s) -> the farm or weather state that caused it today, or null, rate(s, ctx) -> chance a day,
//     cooldownDays?, capYear?, capByYear? ([year 1, year 2, ...]: a cap that grows with the farm), chain? (see chainGapOk),
//     own?: true (a yearly event the lane hosts on its own odds, not its gap: the volunteer vine),
//     fire(s, ctx, data) -> { at: { x, y, z }, label, pin?: false (no ✦: e.g. the catchable swarm's own task pin) },
//     look?(s, ctx, pin) -> { caption?, dialog? } (the ✦ tap; it may say a line or open a bubble), leftAlone?(s, ctx, pin) }
// State: s.events.lastDelight1x, s.events.delights (this year's [{ id, d, t, cause, slot, fallback }]), s.events.slots
// ({ [slot]: { id, d, fallback } | { skipped, d } | { pending: d } }); the ✦ pin is s.mischief.pin.
// Dice are keyed (hash of seed, year, day and id): the lane never moves a stream, so every other system plays the same.
const L = T.lane;
const laneCache = new WeakMap<Modules, DirectorEvent[]>();
function laneList(modules: Modules) {
  let list = laneCache.get(modules);
  if (!list) { list = catalogue(modules).filter((ev) => ev.cls === 'delight'); laneCache.set(modules, list); }
  return list;
}
const delightOf = (ctx: Ctx, id: string | undefined) => laneList(ctx.modules).find((ev) => ev.id === id) || null;
const roll = (s: State, ...k: string[]) => next(makeRng(hash32(s.seed, s.clock.year, s.clock.day, 'lane', ...k)));
const lastSurprise = (s: State) => Math.max(s.events.lastDelight1x ?? -1e9, s.events.lastNotable1x ?? -1e9);
const SLOTS = entries(L.y1.slots).map(([k, [[a, b], ids]]) => ({ k, d0: dayOf(a), d1: dayOf(b), ids }));

// Could the lane put up a delight today? slot: a year-1 slot's delight, which needs only the quiet window (12 s clear of
// lessons and the last moment) and its own shorter gap: it goes before chatter that is waiting (rulings R2).
// A slot's delight goes before chatter that is waiting (Old Moss's tips, tallies, receipts: prio below T.lane.slotYield) but
// makes way for a sowing day, a First, a tape or a note; on the window's last day ('last') it goes first, whatever waits.
// (a moment queued with the slot's own merge key, `slot${k}`, rides with it: Grandpa's first note on Biscuit's dig)
const slotKey = (k: SlotKey) => `slot${k}`;
const waitingAbove = (s: State, prio: number, rider: string | null = null) => s.story.moments.some((m) => m.kind !== 'toast' && m.prio >= prio && (!rider || m.merge !== rider));
export function laneOk(s: State, ctx: Ctx, slot: boolean | 'last' = false, anyGap = false, rider: string | null = null) {
  if (s.clock.phase !== 'grow' || s.clock.hands) return false;
  if (s.story.cards.length || s.story.dialog.some((d) => d.pause) || s.mischief?.pin) return false;
  const quiet = !slot ? quietForChatter(s, ctx) : quietWindow(s, ctx) && (slot === 'last' || !waitingAbove(s, L.slotYield, rider));
  if (!quiet) return false;
  if (anyGap) return true;                                            // (the caller checks each entry's gap: chains)
  // (a slot's gap counts from the last delight: a heat wave's or Quarter Sun Day's toast is the weather's, and notables that
  // aren't urgent already keep the director's gap from delights; it still never crowds a minute, crowdOk)
  if (slot) return s.clock.clock1x - (s.events.lastDelight1x ?? -1e9) >= L.slotGap1x - 1e-9 && crowdOk(s);
  return s.clock.clock1x - lastSurprise(s) >= laneGap(s) - 1e-9 && crowdOk(s);
}
const laneGap = (s: State) => (s.clock.year === 1 ? L.gap1x.y1 : L.gap1x.later);
// Rulings R10, year 1: never more than two surprises in any 60 s. The weather's urgent news (a heat wave, Quarter Sun Day)
// keeps no gap at all, and a slot's delight or the vine's look only a short one, so the lane keeps the rule itself: a delight
// comes only when at most one other surprise came in the last crowd1x. (Years 2+ are spaced by the lane's long gap, and the
// skunks' chain right after a heat wave is the point there.)
const crowdOk = (s: State) => s.clock.year > 1 || s.events.log.reduce((n, e) => n + (e.y === s.clock.year && (e.cls === 'notable' || e.cls === 'delight')
  && s.clock.clock1x - e.t < L.crowd1x - 1e-9 ? 1 : 0), 0) <= 1;
// A chain (the skunks are the heat wave's: chain 'heat_wave') keeps the lane's gap from the last delight only: the notable it
// follows is its cause, not a rival surprise.
const chainGapOk = (s: State, ev: DirectorEvent) => !ev.chain || s.clock.clock1x - (s.events.lastDelight1x ?? -1e9) >= laneGap(s) - 1e-9;
// "No id over 20% of a year's delights", judged against a full year (at least share.of), with a floor of share.floor.
function laneShareOk(s: State, id: string) {
  const n = yearCount(s, id), S = L.share;
  return n + 1 <= Math.max(S.floor, Math.ceil(S.max * Math.max(S.of, s.events.delights.length + 1)));
}
// Can this delight come today? fallback: a slot's last resort, without its weather precondition (base instead of when),
// and never an id already seen this year (rulings R4: no otter waving three times before July).
function eligible(s: State, ctx: Ctx, ev: DirectorEvent, fallback = false) {
  if (!needsMet(s, ev.needs) || capped(s, ev) || (!fallback && !cooledDown(s, ev)) || !laneShareOk(s, ev.id)) return false;
  if (ev.visit && s.mischief?.visit) return false;
  if (fallback) return !yearCount(s, ev.id) && (ev.base ? ev.base(s, ctx) : true);
  return !!ev.when?.(s, ctx);
}
// A year-1 slot opens within the pin's life: a random delight now would still hold the ✦ (or its visitor) when it opens.
function slotSoon(s: State) {
  if (s.clock.year !== 1) return false;
  const d = s.clock.day;
  return SLOTS.some((x) => !s.events.slots[x.k] && x.d0 >= d && realSeconds(d, x.d0) < L.slotHold1x);
}
// A year-1 slot is open, or opens within a chatter gap: Old Moss's tips hold off (plan §3.1: on a slot's days the lane goes
// before chatter), so a tip never takes the quiet window a slot is waiting for.
export function slotNear(s: State) {
  if (s.clock.year !== 1 || s.clock.phase !== 'grow' || !s.events.slots) return false;
  const d = s.clock.day;
  return SLOTS.some((x) => !s.events.slots[x.k] && d <= x.d1 && (d >= x.d0 || realSeconds(d, x.d0) < T.story.chatterGap1x));
}

// Year 1's slots (plan §3.1, §4): in each window the first id whose cause holds fires on the first quiet day; on the last
// day the slot's last id fires without its weather (a fallback); a window that already had a delight is filled; a window
// with no quiet day is skipped and logged. Returns true while a slot owns today (random delights wait).
function slotPass(s: State, ctx: Ctx) {
  const d = s.clock.day, S = s.events.slots;
  for (const x of SLOTS) {
    if (S[x.k] || d < x.d0) continue;
    if (d > x.d1) { skipSlot(s, ctx, x.k, x.d1); continue; }
    const had = s.events.delights.find((e) => e.d >= x.d0 && e.d <= d);
    if (had) { S[x.k] = { id: had.id, d: had.d, filled: true }; continue; }
    // today is the slot's last chance (it goes first, whatever waits; its fallback if nothing has its cause today): its last
    // day; or today's window is open and the slot has waited out its patience for a cause (a sowing day can close the rest
    // of a window without warning: the watering lesson says it's coming); or the window won't reopen in time: a lesson is
    // due tomorrow or so, or a moment is waiting that
    // would take today's window and the next would open after the slot's last day or too near a lesson. A slot is skipped
    // (and logged) only when its last day can't pass.
    const gap = T.story.chatterGap1x, rider = slotKey(x.k), final = d === x.d1;
    const last = final || (quietWindow(s, ctx) && (d >= x.d0 + (x.d1 - x.d0) * (own(L.patience, x.k) ?? L.patience.all) || introNear(s, ctx, gap + secondsPerDay(d))
      || (momentWaiting(s) && (realSeconds(d, x.d1) < gap || introNear(s, ctx, 2 * gap + secondsPerDay(d))))));
    if (!laneOk(s, ctx, last ? 'last' : true, false, rider)) { if (final) skipSlot(s, ctx, x.k, d); return true; }
    for (const id of x.ids) {
      const ev = delightOf(ctx, id);
      if (ev && eligible(s, ctx, ev)) { queueDelight(s, ctx, ev, { slot: x.k }); return true; }
    }
    if (last) {
      const fb = delightOf(ctx, x.ids.at(-1));
      if (fb && eligible(s, ctx, fb, true)) queueDelight(s, ctx, fb, { slot: x.k, fallback: true });
      else skipSlot(s, ctx, x.k, d);
    }
    return true;
  }
  return false;
}
function skipSlot(s: State, ctx: Ctx, k: SlotKey, d: number) { s.events.slots[k] = { skipped: true, d }; ctx.emit({ type: 'lane/skip', slot: k, day: d }); }

// One lane pass a growing morning, after the notables (game.beginDay: then the moments queue shows what it queued).
function runLane(s: State, ctx: Ctx) {
  if (s.clock.phase !== 'grow') return;
  if (s.clock.year === 1 && slotPass(s, ctx)) return;
  if (slotSoon(s) || !laneOk(s, ctx, false, true)) return;
  if (s.clock.year > 1 && s.clock.clock1x < L.first1x) return;      // years 2+: the spring's first visitor waits a little
  const since = s.clock.clock1x - lastSurprise(s), gapOk = since >= laneGap(s) - 1e-9;
  const pity = since > (s.clock.year === 1 ? L.pity1x.y1 : L.pity1x.later);
  if (!crowdOk(s)) return;
  const ready: DirectorEvent[] = [];
  for (const ev of laneList(ctx.modules)) {
    if (!(gapOk || ev.own || (ev.chain && chainGapOk(s, ev))) || !eligible(s, ctx, ev)) continue;
    let p = ev.rate?.(s, ctx) ?? 0;
    if (!(p > 0)) continue;
    if (pity) p *= L.pityMul;
    p *= Math.pow(own(L.regulars, ev.id) ?? L.novelty, seenRecent(s, ev.id));
    if (p < 1 && roll(s, ev.id) >= p) continue;
    ready.push(ev);
  }
  const pick = ready[Math.floor(roll(s, 'pick') * ready.length)];
  if (pick) queueDelight(s, ctx, pick, {});
}

// A delight goes through the moments queue (rulings R2) at the highest prio: the window is open, so it shows this morning.
function queueDelight(s: State, ctx: Ctx, ev: DirectorEvent, { slot = null, fallback = false }: { slot?: SlotKey | null; fallback?: boolean }) {
  // (a fallback carries its cause only if its own cause() holds today: each cause() checks its weather or farm state)
  const cause = ev.cause?.(s) ?? null;
  const m = ctx.moment({ id: `delight:${ev.id}`, kind: 'delight', handler: 'delight', maxWaitDays: 0, stop: true,
    merge: slot ? slotKey(slot) : null, data: { id: ev.id, slot, fallback, cause } });
  if (m && slot) {
    s.events.slots[slot] = { pending: s.clock.day };
    // its riders queued on an earlier day of the window join its beat (moments merge only within a day)
    const q = s.story.moments, key = slotKey(slot);
    for (const r of q.filter((x) => x !== m && x.merge === key)) { m.with.push(r, ...r.with); r.with = []; m.prio = Math.max(m.prio, r.prio); }
    s.story.moments = q.filter((x) => x === m || x.merge !== key);
  }
  return m;
}
// The delight arrives: logged (cadence, novelty, the share cap, the year's caused share), its owner sets the scene (a visitor
// walks on), and its ✦ pin goes up for T.lane.pinLife1x of 1x clock. Skip stops on the out-event (pin: true).
export function fireDelight(s: State, ctx: Ctx, ev: DirectorEvent, data: FireData = {}) {
  const E2 = s.events, now = s.clock.clock1x;
  record(s, ev);
  E2.lastDelight1x = now;
  const cause = data.cause !== undefined ? data.cause : ev.cause?.(s) ?? null;
  E2.delights.push({ id: ev.id, d: s.clock.day, t: now, cause, slot: data.slot ?? null, fallback: !!data.fallback });
  if (data.slot) E2.slots[data.slot] = { id: ev.id, d: s.clock.day, fallback: !!data.fallback };
  const r: DelightShown = ev.fire?.(s, ctx, data) ?? {};
  const at = r.at || null;
  if (r.pin !== false && at && s.mischief) s.mischief.pin = { id: ev.id, x: at.x, y: at.y ?? 0.6, z: at.z, label: r.label || '', until1x: now + L.pinLife1x };
  if (s.clock.speed > 4) s.clock.speed = 1;                          // Skip stops at a surprise
  ctx.emit({ type: 'event', id: ev.id, cls: 'delight', pin: r.pin !== false || !!r.taskPin, text: eventText(s, ev), x: at?.x, z: at?.z, cause, slot: data.slot ?? null, fallback: !!data.fallback });
}
// The ✦ pin's life ran out untapped: its "left alone" outcome (always fine).
function pinExpiry(s: State, ctx: Ctx) {
  const pin = s.mischief?.pin;
  if (!pin || s.clock.clock1x < pin.until1x - 1e-9) return;
  s.mischief.pin = null;
  delightOf(ctx, pin.id)?.leftAlone?.(s, ctx, pin);
}
const laneInit = (s: State) => Object.assign(s.events, { lastDelight1x: -1e9, delights: [], slots: {} });

export default {
  id: 'events',
  init(s: State) {
    s.events = { last: {}, count: {}, year: {}, season: {}, byYear: {}, notables: 0, lastNotable1x: null, active: [], log: [], logbook: {},
      lastDelight1x: -1e9, delights: [], slots: {} };
  },
  newYear(s: State) {
    const E2 = s.events;
    Object.assign(E2, { year: {}, season: {}, notables: 0, lastNotable1x: null, active: [] });
    for (const y of Object.keys(E2.byYear)) if (+y < s.clock.year - 2) delete E2.byYear[y];
    laneInit(s);
  },
  phase(s: State, ctx, from, to) {
    if (to === 'october') s.events.season = {};
    if (from === 'grow' && s.mischief?.pin) { const pin = s.mischief.pin; s.mischief.pin = null; delightOf(ctx, pin.id)?.leftAlone?.(s, ctx, pin); }
  },
  dayStart(s: State, ctx) {
    s.events.active = s.events.active.filter((a) => a.until == null || a.until >= s.clock.day);
    if (s.events.delights == null) laneInit(s);                      // (a v3 save mid-migration, or a test's bare state)
    pinExpiry(s, ctx);
  },
  moments: {
    // the lane's queued delight (kind 'delight'): it arrives now
    delight: {
      run(s, ctx, m) { const ev = delightOf(ctx, m.data.id); if (ev) fireDelight(s, ctx, ev, { slot: m.data.slot, fallback: m.data.fallback, cause: m.data.cause }); },
      drop(s, _ctx, m) { const k = m.data.slot, slot = k && s.events.slots[k]; if (k && slot && 'pending' in slot) delete s.events.slots[k]; },   // the slot tries again
    },
  },
  actions: {
    'events/tap': (s, a, ctx) => {
      const act = getActive(s, a.id);
      if (!act) return { ok: false, reason: 'nothing there any more' };
      const ev = catalogue(ctx.modules).find((e) => e.id === a.id);
      deactivate(s, a.id);
      ev?.tap?.(s, ctx, act, a);
      return { ok: true };
    },
  },
} satisfies SimModule;
