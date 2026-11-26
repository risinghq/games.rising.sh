// The weigh-off (design §8): the climax of every year, on the farm's Q.S.C. Official Scale, Mon Oct 26.
//
// What the player should feel at each step (design §13), and what makes it so:
//   The eve (Y1)       a smile and a shiver: giggles in the corn, the glint of a mask; next morning, tiny footprints.
//   Night Watch (Y2+)  comic dread: 8 pairs of eyes, 1.4 s each (1.1 from Y4). Two misses are free, then scratches,
//                      then the painted mustache at 6+. Floodlights, Officer Mavis and Biscuit take some of the load.
//   Dawn               "it's here": the rivals' giants roll in on pallets with their boasts on placards.
//   The Weighmaster    the year's surprise. Never seen before this morning: Marlene rolls in over the empty scale, he
//                      plops down inside her, she lifts, the crowd gasps. Deadpan: "I am the Weighmaster."
//   HEAVE              nervous laughter, teamwork: 4 beats on a shrinking ring, the crowd chants. Decent timing risks
//                      under 1% of a crack, sloppy timing ~6%; a scuff costs a Prettiest mark. Mavis plays dead (+1 beat).
//   Inspection         dread: the flashlight finds the crack you treated (or didn't). PASS, or EXHIBITION ONLY.
//   Prettiest          a warm-up you can win: Vale is the favourite; Grandpa's line wins ~15-20% in year 1.
//   Heaviest           suspense: ascending published estimates (Big Tom's +20% boast puts him late), raccoons first,
//                      Hoot last by lantern. Your own reveal is never skippable: the card read, the slot-machine digits,
//                      the crowd chanting each hundred, the slow crawl past the chart. "I yelled at my phone."
//   Heavy / light      the sun breaks through, or the fog rolls in: "what made her light?" (kelp vs Heavy water).
//   Results            pride or a vow: prizes, Personal Best, the Cove record (1,612 lb, Vance Sr., 1987), the verdict.
//   The numbers (tests/balance/weighoff.test.js): Balanced wins Heaviest 8-20% in Y1 rising to 30-55%; the reveal changes
//   your place vs estimate order in >= 25% of weigh-offs; the last two weigh-ins decide your place >= 40% of the time.
//
// Everything random about the rivals comes from the 'rivals' stream, drawn at the start of each year in a fixed order,
// so results never depend on player actions (the rubber band, +6% for the rival you beat last year, is narrative).
// The true weights are fixed long before the eve; the weigh-off reveals them, it never rolls them.
//
// s.weighoff = {
//   year, stage ('eve'|'watch'|'dawn'|'arrive'|'lift'|'inspect'|'pretty'|'heavy'|'results'), i (step index),
//   steps: [{ k: 'eve'|'watch'|'dawn'|'arrive'|'welcome'|'lift'|'inspect'|'pretty'|'weigh'|'results', done?, ...data }],
//   entries: [{ id, you, plot?, name, grower, farm, species, est (published, null = won't say), sortEst, gag?, W?, chart?,
//     dq, exhibition?, weighed, pct?, beauty?, pallet }], order: [entry ids, weigh-in order],
//   rivals: { [id]: { W, chart, est, dq, show, gag, name, vows } } (this year's field, rolled on Apr 1; W stays hidden
//     from the UI until that entry is weighed), rolls: { heist, swarm }, heist: bool,
//   pretty: { judges, board: [{ id, cards, total }], place } | null, results: { ... } | null,
//   lines: { [rivalId]: { W, year } } (the Grange names lines by these), history: [{ year, place, W, ... }],
//   best: { W, year, name } | null, record: { W, who, year, you? }, vows: rivalId | null, forklift: year offered }
// Actions: weighoff/next, weighoff/watch { hits: [pair index] }, weighoff/heave { plot, beats: ['perfect'|'good'|'wobble'] },
//   weighoff/skipRivals (from Y2). Cards: forklift (Y2+ September prep).
// Out-events: weighoff/stage { stage, step }, weighoff/watched { misses, scratches, mustache }, weighoff/heaved { plot,
//   grades, scuff, crack }, weighoff/inspected { plot, pass }, weighoff/weighed { id }, weighoff/results { place, total }.
// Cross-slice helpers: crierBoasts(s), heistInterest(s), current(s), entryOf(s, id), judgesFor(year), rivalField(s),
//   rankOf(entries), places(s) (see each for its signature).
import { T, RIVAL_IDS, isRivalId, rivalOf } from './tuning.js';
import type { RivalId } from './tuning.js';
import { WEIGHOFF, dayOf, isWeekend } from './calendar.js';
import { makeRng, next, gauss, chance, pick } from './rng.js';
import type { Rng } from './rng.js';
import { hash32, clamp, round3, own, tabulate } from './util.js';
import { LINES, line, runBeats } from './story.js';
import { has, blocker, CATALOGUE } from './economy.js';
import { fireNow, deactivate, isActive } from './events.js';
import * as giant from './giant.js';
import * as gen from './genetics.js';
import type { SimModule, State, Ctx, Policy, SayOpts, ActionHandlers } from './types.js';
import type {
  Grade, LiftResult, Prize, Standing, WatchPair, WatchResult, WeighoffEntry, WeighoffPrettyBoard, WeighoffRival,
  WeighoffStep, WeighoffStepOf,
} from './state.js';

const WO = T.weighoff, RV = T.rivals, PZ = T.prizes, L = LINES.wo, NW = WO.nightWatch, LF = WO.lift;
export const RIVALS = RIVAL_IDS;
export const STAGES = ['eve', 'watch', 'dawn', 'arrive', 'lift', 'inspect', 'pretty', 'heavy', 'results'];
const STAGE_OF = { eve: 'eve', watch: 'watch', dawn: 'dawn', arrive: 'arrive', welcome: 'arrive', lift: 'lift', inspect: 'inspect',
  pretty: 'pretty', weigh: 'heavy', results: 'results' } satisfies Record<WeighoffStep['k'], string>;
