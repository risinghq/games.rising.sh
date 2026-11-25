// The game core (architecture §3.4): state creation, the module registry and hook order, ctx, dispatch, the clock
// (day steps, weekend ticks, the real-time app clock with speed rules), phases and the Game wrapper.
//
// Phases: newgame -> grow (Apr 1 - Sep 30, day steps) -> october (sub: weekday | weekend | card) -> weighoff (eve of
// Oct 25 and Oct 26, beat-driven) -> halloween (beat-driven) -> winter (menus) -> winter/beginYear -> grow ...
// Core out-events: { type: 'day', day }, { type: 'dayEnd', day }, { type: 'phase', from, to }, { type: 'unlock', flag },
// { type: 'alert', id, threat, text?, cls?, speaker?, kind? }, { type: 'meta' } (new-farm details changed).
//
// [foundation] growing-year seams (plan §6.0, §6.1; contract in docs/architecture.md §3.3-§3.4):
//   - modules may declare after: { '<action type>': (s, a, res, ctx) => void }, run in module order after any successful action
//   - only threats drop the speed (alert, T.clock.threats); Skip also stops on out-events that ask it to (stopsSkip)
//   - a hands-on close-up holds the clock (s.clock.hands, hands/open | hands/close; transient: always saved as null)
//   - clock/skip { to } skips at most to that day (the Next-stop chip's target)
import { T } from './tuning.js';
import cal, { dayOf, isWeekend, secondsPerDay, OPEN, CLOSE, EVE } from './calendar.js';
import * as layout from './layout.js';
import { makeRng } from './rng.js';
import { hash32 } from './util.js';
import { NS, MODULES } from './modules.js';
import * as story from './story.js';
import { runDirector } from './events.js';
import { money } from './economy.js';
import { SAVE_VERSION } from './save.js';

// `chatter` is flavour only (Old Moss's tips): when a line lands moves with the dialogue's timing, and must never move the
// giant's or the weather's dice
export const STREAMS = ['weather', 'crowd', 'patch', 'giant', 'genetics', 'events', 'rivals', 'misc', 'chatter'];
export const BEAT_PHASES = new Set(['newgame', 'weighoff', 'halloween', 'winter']);
const OCT1 = dayOf('Oct 1');
const EVE_MINUTE = 1260;                        // 9 pm on Sun Oct 25
const r3 = (x) => Math.round(x * 1000) / 1000;
const r6 = (x) => Math.round(x * 1e6) / 1e6;     // weekend ticks are 1/6 s: kept fine, then squared to r3 at day end
const ok = { ok: true };
const fail = (reason) => ({ ok: false, reason });
const clean = (x, n) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// The modules that implement each hook, in list order. The clock calls these every day and every weekend minute: walking
// only the modules that have the hook keeps each call site monomorphic (and skips ten optional calls a minute).
const HOOKS = Object.fromEntries(['dayStart', 'dayEnd', 'tick', 'phase'].map((h) => [h, MODULES.filter((m) => typeof m[h] === 'function')]));
// Out-events that end a Skip (plan §2.1): a Road stop reached (a planned row went in), a delight that puts up a ✦ pin, a BIG
// first, and anything that says stop: true (a moment with stop, for one). Cards, beats, threats and notables stop it too.
export const stopsSkip = (ev) => ev.stop === true || ev.type === 'road' || (ev.type === 'event' && ev.cls === 'delight' && !!ev.pin)
  || (ev.type === 'first' && !!ev.big);

// Streams are reseeded every year from hash(seed, year, name): weather, crowd arrivals and rivals never depend on
// what the player did, which gives common random numbers for bot A/B tests and stops save-scumming the reveal.
function reseed(s) { for (const n of STREAMS) s.rng[n] = makeRng(hash32(s.seed, s.clock.year, n)); }