const fail = (reason: string) => ({ ok: false, reason });
const wordsOf = (n: number) => ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'][n] ?? String(n);
const commas = gen.commas;
// a private stream for cosmetic draws (judges' cards, the Night Watch layout): never shifts anybody's rolls
const hrng = (s: State, ...k: string[]) => makeRng(hash32(s.seed, s.clock.year, 'weighoff', ...k));

// The raccoons' disguise for a year: one line per year to the fourth, then the fourth stays.
const gagLine = (year: number) => [L.gag[1], L.gag[2], L.gag[3], L.gag[4]][Math.min(year, 4) - 1] ?? L.gag[4];
const gagW = (year: number) => [WO.gag.W[1], WO.gag.W[2], WO.gag.W[3], WO.gag.W[4]][Math.min(year, 4) - 1] ?? WO.gag.W[4];

/** An entry that has been weighed: its weight is set. */
export type Weighed = WeighoffEntry & { W: number };
const isWeighed = (e: WeighoffEntry): e is Weighed => e.weighed && e.W !== undefined;

// ------------------------------------------------------------ the rivals' year (rolled on Apr 1 from the 'rivals' stream)
// W = W0 (1 + g)^(y - 1) exp(N(0, sd)); their own tape reads ~4.5% either side; published = chart x (1 + boast).
// Every rival gets the same five draws every year, attending or not, so the stream never shifts.
// `vowed` is the rival you beat last year: +6% (the rubber band).
function rollYear(s: State, ctx: Ctx, vowed: RivalId | null) {
  const r = ctx.rng('rivals'), y = s.clock.year;
  const rivals = tabulate(RIVALS, (id): WeighoffRival => {
    const R = RV[id], z = gauss(r), zt = gauss(r), uDq = next(r), uShow = next(r), zp = gauss(r);
    const legit = !R.gag || y >= (R.legitFromYear ?? Infinity);
    let W: number, show = true, dq = uDq < R.dq;
    if (R.gag && !legit) { W = gagW(y); dq = true; }
    else if (R.gag) W = R.W0 * (1 + R.g) ** (y - (R.legitFromYear ?? 0)) * Math.exp(R.sd * z);
    else W = R.W0 * (1 + R.g) ** (y - 1) * Math.exp(R.sd * z);
    const vows = vowed === id;
    if (vows) W *= 1 + RV.rubberBand;
    if (R.noShow) show = uShow >= R.noShow;
    if (R.fromYear) show = y >= R.fromYear && uShow < (R.attends ?? 1);
    W = Math.round(W);
    const chart = Math.round(W / (1 + WO.rivalTape * zt));
    const est = !legit ? null : R.boast === null ? null : Math.round(chart * (1 + (R.boast ?? 0)));
    return { id, W, chart, est, dq, show, gag: !legit, vows, pretty: zp, name: pick(hrng(s, 'name', id), L.giantNames[id]) };
  });
  return { rivals, rolls: { heist: next(r), swarm: next(r) } };
}
// The rivals attending this year (the gag raccoons always come; Mavis may not; Lindqvist only when the ferry runs).
export const rivalField = (s: State) => RIVALS.flatMap((id) => {
  const r = s.weighoff.rivals[id];
  return r.show ? [r] : [];
});

// The September Crier's boasts (giant.js asks for these): Big Tom +20%, Vance accurate, Hoot +5%, Mavis won't say,
// Vale -5%, and Ingrid Lindqvist when she is coming. [{ id, name, est }]
export function crierBoasts(s: State) {
  const f = s.weighoff.rivals, order = ['tom', 'vance', 'hoot', 'mavis', 'vale', 'lindqvist'] satisfies RivalId[];
  return order.flatMap((id) => {
    const r = f[id];
    return r.show && !r.gag ? [{ id, name: RV[id].name, est: r.est }] : [];
  });
}
// Heist interest (design §8): 0.3 + 0.3 told the Crier + 0.2 fish + 0.2 your estimate is top 2. The chance the crew comes.
export function heistInterest(s: State) {
  const I = NW.interest, mine = giant.entries(s).map((p) => giant.publishedEstimate(s, p));
  const theirs = rivalField(s).filter((x) => !x.gag).flatMap((x) => (x.est !== null && x.est > 0 ? [x.est] : []));
  const best = Math.max(0, ...mine), top2 = mine.length > 0 && theirs.filter((e) => e > best).length < 2;
  return round3(I.base + giant.heistInterest(s) + (top2 ? I.top2 : 0));
}

// ------------------------------------------------------------ helpers the UI and render read
export const current = (s: State): WeighoffStep | null => s.weighoff.steps[s.weighoff.i] ?? null;
export const entryOf = (s: State, id: string | undefined) => s.weighoff.entries.find((e) => e.id === id) ?? null;
const plantOfEntry = (s: State, e: WeighoffEntry | null) => (e?.you ? giant.plantOf(s, e.plot) : null);
// The id of the day's physically heaviest pumpkin (DQ'd or not, the gag aside), known before anything is weighed: the
// rivals' weights are rolled when the field is drawn and yours is the giant's true weight. The UI's spectator uses it.
export function heaviestId(s: State) {
  let best: string | null = null, bw = 0;
  for (const e of s.weighoff.entries) {
    if (e.gag) continue;
    const p = plantOfEntry(s, e);
    const w = e.you ? (p ? giant.trueWeight(s, p) : 0) : own(s.weighoff.rivals, e.id)?.W ?? 0;
    if (w > bw) { bw = w; best = e.id; }
  }
  return best;
}
// Judges for a year: Mayor (colour), Edna (tall), Sasha (even); from year 3 a guest takes one seat (Old Moss, the
// chaos judge, in odd years; Augustus Vance, the stem man, in even ones), rotating which seat.
export function judgesFor(year: number) {
  const J = ['mayor', 'edna', 'sasha'];
  if (year < WO.pretty.judges.guestFromYear) return J;
  const seat = ['sasha', 'mayor', 'edna'][(year - WO.pretty.judges.guestFromYear) % 3];
  return J.map((j) => (j === seat ? (year % 2 ? 'moss' : 'vance') : j));
}
// Heaviest standings: valid entries (weighed, not DQ, not exhibition, not the gag) by weight.
export const rankOf = (entries: WeighoffEntry[]): Weighed[] =>
  entries.filter((e): e is Weighed => isWeighed(e) && !e.dq && !e.exhibition && !e.gag).sort((a, b) => b.W - a.W);
export const places = (s: State): Standing[] => rankOf(s.weighoff.entries).map((e, i) => ({ id: e.id, place: i + 1, W: e.W }));
// "nine hundred and... something" (the Weighmaster reads the chart)
export function chartWords(E: number) {
  const th = Math.floor(E / 1000), h = Math.floor((E % 1000) / 100);
  const parts: string[] = [];
  if (th) parts.push(`${wordsOf(th)} thousand`);
  if (h) parts.push(`${wordsOf(h)} hundred`);
  return parts.join(' ') || 'not very much';
}

// ------------------------------------------------------------ building the day
const rankKey = (e: WeighoffEntry) => (e.id === 'raccoons' ? 0 : rivalOf(e.id)?.last ? 2 : 1);

function makeEntries(s: State) {
  const wo = s.weighoff, out: WeighoffEntry[] = [];
  for (const p of giant.entries(s)) {
    const est = giant.publishedEstimate(s, p);
    out.push({ id: `you${p.plot}`, you: true, plot: p.plot, name: p.name || 'Your giant', grower: s.meta.surname, farm: s.meta.farmName,
      species: s.meta.species, est, sortEst: est, dq: false, weighed: false, pallet: -1 });
  }
  for (const r of rivalField(s)) {
    const R = RV[r.id];
    out.push({ id: r.id, you: false, name: r.gag ? gagLine(s.clock.year).name : r.name, grower: R.name, farm: R.farm, species: R.species,
      est: r.est, sortEst: r.est ?? r.chart, gag: r.gag, dq: r.dq, weighed: false, pallet: -1,
      beauty: r.gag ? 0 : r.id === 'raccoons' ? WO.gag.beauty : R.beauty });
  }
  // the weigh-in order: the raccoons first, then ascending published estimates, Prof. Hoot last by lantern
  const order = out.slice().sort((a, b) => rankKey(a) - rankKey(b) || a.sortEst - b.sortEst);
  wo.order = order.map((e) => e.id);
  // pallets along the north fence in weigh-in order (yours sit in the line too, until the lift)
  order.forEach((e, k) => { e.pallet = k; });
  wo.entries = out;
}

const watchStep = (): WeighoffStepOf<'watch'> => ({ k: 'watch', pairs: [], seconds: 0, flood: false, mavis: false, nap: false });
const liftStep = (plot: number, id: string): WeighoffStepOf<'lift'> =>
  ({ k: 'lift', plot, id, auto: null, beats: 0, mavisAt: -1, ring: 0, neighbours: 0 });
const inspectStep = (plot: number, id: string): WeighoffStepOf<'inspect'> => ({ k: 'inspect', plot, id, pass: false, brow: 'none', lines: [] });
const weighStep = (id: string): WeighoffStepOf<'weigh'> => ({ k: 'weigh', id, standings: [], dq: false });
const resultsStep = (): WeighoffStepOf<'results'> => ({ k: 'results', place: null, prizes: [], total: 0, pb: false, record: false,
  crown: false, best: null, W: null, pct: null, prettyPlace: null, winner: null, vows: null, exhibition: false });

function buildSteps(s: State): WeighoffStep[] {
  const wo = s.weighoff, steps: WeighoffStep[] = [{ k: 'eve' }];
  if (wo.heist) steps.push(watchStep());
  steps.push({ k: 'dawn' }, { k: 'arrive' }, { k: 'welcome' });
  for (const e of wo.entries) if (e.you && e.plot !== undefined) steps.push(liftStep(e.plot, e.id), inspectStep(e.plot, e.id));
  steps.push({ k: 'pretty', judges: [] });
  for (const id of wo.order) steps.push(weighStep(id));
  steps.push(resultsStep());
  return steps;
}

function start(s: State, ctx: Ctx) {
  const wo = s.weighoff;
  wo.year = s.clock.year;
  makeEntries(s);
  wo.heist = s.clock.year >= T.events.cat.heist_scouts.fromYear && giant.entries(s).length > 0 && wo.rolls.heist < heistInterest(s);
  wo.pretty = null; wo.results = null;
  wo.steps = buildSteps(s);
  wo.i = -1;
  go(s, ctx, 0);
}

// ------------------------------------------------------------ stepping through the day
function go(s: State, ctx: Ctx, i: number) {
  const wo = s.weighoff;
  wo.i = i;
  const st = wo.steps[i];
  if (!st) return;
  wo.stage = STAGE_OF[st.k];
  enter(s, ctx, st);
  ctx.emit({ type: 'weighoff/stage', stage: wo.stage, step: st.k, i });
}
function advance(s: State, ctx: Ctx) {
  const wo = s.weighoff, i = wo.i + 1;
  if (i >= wo.steps.length) { finish(s, ctx); ctx.setPhase('halloween'); return; }
  go(s, ctx, i);
}
function finish(s: State, ctx: Ctx) {
  const wo = s.weighoff;
  wo.stage = 'done';
  if (isActive(s, 'swarm') && s.patch?.swarm?.spot === 'weighmasterHat') { deactivate(s, 'swarm'); s.patch.swarm = null; ctx.emit({ type: 'patch/swarm', state: 'gone' }); }
}

const say = (ctx: Ctx, who: string, lines: string | string[], opts?: SayOpts) => ctx.say(who, Array.isArray(lines) ? lines : [lines], opts);
const mainPlant = (s: State) => giant.entries(s)[0] ?? null;