// ------------------------------------------------------------ ctx
export function makeCtx(s, out = []) {
  const ctx = {
    T, cal, layout, modules: MODULES, out,
    rng: (name) => s.rng[name] || (s.rng[name] = makeRng(hash32(s.seed, s.clock.year, name))),
    emit: (ev) => { out.push(ev); if (s.clock.speed > 4 && stopsSkip(ev)) s.clock.speed = 1; },
    say: (speaker, lines, opts) => story.say(s, ctx, speaker, lines, opts),
    card: (kind, data) => story.card(s, ctx, kind, data),
    goal: (id, text, target, opts) => story.goal(s, ctx, id, text, target, opts),
    goalDone: (id) => story.goalDone(s, ctx, id),
    goalLapse: (id, line) => story.goalLapse(s, ctx, id, line),
    story: (id, score, vars) => story.log(s, ctx, id, score, vars),
    money: (delta, cat) => money(s, ctx, delta, cat),
    unlock: (flag) => { if (!s.unlocks[flag]) { s.unlocks[flag] = true; out.push({ type: 'unlock', flag }); } },
    mod: (id) => NS[id],
    // additions to the §3.3 list: templated lines, alerts (auto-slow), phase changes, scripted-intro spacing
    line: (str, vars) => story.line(s, str, vars),
    alert: (id, opts) => alert(s, ctx, id, opts),
    setPhase: (to) => setPhase(s, ctx, to),
    markIntro: () => story.markIntro(s),
    // [foundation] the growing-year helpers (story.js): the moments queue, receipts, stamps, no-repeat line picks
    moment: (m) => story.moment(s, ctx, m),
    receipt: (r) => story.receipt(s, ctx, r),
    stamp: (id) => story.stamp(s, ctx, id),
    fresh: (key, list, rng = 'chatter') => story.fresh(s, typeof rng === 'string' ? ctx.rng(rng) : rng, key, list),
  };
  return ctx;
}

// An alert (thirsty patch, bugs, creak, heat-wave forecast, kelp, swarm) is news with a sound. Only a threat drops the speed
// to 1x so the player can react (plan §2.3): T.clock.threats lists them (a heat warning, a creak, the year's first bug
// cluster, the first THIRSTY of a dry spell...); tinLow, honeyFull, kelp and the rest keep the speed. An alert may say
// { threat: true | false } itself, and { calm: true } never slows. Settings can turn the slow-down off for creaks.
export function isThreat(s, id, opts = {}) {
  if (opts.calm) return false;
  if (opts.threat != null) return !!opts.threat;
  const rule = T.clock.threats[opts.kind === 'creak' ? 'creak' : id];
  if (rule == null) return false;
  if (rule === 0) return true;
  const last = s.story.alerts?.[id];
  if (!last || last[0] !== s.clock.year) return true;
  return rule !== 'year' && s.clock.day - last[1] >= rule;
}
function alert(s, ctx, id, opts = {}) {
  const threat = isThreat(s, id, opts);
  ctx.emit({ type: 'alert', id, ...opts, threat });
  (s.story.alerts ||= {})[id] = [s.clock.year, s.clock.day];
  const creak = opts.kind === 'creak' || id === 'creak';
  if (threat && s.clock.speed > 1 && !(creak && !s.prefs.autoSlowCreaks)) s.clock.speed = 1;
}

// ------------------------------------------------------------ creation
export function createGame({ seed = 1, species = 'possum', surname, farmName } = {}) {
  seed = (Number(seed) >>> 0) || 1;
  const s = {
    v: SAVE_VERSION, seed,
    meta: { species: story.SPECIES[species] ? species : 'possum', surname: clean(surname, 18) || story.SURNAMES[seed % story.SURNAMES.length],
      farmName: clean(farmName, 32) || story.DEFAULT_FARM, firstPlay: true },
    rng: {},
    clock: { year: 1, day: 0, minute: 0, phase: 'newgame', sub: null, speed: 1, prevSpeed: 1, dayFrac: 0, clock1x: 0, acc: 0, skipTo: null, hands: null },
    rep: { R: T.season.R.start, buzz: 0 },
    unlocks: {},
    prefs: { autoSlowCreaks: true, relaxedRegister: false },  // sim-relevant settings (the UI mirrors them)
  };
  reseed(s);
  const ctx = makeCtx(s);
  for (const m of MODULES) m.init?.(s, ctx);
  return s;
}
// createGame + the new-farm flow's "start" in one go (tests, bots, ?new).
export function startGame(opts) { const s = createGame(opts); dispatch(s, { type: 'newgame/start' }); return s; }