// What entering a step does: lines, the step's own data, the sim state it changes.
function enter(s: State, ctx: Ctx, st: WeighoffStep) {
  switch (st.k) {
    case 'eve':
      // year 1: Old Moss's foreshadow is beat #24 (BEATS below). Later years: a line, then (maybe) the Night Watch.
      if (s.clock.year > 1) say(ctx, 'moss', s.weighoff.heist ? L.eve.uneasy : pick(hrng(s, 'eve'), L.eve.later));
      ctx.emit({ type: 'weighoff/giggle', y1: s.clock.year === 1 });
      return;
    case 'watch': return enterWatch(s, st);
    case 'dawn': return enterDawn(s, ctx);
    case 'arrive': ctx.emit({ type: 'weighoff/arrive' }); return;
    case 'welcome':
      // year 1 is beat #25 (the Mayor emcees, then the Weighmaster, and the HEAVE goal); later years vary the lines
      if (s.clock.year > 1) {
        const r = hrng(s, 'welcome');
        say(ctx, 'mayor', pick(r, L.mayorOpen));
        say(ctx, 'weighmaster', pick(r, L.wmOpen));
      }
      return;
    case 'lift': return enterLift(s, ctx, st);
    case 'inspect': return enterInspect(s, ctx, st);
    case 'pretty': return enterPretty(s, ctx, st);
    case 'weigh': return enterWeigh(s, ctx, st);
    case 'results': settle(s, ctx, st);
  }
}

// 8 pairs of eyes, one at a time, around her corner; the UI plays the 15 s and reports which it flashed
function enterWatch(s: State, st: WeighoffStepOf<'watch'>) {
  const r = hrng(s, 'watch'), y = s.clock.year, vis = y >= 4 ? NW.visibleY4 : NW.visible, W = WO.nightWatchLayout;
  const spots = W.spots.slice();
  const flood = has(s, 'floodlights'), mavis = s.hires?.mavis === y, nap = mavis && next(r) < NW.mavisNap;
  const pairs: WatchPair[] = [];
  for (let k = 0; k < NW.pairs; k++) {
    const sp = spots.splice(Math.floor(next(r) * spots.length), 1)[0] ?? W.spots[k % W.spots.length];
    const at = round3(W.first + k * W.gap + (next(r) - 0.5) * W.jitter);
    let auto: WatchPair['auto'] = null;
    if (k === 0) auto = 'biscuit';
    else if (flood && k % NW.floodlights === 1) auto = 'flood';
    else if (mavis && !nap && next(r) < NW.mavis) auto = 'mavis';
    if (sp) pairs.push({ k, at, vis, x: sp[0], y: sp[1], z: sp[2], where: sp[3], auto });
  }
  st.pairs = pairs;
  st.seconds = NW.seconds; st.flood = flood; st.mavis = mavis; st.nap = nap;
}

function enterDawn(s: State, ctx: Ctx) {
  s.clock.day = WEIGHOFF; s.clock.minute = WO.dawnMinute; s.clock.dayFrac = 0;
  // her giants were trucked to the scale at first light: the giant corner is empty, the weigh-off draws her now
  for (const p of giant.entries(s)) p.stage = 'weighed';
  const msgs: string[] = [], main = mainPlant(s), R = s.weighoff.rivals;
  if (s.clock.year === 1 && main) msgs.push(line(s, L.footprints, { name: main.name || 'her' }));
  if (!R.mavis.show) msgs.push(L.noShow);
  if (R.lindqvist.show) msgs.push(L.lindqvist);
  if (!giant.entries(s).length) msgs.push(L.noEntry);
  for (const t of msgs) ctx.emit({ type: 'toast', text: t, cls: 'event', icon: 'scale' });
}

function enterLift(s: State, ctx: Ctx, st: WeighoffStepOf<'lift'>) {
  const e = entryOf(s, st.id), y = s.clock.year, R = s.weighoff.rivals;
  st.auto = has(s, 'ring') ? 'ring' : s.owned.forklift?.y === y && y >= LF.forkliftFrom ? 'forklift' : null;
  st.beats = LF.beats + (R.mavis.show && !st.auto ? 1 : 0);
  st.mavisAt = st.beats > LF.beats ? WO.lift2.mavisBeat : -1;
  st.ring = round3(Math.max(WO.lift2.minRing, LF.ring - LF.ringPer500 * (e?.est || 0) / 500));
  st.neighbours = neighbours(s);
  if (st.auto) say(ctx, 'mayor', L.lift[st.auto]);
  else {
    say(ctx, 'mayor', L.lift.call);
    if (R.vance.show) say(ctx, 'vance', LINES.vance.heckle);
  }
}

function enterInspect(s: State, ctx: Ctx, st: WeighoffStepOf<'inspect'>) {
  const p = giant.plantOf(s, st.plot), e = entryOf(s, st.id);
  if (!p || !e) return;
  const ex = giant.hiddenCavity(p) || !!p.liftCavity;
  e.exhibition = ex; st.pass = !ex;
  // his eyebrow reads the field, not the scale: her published estimate's rank among everybody's
  const ests = s.weighoff.entries.filter((x) => !x.gag).map((x) => x.sortEst || 0).sort((a, b) => b - a);
  const rank = ests.indexOf(e.sortEst) + 1;
  st.brow = ex ? 'none' : rank <= WO.brow.up ? 'up' : rank <= WO.brow.slight ? 'slight' : 'none';
  // his remark is shown by the UI at the stamp, never before it (the flashlight has to finish its circle)
  st.lines = ex ? [LINES.weighmaster.exhibition] : [L.pass, LINES.giant.brow[st.brow]];
  if (ex) ctx.story('exhibition', LINES.crier.heartbreak.score, { NAME: e.name.toUpperCase(), FARM: s.meta.farmName.toUpperCase() });
  ctx.emit({ type: 'weighoff/inspected', plot: st.plot, pass: !ex, brow: st.brow });
}

function enterPretty(s: State, ctx: Ctx, st: WeighoffStepOf<'pretty'>) {
  scorePretty(s);
  const pr = s.weighoff.pretty;
  if (!pr) return;
  st.judges = pr.judges;
  say(ctx, 'mayor', L.pretty.open);
  const guest = pr.judges.find((j): j is 'moss' | 'vance' => j === 'moss' || j === 'vance');
  if (guest) say(ctx, 'mayor', L.pretty.guest[guest]);
  // the bees may pick this moment to land on the Weighmaster's hat (design §10 swarm, 15%)
  if (s.weighoff.rolls.swarm < T.events.cat.swarm.weighoff && (s.patch?.hives ?? 0) >= T.events.cat.swarm.hives && !isActive(s, 'swarm')) {
    fireNow(s, ctx, 'swarm', { spot: 'weighmasterHat' });
  }
}