// ------------------------------------------------------------ speed rules (design §2)
export function speedRules(s) {
  const c = s.clock;
  if (c.phase === 'grow') return { speeds: T.clock.speeds.grow, skip: true };
  if (c.phase === 'october') return isWeekend(c.day) ? { speeds: T.clock.speeds.weekend, skip: false } : { speeds: T.clock.speeds.weekday, skip: true };
  return { speeds: [], skip: false };
}
function syncSub(s) {
  const c = s.clock;
  c.sub = c.phase !== 'october' ? null : s.story.cards.length ? 'card' : isWeekend(c.day) ? 'weekend' : 'weekday';
  const r = speedRules(s);
  if (!r.speeds.length) return;
  if (c.speed === T.clock.skip) { if (!r.skip) c.speed = 1; }
  else if (!r.speeds.includes(c.speed)) c.speed = Math.max(...r.speeds.filter((v) => v <= c.speed));
}

// ------------------------------------------------------------ phases and the day cycle
function setPhase(s, ctx, to) {
  const from = s.clock.phase;
  if (from === to) return;
  s.clock.phase = to;
  if (s.clock.speed > 4) s.clock.speed = 1;      // Skip stops at a phase start
  for (const m of HOOKS.phase) m.phase(s, ctx, from, to);
  syncSub(s);
  ctx.emit({ type: 'phase', from, to });
}

function beginDay(s, ctx) {
  const c = s.clock;
  c.dayFrac = 0; c.acc = 0;
  c.minute = c.phase === 'october' && isWeekend(c.day) ? OPEN : 0;
  syncSub(s);
  // a Skip with a target (the Next-stop chip) ends on its day; a target outlives no Skip
  if (c.skipTo != null && (c.speed <= 4 || c.day >= c.skipTo)) { if (c.speed > 4) c.speed = 1; c.skipTo = null; }
  for (const m of HOOKS.dayStart) m.dayStart(s, ctx);
  ctx.emit({ type: 'day', day: c.day });
  story.runBeats(s, ctx);
  runDirector(s, ctx, 'day');
  story.runMoments(s, ctx);
}

function endDay(s, ctx) {
  const c = s.clock;
  for (const m of HOOKS.dayEnd) m.dayEnd(s, ctx);
  if (!(c.phase === 'october' && isWeekend(c.day))) c.clock1x = r3(c.clock1x + secondsPerDay(c.day));
  else c.clock1x = r3(c.clock1x);                 // weekend ticks already counted (drift-free: 480 x 1/6 s is 80 s)
  ctx.emit({ type: 'dayEnd', day: c.day });
  if (c.phase === 'october' && c.day >= EVE) {    // W4 Sunday closes: the eve of the weigh-off
    c.minute = EVE_MINUTE; c.dayFrac = 0;
    setPhase(s, ctx, 'weighoff');
    return;
  }
  c.day++;
  if (c.phase === 'grow' && c.day >= OCT1) setPhase(s, ctx, 'october');
  beginDay(s, ctx);
}

function stepTick(s, ctx) {
  const c = s.clock;
  for (const m of HOOKS.tick) m.tick(s, ctx);
  story.runBeats(s, ctx);
  runDirector(s, ctx, 'tick');
  if (s.story.moments.length) story.runMoments(s, ctx);
  c.minute++;
  c.clock1x = r6(c.clock1x + cal.tickSeconds);
  if (c.minute >= CLOSE) endDay(s, ctx);
}

function beginYear(s, ctx) {
  const c = s.clock;
  Object.assign(c, { year: c.year + 1, day: 0, minute: 0, dayFrac: 0, clock1x: 0, acc: 0, speed: 1, prevSpeed: 1 });
  s.meta.firstPlay = false;
  reseed(s);
  for (const m of MODULES) m.newYear?.(s, ctx);
  setPhase(s, ctx, 'grow');
  beginDay(s, ctx);
}