function enterWeigh(s: State, ctx: Ctx, st: WeighoffStepOf<'weigh'>) {
  const e = entryOf(s, st.id), wo = s.weighoff;
  if (!e) return;
  const p = plantOfEntry(s, e);
  if (e.you) {
    if (p) {
      const E = giant.chartEstimate(s, p), W = giant.trueWeight(s, p);
      e.W = W; e.chart = E; e.pct = round3(W / E - 1);
      st.read = line(s, L.read, { name: e.name, chart: chartWords(E) });
    }
  } else {
    const r = own(wo.rivals, e.id);
    if (r) { e.W = r.W; e.chart = r.chart; }
    if (e.gag) st.note = gagLine(s.clock.year).note;
    else if (e.id === 'raccoons') st.note = L.gag.legit;
    if (e.id === 'raccoons') fireNow(s, ctx, 'raccoon_entry');
    if (e.dq && !e.gag) st.note = e.id === 'tom' ? L.dq.tom : L.dq.any;
  }
  e.weighed = true;
  if (e.id === 'hoot') say(ctx, 'mayor', L.hoot);
  st.standings = places(s);
  st.dq = !!(e.dq || e.exhibition);
  // your reveal's banners and the Weighmaster's verdict: the UI shows them at the lock, never before
  if (e.you && !e.exhibition) {
    const pl = st.standings.find((x) => x.id === e.id)?.place, W = e.W ?? 0, pct = e.pct ?? 0;
    st.pb = s.clock.year >= PZ.personalBestFrom && W > (wo.best?.W ?? 0);
    st.record = W > wo.record.W;
    st.verdict = st.record ? 'record' : pct >= WO.verdict.heavy ? 'heavy' : pct <= WO.verdict.light ? 'air' : pl === 1 ? 'adequate' : 'mass';
  }
  ctx.emit({ type: 'weighoff/weighed', id: e.id });
}

// one neighbour per 15 four- or five-star families this season, at least 6 (cosmetic)
function neighbours(s: State) {
  const h = s.season?.totals?.starsHist, happy = h ? (h[3] ?? 0) + (h[4] ?? 0) : 0;   // the season's 4- and 5-star families
  return Math.max(LF.minNeighbours, Math.round(happy / LF.neighbourPer));
}

// ------------------------------------------------------------ Prettiest (design §8)
function scorePretty(s: State) {
  const wo = s.weighoff, judges = judgesFor(s.clock.year), board: WeighoffPrettyBoard[] = [];
  const card = (x: number) => Math.round(clamp(x, 0, 10) * 10) / 10;
  for (const e of wo.entries) {
    if (e.gag) continue;
    const r = hrng(s, 'pretty', e.id);
    let raw: number[];
    if (e.you) {
      const p = plantOfEntry(s, e);
      if (!p) continue;
      const f = gen.prettyFeatures(s, p);
      if (f.mustache) { board.push({ id: e.id, cards: null, total: 0, mustache: true }); continue; }
      const sc = gen.judgeScores(f, judges.filter((j) => j !== 'moss'));
      raw = judges.map((j) => (j === 'moss' ? mossCard(r) : sc.find((x) => x.id === j)?.score ?? 0));
    } else {
      const total = 30 * (e.beauty ?? 0) + WO.pretty.rivalSd * gauss(r);
      raw = judges.map((j) => (j === 'moss' ? mossCard(r) : total / 3 + 0.35 * gauss(r)));
    }
    const cards = raw.map(card);
    board.push({ id: e.id, cards, total: Math.round(cards.reduce((a, b) => a + b, 0) * 10) / 10 });
  }
  const ranked = board.filter((b) => !b.mustache).sort((a, b) => b.total - a.total);
  ranked.forEach((b, i) => { b.place = i + 1; });
  const mine = ranked.filter((b) => b.id.startsWith('you'));
  wo.pretty = { judges, board, ranked: ranked.map((b) => b.id), place: mine[0]?.place ?? null, asleep: next(hrng(s, 'moss')) < WO.pretty.judges.moss.asleep };
}
// Old Moss judges by feel: 5.0 or 9.5, at random
const mossCard = (r: Rng) => WO.pretty.judges.moss.scores[next(r) < 0.5 ? 0 : 1] ?? 5;

// ------------------------------------------------------------ results, prizes and the record (design §8 prize table)
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const realRival = (id: string) => { const R = rivalOf(id); return !!R && !R.gag; };