// ------------------------------------------------------------ the clock
export const isBlocked = (s) => s.story.cards.length > 0 || BEAT_PHASES.has(s.clock.phase);
// An intro's dialogue holds the real-time clock until it is read, and so does a hands-on close-up while it is open (bots and
// advanceDays ignore both).
export const isHeld = (s) => !!s.clock.hands || s.story.dialog.some((d) => d.pause);
const weekendDay = (s) => s.clock.phase === 'october' && isWeekend(s.clock.day);
const dayStepping = (s) => s.clock.phase === 'grow' || (s.clock.phase === 'october' && !isWeekend(s.clock.day));

// Non-weekend days only; stops early at a blocking card, a phase boundary or the start of a weekend day.
export function advanceDays(s, n = 1) {
  const out = [], ctx = makeCtx(s, out);
  for (let i = 0; i < n; i++) {
    if (isBlocked(s) || !dayStepping(s)) break;
    const ph = s.clock.phase;
    endDay(s, ctx);
    if (s.clock.phase !== ph || !dayStepping(s)) break;
  }
  syncSub(s);
  return out;
}

// Weekend minutes only; stops early at a blocking card or when the day ends.
export function advanceTicks(s, n = 1) {
  const out = [], ctx = makeCtx(s, out);
  for (let i = 0; i < n; i++) {
    if (isBlocked(s) || !weekendDay(s)) break;
    const d = s.clock.day;
    stepTick(s, ctx);
    if (s.clock.day !== d || s.clock.phase !== 'october') break;
  }
  syncSub(s);
  return out;
}

// The app clock: spends realDt x speed 1x-seconds on day steps (calendar.secondsPerDay) or weekend ticks
// (6 per second). Stops at blockers, held dialogue, and whenever the speed or phase changes mid-frame.
export function tickReal(s, realDt) {
  const out = [];
  const c = s.clock;
  if (!(realDt > 0) || c.speed === 0 || isBlocked(s) || isHeld(s)) return out;
  const ctx = makeCtx(s, out);
  let budget = Math.min(realDt, 1) * c.speed;
  for (let guard = 0; budget > 1e-9 && guard < 20000; guard++) {
    if (isBlocked(s) || isHeld(s) || c.speed === 0) break;
    const speed = c.speed, phase = c.phase;
    if (weekendDay(s)) {
      const need = (1 - c.acc) / cal.TICKS_PER_SECOND;
      if (budget < need) { c.acc += budget * cal.TICKS_PER_SECOND; break; }
      budget -= need; c.acc = 0;
      stepTick(s, ctx);
    } else if (dayStepping(s)) {
      const spd = secondsPerDay(c.day), need = (1 - c.dayFrac) * spd;
      if (budget < need) { c.dayFrac += budget / spd; break; }
      budget -= need;
      endDay(s, ctx);
    } else break;
    if (c.speed !== speed || c.phase !== phase) break;
  }
  syncSub(s);
  return out;
}