function settle(s: State, ctx: Ctx, st: WeighoffStepOf<'results'>) {
  const wo = s.weighoff, y = s.clock.year, ranked = rankOf(wo.entries), prizes: Prize[] = [];
  const add = (cat: string, label: string, amount: number, extra: Partial<Prize> = {}) => {
    if (amount > 0) prizes.push({ cat, label, amount: Math.round(amount * 100) / 100, ...extra });
  };
  const mine = wo.entries.filter((e) => e.you);
  const placed: (Weighed & { place: number })[] = [];
  for (const e of mine) {
    const i = ranked.findIndex((x) => x === e), pl = i < 0 ? null : i + 1, r = ranked[i];
    e.place = pl;
    if (!r || !pl) continue;
    if (pl <= 3) add('prizes', `${ord(pl)} Heaviest: ${e.name}`, (PZ.heaviest.perLb[pl - 1] ?? 0) * r.W, { id: e.id });
    else if (pl >= PZ.heaviest.ribbonPlaces[0] && pl <= PZ.heaviest.ribbonPlaces[1]) add('prizes', `${ord(pl)} place ribbon: ${e.name}`, PZ.heaviest.ribbon, { id: e.id });
    placed.push(Object.assign(r, { place: pl }));
  }
  const best = placed.reduce<(Weighed & { place: number }) | null>((b, e) => (!b || e.place < b.place ? e : b), null);
  const valid = mine.filter((e): e is Weighed => !e.exhibition && isWeighed(e));
  if (y === 1 && valid.length) add('prizes', 'First-Timer ribbon', PZ.firstTimer);
  const top = valid.sort((a, b) => b.W - a.W)[0] ?? null;
  const prevBest = wo.best?.W ?? 0;
  const pb = !!top && y >= PZ.personalBestFrom && top.W > prevBest;
  if (pb) add('prizes', 'Personal best', PZ.personalBest);
  const record = !!top && top.W > wo.record.W;
  if (record) add('prizes', 'Cove record!', PZ.record);
  // Prettiest
  const pr = wo.pretty;
  const prettyMine = pr ? pr.board.flatMap((b) => (b.id.startsWith('you') && b.place ? [{ id: b.id, place: b.place }] : [])) : [];
  for (const b of prettyMine) if (b.place <= 3) add('prizes', `${ord(b.place)} Prettiest: ${entryOf(s, b.id)?.name ?? b.id}`, PZ.pretty[b.place - 1] ?? 0);
  const crown = !!best && best.place === 1 && prettyMine.some((b) => b.id === best.id && b.place === 1);
  if (crown) add('prizes', 'Double Crown', PZ.doubleCrown);
  // the shiny auction
  for (const sh of s.patch?.shinies || []) if (sh.state === 'auction' && sh.value) {
    const kind = own(LINES.wo.shinyNames, sh.kind) ?? 'shiny';
    add('auction', `Shiny auction: the ${kind}`, sh.value, { shiny: sh.id });
    sh.state = 'sold';
    ctx.story('auction', LINES.crier.shiny.score, { P: sh.value, KIND: kind.toUpperCase() });
  }
  for (const p of prizes) ctx.money(p.amount, p.cat);
  const total = prizes.reduce((a, p) => a + p.amount, 0);
  // the record books, the giants' results, the rivals' lines (the Grange names them by these)
  for (const e of mine) {
    const p = plantOfEntry(s, e);
    if (!p) continue;
    giant.recordResult(s, p, { W: e.W ?? null, place: e.place ?? null, exhibition: !!e.exhibition, dq: !!e.exhibition, pct: e.pct ?? null,
      pretty: pr?.board.find((b) => b.id === e.id)?.place ?? null });
  }
  // a disqualified rival keeps last year's official line weight (the scale still read one the first time)
  for (const e of wo.entries) if (!e.you && !e.gag && e.W !== undefined && e.weighed && isRivalId(e.id) && (!e.dq || !wo.lines[e.id])) wo.lines[e.id] = { W: e.W, year: y };
  if (top && top.W > prevBest) wo.best = { W: top.W, year: y, name: top.name };
  if (top && record) wo.record = { W: top.W, who: s.meta.surname, year: y, you: true, name: top.name };
  // who did you beat? that rival vows revenge (+6% next year)
  const beaten = best ? ranked.slice(ranked.indexOf(best) + 1).find((e) => !e.you && realRival(e.id) && e.id !== 'lindqvist') : undefined;
  wo.vows = beaten && isRivalId(beaten.id) ? beaten.id : null;
  // the Crier's story beats (the verdict was spoken at her reveal)
  st.place = best?.place ?? null; st.prizes = prizes; st.total = total; st.pb = pb; st.record = record; st.crown = crown;
  st.best = top?.id ?? null; st.W = top?.W ?? null; st.pct = top?.pct ?? null; st.prettyPlace = pr?.place ?? null;
  st.winner = ranked[0]?.id ?? null; st.vows = wo.vows; st.exhibition = mine.some((e) => !!e.exhibition);
  const nameOf = (e: WeighoffEntry) => (e.name || 'her').toUpperCase(), W = (e: Weighed) => commas(e.W);
  if (top && record) ctx.story('record', LINES.crier.record.score, { NAME: nameOf(top), W: W(top) });
  if (best && crown) ctx.story('doubleCrown', LINES.crier.doubleCrown.score, { NAME: nameOf(best) });
  if (best?.place === 1) ctx.story('heaviest', LINES.crier.heaviest.score, { NAME: nameOf(best), W: W(best) });
  else if (best && (best.place === 2 || best.place === 3)) ctx.story(best.place === 2 ? 'second' : 'third', LINES.wo.crier[best.place === 2 ? 'second' : 'third'].score, { NAME: nameOf(best), W: W(best) });
  if (top && pb && !record) ctx.story('pb', LINES.wo.crier.pb.score, { NAME: nameOf(top), W: W(top) });
  const prettiest = pr?.place === 1 ? entryOf(s, pr.board.find((b) => b.place === 1)?.id) : null;
  if (prettiest) ctx.story('prettiest', LINES.crier.prettiest.score, { NAME: nameOf(prettiest) });
  if (wo.vows) ctx.story('vows', LINES.wo.crier.vows.score, { WHO: (RV[wo.vows].name.split(' ').pop() ?? '').toUpperCase() });
  if (s.giant.mustache) ctx.story('mustache', LINES.crier.mustache.score, {});
  const winner = ranked[0];
  if (winner && !winner.you) say(ctx, 'mayor', line(s, L.winner, { who: rivalOf(winner.id)?.name || winner.grower, w: W(winner) }));
  else if (winner) say(ctx, 'mayor', line(s, L.youWin, { name: winner.name, w: W(winner) }));
  if (beaten?.id === 'vance' && !wo.entries.find((e) => e.id === 'vance')?.dq) say(ctx, 'vance', LINES.vance.beaten);
  // her seeds are already the talk of the Grange (they are scooped at Halloween)
  if (top) st.seeds = line(s, L.seeds, { short: gen.pedigreeName({ surname: s.meta.surname, weight: top.W, est: null, dmg: false }).short });
  wo.history = [...wo.history.slice(-11), { year: y, place: st.place, W: top?.W ?? null, pct: top?.pct ?? null, name: top?.name ?? giant.plants(s)[0]?.name ?? null,
    exhibition: mine.some((e) => !!e.exhibition), pretty: st.prettyPlace, total, winner: winner ? { id: winner.id, W: winner.W } : null, crown, record }];
  ctx.emit({ type: 'weighoff/results', place: st.place, total });
}

// ------------------------------------------------------------ the minigames' results (the UI plays them; bots pass skill)
function resolveWatch(s: State, ctx: Ctx, st: WeighoffStepOf<'watch'>, hits: Set<number>): WatchResult {
  const p = mainPlant(s);
  const caught = st.pairs.map((pr) => !!pr.auto || hits.has(pr.k));
  const misses = caught.filter((c) => !c).length;
  const scratches = Math.max(0, misses - NW.free), mustache = misses >= NW.mustache;
  if (p && scratches) giant.addScar(s, p, 'heist', scratches);
  if (p && mustache) giant.markMustache(s, p);
  const result = { caught, misses, scratches, mustache };
  st.done = true; st.result = result;
  const t = mustache ? L.watch.mustache : scratches ? L.watch.scratches : L.watch.clean;
  say(ctx, mustache ? 'gran' : 'moss', line(s, t, { name: p?.name || 'her', n: scratches }));
  ctx.goalDone('watch');
  ctx.emit({ type: 'weighoff/watched', misses, scratches, mustache });
  return result;
}
const asGrade = (g: unknown): Grade => (g === 'perfect' || g === 'good' ? g : 'wobble');
function resolveLift(s: State, ctx: Ctx, st: WeighoffStepOf<'lift'>, beats: readonly Grade[] | null): LiftResult {
  const p = giant.plantOf(s, st.plot), r = ctx.rng('misc');
  let grades: Grade[], scuff = false, crack = false, cavity = false;
  if (st.auto) {
    grades = Array<Grade>(LF.beats).fill('perfect');
    if (chance(r, LF.autoRisk)) { crack = true; cavity = chance(r, LF.cavityShare); }
  } else {
    grades = Array.from({ length: st.beats }, (_, k) => asGrade(beats?.[k]));
    const wobbles = grades.filter((g) => g === 'wobble').length;
    scuff = wobbles >= LF.scuffAt;
    for (let k = LF.scuffAt; k < wobbles; k++) if (!crack && chance(r, LF.crackChance)) { crack = true; cavity = chance(r, LF.cavityShare); }
  }
  if (p && scuff) giant.addScar(s, p, 'scuff', 1);
  if (p && crack) { giant.addScar(s, p, 'crack', T.giant.split.crackScars); p.liftCrack = true; p.liftCavity = cavity; }
  const perfect = grades.every((g) => g === 'perfect');
  const result = { grades, scuff, crack, perfect };
  st.done = true; st.result = result;
  const t = crack ? L.heave.crack : scuff ? L.heave.scuff : perfect ? L.heave.perfect : L.heave.good;
  ctx.emit({ type: 'toast', text: t, cls: crack ? 'bad' : scuff ? 'warn' : 'good', icon: 'scale' });
  ctx.goalDone('heave');
  ctx.emit({ type: 'weighoff/heaved', plot: st.plot, grades, scuff, crack });
  return result;
}

// ------------------------------------------------------------ actions
const inWeighoff = (s: State) => s.clock.phase === 'weighoff' && s.weighoff.stage !== null && s.weighoff.stage !== 'done';
const ACTIONS = {
  'weighoff/next': (s, _a, ctx) => {
    const st = current(s);
    if (!inWeighoff(s) || !st) return fail('not the weigh-off');
    if (st.k === 'watch' && !st.done) return fail('Flash the light at the eyes first');
    if (st.k === 'lift' && !st.done) {
      if (!st.auto) return fail('HEAVE first!');
      resolveLift(s, ctx, st, null);
    }
    advance(s, ctx);
    return { ok: true };
  },
  'weighoff/watch': (s, a, ctx) => {
    const st = current(s);
    if (!inWeighoff(s) || st?.k !== 'watch') return fail('nothing out there');
    if (st.done) return fail('the night is over');
    return { ok: true, ...resolveWatch(s, ctx, st, new Set(a.hits.map((x) => x | 0))) };
  },
  'weighoff/heave': (s, a, ctx) => {
    const st = current(s);
    if (!inWeighoff(s) || st?.k !== 'lift') return fail('nothing to lift');
    if (st.done) return fail('she is already on the scale');
    return { ok: true, ...resolveLift(s, ctx, st, a.beats) };
  },
  // from year 2, the rivals' weigh-ins can be skipped (never your own reveal)
  'weighoff/skipRivals': (s, _a, ctx) => {
    if (!inWeighoff(s)) return fail('not the weigh-off');
    if (s.clock.year < WO.rivalSkipFrom) return fail('watch them all this year');
    const skippable = () => { const st = current(s); return st?.k === 'weigh' && !entryOf(s, st.id)?.you; };
    let n = 0;
    while (skippable() && n < 20) { advance(s, ctx); n++; }
    return { ok: true, skipped: n };
  },
} satisfies ActionHandlers;

// ------------------------------------------------------------ the forklift (Y2+ September prep card)
function forkliftCard(s: State, ctx: Ctx) {
  const it = CATALOGUE.forklift, C = L.forklift;
  ctx.card({ kind: 'forklift', data: { title: C.title, eyebrow: C.eyebrow, speaker: 'vance', text: C.text,
    choices: [{ id: 'rent', label: line(s, C.rent[0], { price: it.price }), sub: C.rent[1] }, { id: 'heave', label: C.heave[0], sub: C.heave[1], primary: true }],
    defaultChoice: 'heave' } });
}