// ------------------------------------------------------------ actions
const CORE = {
  'clock/speed': (s, a) => {
    if (!speedRules(s).speeds.includes(a.speed)) return fail('that speed is not available now');
    s.clock.speed = a.speed;
    if (a.speed) s.clock.prevSpeed = a.speed;
    return ok;
  },
  'clock/pause': (s, a) => {
    const c = s.clock, paused = c.speed === 0;
    if (a.on === false || (a.on == null && paused)) {
      if (!paused) return ok;
      const r = speedRules(s).speeds;
      c.speed = r.includes(c.prevSpeed) ? c.prevSpeed : 1;
    } else if (!paused) { c.prevSpeed = c.speed === T.clock.skip ? 1 : c.speed; c.speed = 0; }
    return ok;
  },
  // { to }: a day to stop at even if nothing else stops it first (the Next-stop chip's stop); without it, the next thing
  'clock/skip': (s, a) => {
    if (!speedRules(s).skip) return fail('Skip is not available now');
    s.clock.speed = T.clock.skip;
    s.clock.skipTo = Number.isFinite(a.to) && a.to > s.clock.day ? a.to : null;
    return ok;
  },
  // [foundation] a hands-on close-up (track E's layer): the clock holds and lessons wait while it is open. The verb's own
  // action (patch/hunt, giant/start) is dispatched before hands/close.
  'hands/open': (s, a) => {
    if (s.clock.hands) return fail('a close-up is already open');
    if (isBlocked(s) || !(s.clock.phase === 'grow' || s.clock.phase === 'october')) return fail('not now');
    s.clock.hands = { verb: String(a.verb || 'hands'), at: s.clock.clock1x };
    return ok;
  },
  'hands/close': (s) => {
    if (!s.clock.hands) return fail('no close-up is open');
    s.clock.hands = null;
    return ok;
  },
  'newgame/set': (s, a, ctx) => {
    if (s.clock.phase !== 'newgame') return fail('the farm is already set up');
    if (a.species != null) { if (!story.SPECIES[a.species]) return fail('unknown species'); s.meta.species = a.species; }
    if (a.surname != null) s.meta.surname = clean(a.surname, 18) || s.meta.surname;
    if (a.farmName != null) s.meta.farmName = clean(a.farmName, 32) || story.DEFAULT_FARM;
    ctx.emit({ type: 'meta' });
    return ok;
  },
  'newgame/start': (s, a, ctx) => {
    if (s.clock.phase !== 'newgame') return fail('already started');
    setPhase(s, ctx, 'grow');
    beginDay(s, ctx);
    return ok;
  },
  'winter/beginYear': (s, a, ctx) => {
    if (s.clock.phase !== 'winter') return fail('not winter yet');
    beginYear(s, ctx);
    return ok;
  },
  'prefs/set': (s, a) => {
    if (!(a.key in s.prefs)) return fail('unknown setting');
    s.prefs[a.key] = !!a.value;
    return ok;
  },
};
const HANDLERS = { ...CORE };
for (const m of MODULES) for (const [type, h] of Object.entries(m.actions || {})) {
  if (HANDLERS[type]) throw new Error(`game: action ${type} declared twice`);
  HANDLERS[type] = h;
}
export const ACTIONS = Object.keys(HANDLERS);

// Apply one player (or bot) action. Never throws on bad input: returns { ok: false, reason }.
export function dispatch(s, a) {
  const out = [];
  const h = a && HANDLERS[a.type];
  if (!h) return { ok: false, reason: `unknown action ${a?.type}`, events: out };
  const ctx = makeCtx(s, out);
  const r = h(s, a, ctx) || ok;
  if (r.ok) {
    // after hooks, in module order (D's Firsts listen to card/answer and giant/measure, A's startle to world/poke)
    for (const m of MODULES) m.after?.[a.type]?.(s, a, r, ctx);
    story.runBeats(s, ctx);                        // an action can make a beat due ("first time the patch is dry")
  }
  syncSub(s);
  return { ...r, events: out };
}

// ------------------------------------------------------------ the wrapper the app uses
export class Game {
  constructor(s) { this.s = s; this.queue = []; this.subs = new Map(); }
  _push(evs) { for (const e of evs) this.queue.push(e); return evs; }
  dispatch(a) { const r = dispatch(this.s, a); this._push(r.events); return r; }
  tickReal(dt) { return this._push(tickReal(this.s, dt)); }
  advanceDays(n) { return this._push(advanceDays(this.s, n)); }
  advanceTicks(n) { return this._push(advanceTicks(this.s, n)); }
  // Hand out everything that happened since the last drain, calling on() subscribers in order.
  drain() {
    const evs = this.queue;
    this.queue = [];
    for (const ev of evs) for (const key of [ev.type, '*']) for (const fn of this.subs.get(key) || []) fn(ev, this);
    return evs;
  }
  on(type, fn) {
    if (!this.subs.has(type)) this.subs.set(type, []);
    this.subs.get(type).push(fn);
    return () => this.subs.set(type, this.subs.get(type).filter((f) => f !== fn));
  }
  get blocked() { return isBlocked(this.s); }
}