// ------------------------------------------------------------ events owned here (design §10)
const EVENTS: NonNullable<SimModule['events']> = [
  { // every weigh-off: the raccoons' escalating disguise (fired at their weigh-in; legitimate from year 5)
    id: 'raccoon_entry', cls: 'story', per: 'day', capYear: 1, quiet: true, when: () => false, rate: () => 0,   // the panel tells it
    text: (s) => (s.clock.year >= (RV.raccoons.legitFromYear ?? Infinity) ? L.gag.legit : gagLine(s.clock.year).note),
    fire(s, ctx) { if (s.clock.year < (RV.raccoons.legitFromYear ?? Infinity)) ctx.story('raccoonEntry', LINES.crier.raccoonEntry.score, { DISGUISE: gagLine(s.clock.year).headline }); },
  },
  { // October weekdays, Y2+: raccoon kits caught measuring your giant "for school" (foreshadows the Night Watch)
    id: 'heist_scouts', cls: 'minor', per: 'day', capYear: 1,
    when: (s) => s.clock.phase === 'october' && !isWeekend(s.clock.day) && s.clock.year >= T.events.cat.heist_scouts.fromYear
      && giant.entries(s).length > 0 && heistInterest(s) >= T.events.cat.heist_scouts.interest,
    rate: () => WO.scouts.rate,
    text: (s) => line(s, LINES.events.heist_scouts, { name: mainPlant(s)?.name || 'your giant' }),
    fire(_s, ctx) { ctx.story('scouts', 6, {}); },
  },
];

// ------------------------------------------------------------ onboarding beats (design §3 #24, #25; Y2 Night Watch)
const BEATS: NonNullable<SimModule['beats']> = [
  { id: 'weighoff.eve', year: 1, order: 24, when: (s) => s.clock.phase === 'weighoff' && s.weighoff.stage === 'eve',
    run(_s, ctx) { ctx.say('moss', [LINES.moss.eve]); } },
  { id: 'weighoff.day', year: 1, order: 25, when: (s) => s.clock.phase === 'weighoff' && current(s)?.k === 'welcome',
    run(s, ctx) {
      ctx.unlock('weighoff');
      ctx.say('mayor', [LINES.mayor.weighoff]);
      ctx.say('weighmaster', [LINES.weighmaster.intro], giant.entries(s).length ? { goal: { id: 'heave' } } : {});
    } },
  { id: 'weighoff.watch', years: [2, 999], order: 60, when: (s) => s.clock.phase === 'weighoff' && current(s)?.k === 'watch',
    run(_s, ctx) { ctx.say('moss', L.watch.intro, { goal: { id: 'watch', text: L.watch.goal } }); } },
];

// ------------------------------------------------------------ bots: skill instead of thumbs
// Policy fields read: lift (0..1, the chance a beat is on time; novice 0.5, balanced 0.85, idle none = 0), watch (else lift).
function botBeats(s: State, P: Policy, st: WeighoffStepOf<'lift'>) {
  const r = makeRng(hash32(s.seed, s.clock.year, 'botlift', st.plot)), skill = P.lift ?? 0;
  return Array.from({ length: st.beats }, (): Grade => { const u = next(r); return u < skill * 0.5 ? 'perfect' : u < skill ? 'good' : 'wobble'; });
}
function botHits(s: State, P: Policy, st: WeighoffStepOf<'watch'>) {
  const r = makeRng(hash32(s.seed, s.clock.year, 'botwatch')), skill = P.watch ?? P.lift ?? 0;
  return st.pairs.filter(() => next(r) < skill).map((p) => p.k);
}

export default {
  id: 'weighoff',
  init(s, ctx) {
    const { rivals, rolls } = rollYear(s, ctx, null);
    s.weighoff = { year: s.clock.year, stage: null, i: -1, steps: [], entries: [], order: [], rivals, rolls, heist: false,
      pretty: null, results: null, lines: {}, history: [], best: null, record: { ...RV.record }, vows: null, forklift: 0 };
  },
  newYear(s, ctx) {
    Object.assign(s.weighoff, { year: s.clock.year, stage: null, i: -1, steps: [], entries: [], order: [], heist: false, pretty: null, results: null },
      rollYear(s, ctx, s.weighoff.vows));
  },
  phase(s, ctx, from, to) {
    if (to === 'weighoff') { start(s, ctx); runBeats(s, ctx); }
    if (from === 'weighoff' && s.weighoff.stage !== 'done') finish(s, ctx);
  },
  dayStart(s, ctx) {
    // September prep (Y2+): the forklift rental, once a year, if she is alive and there is no lifting ring
    const y = s.clock.year;
    if (s.clock.phase === 'grow' && y >= LF.forkliftFrom && s.clock.day >= dayOf(WO.forkliftCard) && s.weighoff.forklift !== y
      && giant.entries(s).length && !has(s, 'ring')) {
      s.weighoff.forklift = y;
      forkliftCard(s, ctx);
    }
  },
  actions: ACTIONS,
  cards: {
    forklift(s, _card, choice, ctx) {
      if (choice !== 'rent') return undefined;
      const why = blocker(s, 'forklift');
      if (why) { ctx.emit({ type: 'toast', text: why.charAt(0).toUpperCase() + why.slice(1), cls: 'bad' }); return undefined; }
      const it = CATALOGUE.forklift;
      ctx.money(-it.price, 'rentals');
      s.owned.forklift = { y: s.clock.year, d: s.clock.day, n: (s.owned.forklift?.n || 0) + 1 };
      ctx.emit({ type: 'toast', text: L.forklift.rented, cls: 'good', icon: 'scale' });
      return undefined;
    },
  },
  beats: BEATS,
  events: EVENTS,
  bot(s, _ctx, P) {
    if (!inWeighoff(s)) return undefined;
    const st = current(s);
    if (!st) return undefined;
    if (st.k === 'watch' && !st.done) return { type: 'weighoff/watch', hits: botHits(s, P, st) };
    if (st.k === 'lift' && !st.done && !st.auto) return { type: 'weighoff/heave', plot: st.plot, beats: botBeats(s, P, st) };
    return { type: 'weighoff/next' };
  },
  summary(s) {
    const h = s.weighoff.history.at(-1);
    return { place: h?.place ?? 0, prizes: h?.total ?? 0, won: h?.place === 1 ? 1 : 0, crown: h?.crown ? 1 : 0, record: h?.record ? 1 : 0 };
  },
} satisfies SimModule;
