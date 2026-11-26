// The giant pumpkin (design §6): seed start, transplant, water regimen and swings, feed, shade, pollination at dawn,
// cull and name, growth (logistic in time x daily care quality), two-stage creaks and splits, OTT and the chart, the
// HIDDEN true weight, other risks, the superstitions (one secretly real), Old Moss's tips, the September Crier card,
// and the second plot (Y3, sim). Genetics live in genetics.js.
//
// What the player should feel at each step (design §13), and what makes it so:
//   Grandpa's tin (Apr 1)  lineage and hope. Three plain taps on her sheet (lid, nick, mat), a backup "just in case".
//   Moving Day (May 1)     [C] the forecast's first job: pick a morning from Hal's forecast; a clear one roots her in a
//                          day (a new leaf next morning), a foggy one and she sulks 3-5 days, drooping, and flowers later.
//   Kelp (Jun 5)           [C] Old Moss's first visit: a trade, money for size ("$2 a day ... about 6% heavier").
//   Pollination (Jul)      [C] count the bees: 8 out on a clear dawn (they take 92%), 1 in fog (50%); your own paws take
//                          80% any dawn; or not today. Year 1 shows no odds: the bees are the stakes.
//   Cull and name          bittersweet, then attachment: three fruits on the vine, keep one, give her a name. Vance's
//                          receipt comes at her first creak.
//   The tape (Aug)         [C] wonder in public: the first tape at the Vine Crawl, then Edna's Sunday tape and your own
//                          Measure every few days, each with a pace line ("on pace for ~800 · Vance usually ~930").
//   Shade (Aug)            read Hal's forecast: down on a heat day is x0.75 growth, x2.5 stress and sunscald; up on a
//                          foggy day costs 10%, so "always up" is the safe floor and "by the forecast" the best mean.
//   Creak (Aug-Sep)        tension and push-your-luck: every split is preceded by a creak (100%, by construction); the
//                          creak lesson brings the water dial (Ease / Normal / Push: "wetter grows faster, wetter splits");
//                          easing off (Ease, shade, no fish) makes healing likely; riding it keeps the growth.
//   Split                  heartbreak you saw coming. A blowout is The One That Got Away; a surface crack keeps hope
//                          alive until the inspection (25% secretly reach the cavity, 10% if treated).
//   September Crier        sizing up rivals; telling buys buzz and gawkers, and draws the raccoons.
//   Rituals                folklore. Exactly one is secretly real (seed-hashed), worth at most ~2%: arguable, never sure.
//   The reveal             the chart flatters Heavy water and undersells kelp: |% vs chart| ~4%, half go heavy.
//
// s.giant is the main plant (plot 1) plus the corner's shared settings. Render/UI-facing fields:
//   stage 'tin'|'started'|'sprout'|'seedling'|'vine'|'flower'|'set'|'fruit' (weigh-off/winter slices may set
//     'weighed'|'carved'|'gone'), name, seed { id, short, name, source }, t (days since set), wc (chart size, lb: what the
//     tape sees), est (latest measured chart estimate), ottShown, measures [{ day, ott, est }], bestPerDay, m (moisture),
//     swing (days left), creaking, softSpot, creaks [{ day, end, outcome, practice }], split null|'blowout'|'crack',
//     cracked, treated, scars (total marks), scarsBy { sunscald, crack, heist, scuff }, color 'O'|'S'|'T'|'W', stripe,
//     shape 'tall'|'round'|'flat', evenness, cull 'safe'|'stump'|'round'|'twins', twins, rotated, stemCrack, mustache,
//     father { kind, name, line }, hat, moon (days from full at set), vigorHint, plot2 (the same plant shape, or null)
//   corner: regime 'light'|'normal'|'heavy', feed 'none'|'kelp'|'fish'|'both', shade, motor, radio, hat (lucky hat now),
//     kelpFree (days), crier { told, est, day } | null, talks { [week]: n }, talkCount, history
//     [{ year, name, measures, result, split, creaks }] (the notebook's last-year overlay)
// HIDDEN: plant.secret = { vigor, potEff, rhoZ, cavityU, rho, wTrue } is NEVER read by src/ui or src/render (a test
//   enforces it). The sign shows "est. 1,2?? lb". Only the weigh-off slice reads the scale through trueWeight().
//
// For the weigh-off slice (next wave) — everything the inspection, Prettiest and the reveal need:
//   entries(s) -> [plant] that can be entered (not blown out); plant fields above; publishedEstimate(s, p) (yours: the
//   latest chart estimate); chartEstimate(s, p) (the Weighmaster's own tape on the day); trueWeight(s, p) (the scale);
//   hiddenCavity(p) (a surface crack that secretly reached the cavity: EXHIBITION ONLY at inspection);
//   genetics.prettyFeatures(s, p) (colour, evenness, shape, symmetry, stem, scars, mustache); ritualsKept(s, p);
//   addScar(s, p, 'heist'|'scuff', n); markMustache(s, p); recordResult(s, p, { W, place, exhibition, dq, pct, pretty })
//   (pedigree names and next year's seed lot use it; if the slice never calls it a fallback records the true weight);
//   crierEffects(s) (buzz floor, gawkers, heist interest from telling the Crier); heistInterest(s) (Crier + fish parts).
// Out-events: giant/start, giant/germinated, giant/transplant, giant/flower, giant/set, giant/noset, giant/cull,
//   giant/measure (tape anim), giant/measured { plot, ott, est, delta, days, perDay, record }, giant/knock { pitch },
//   giant/creak { plot, practice, soft }, giant/heal, giant/split { plot, kind }, giant/soak { swing }, giant/swing,
//   giant/scald, giant/talk { phrase }, giant/thanks (UI only, never logged), giant/crier { told }, giant/rotate { crack },
//   giant/grow { plot, gain } (overnight), giant/setting { key, value }.
import { T } from './tuning.js';
import { dayOf, monthOf, daysFromFull, moonPhase, WEIGHOFF, secondsPerDay, label, dowName, weekends } from './calendar.js';
import { makeRng, next, gauss, chance, int, shuffle, pick, Rng } from './rng.js';
import { clamp, round2, round3, hash32, fill, own } from './util.js';
import { PLACES } from './layout.js';
import { LINES, line, markChatter, fresh } from './story.js';
import { isActive, activate, fireNow } from './events.js';
import { MOSS, MOSS_NOTICE, EDNA, LINES as ML } from './lines-mischief.js';   // [A] the tips' and Edna's no-repeat pools
import { has, canAfford } from './economy.js';
import * as gen from './genetics.js';
import { CL } from './lines-giant.js';
import { word as fogWord } from './weather.js';
import type { SimModule, State, Ctx, ActionHandlers, ActionResult, Beat, Policy, GiantPolicy, FreshEntry, GiantReceipt, Card } from './types.js';
import type { FeedRow } from './tuning.js';

import type { Giant, GiantPlant, GiantScarsBy, FeedId } from './state.js';
import type { Action } from './action.js';
import type { Genome } from './state.js';
import type { GeneticsSeed } from './state.js';
import type { CardKind } from './cards.js';
const feedRow = (id: string): FeedRow => own(T.giant.feed, id) ?? T.giant.feed.none;
const GT = T.giant, CAT = T.events.cat, Y1 = T.story.y1, GL = LINES.giant, GC = LINES.giantCards;
const D = (x: string|number) => dayOf(x);
const fail = (reason: string) => ({ ok: false, reason });
const ok: ActionResult = { ok: true };
const clean = (x: unknown, n: number) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const growing = (s: State) => s.clock.phase === 'grow' || s.clock.phase === 'october';
const Lf = (t: number) => 1 / (1 + Math.exp(-GT.logistic.k * (t - GT.logistic.mid)));
const RANK = { light: 0, normal: 1, heavy: 2 };
const rankOf = (r: string) => own(RANK, r) ?? 1;
export const RITUALS = ['talk', 'hat', 'moon', 'radio', 'secret'];
const EFFECTS = ['growth', 'creak', 'rho'] as const;
type Effect = typeof EFFECTS[number];
/** A plant that has set fruit. */
export type Fruiting = GiantPlant & { setDay: number };
export const RADIO = ['shanties', 'jazz', 'borers'];
export const GLIDE = { x: PLACES.giant.x + 0.3, z: PLACES.giant.z + 0.4, zoom: 1.6 };

// ------------------------------------------------------------ plants
export const plants = (s: State) => (s.giant?.plot2 ? [s.giant, s.giant.plot2] : s.giant ? [s.giant] : []);
export const plantOf = (s: State, plot: unknown): GiantPlant|null => (plot === 2 ? s.giant.plot2 : s.giant);
export const hasFruit = (p: GiantPlant|null|undefined): p is Fruiting => p?.setDay != null;
export const alive = (p: GiantPlant|null|undefined): p is Fruiting => hasFruit(p) && p.split !== 'blowout';
const mainAlive = (s: State) => (alive(s.giant) ? s.giant : null);

function plantFrom(seed: GeneticsSeed, plot: number): GiantPlant {
  const ph = gen.phenotype(seed.genome);
  return {
    plot, stage: 'tin', seed: { id: seed.id, short: seed.short, name: seed.name, source: seed.source }, genome: seed.genome,
    F: seed.genome.F, het: !!seed.genome.het, color: ph.colour, shape: ph.shape, stripe: ph.stripe, evenness: round3(ph.evenness),
    name: null, startDay: null, germDay: null, failed: false, transplantDay: null, vineDay: null, flowerDay: null, cardDay: null,
    dawn: 0, fails: 0, setDay: null, cullDay: null, t: 0, father: null, hat: false, moon: null, cull: null, twins: false, vigorHint: null,
    pre: { days: 0, good: 0, kelp: 0 }, days: { set: 0, kelp: 0, heavy: 0, radio: 0 },
    m: GT.regime.normal, mHist: [], swing: 0, stressHist: [], wc: 0, gain: 0, est: 0, ottShown: 0, measures: [], bestPerDay: 0,
    creaking: false, creakDays: 0, practice: false, softSpot: false, creaks: [], split: null, splitDay: null, cracked: false,
    treated: false, seedsOk: true, scars: 0, scarsBy: { sunscald: 0, crack: 0, heist: 0, goat: 0, scuff: 0 }, rotated: false,
    stemCrack: false, mustache: false, mutationShown: false, result: null,
    secret: { vigor: 1, potEff: 0, rhoZ: 0, cavityU: 1, rho: 1, wTrue: 0 },
  };
}
// The corner's own fields. `hat` is the plant's field too: the corner's value (last year's) wins in the spread.
type Corner = Omit<Giant, Exclude<keyof GiantPlant, 'hat'> | 'plot2'>;
function corner(old: Giant|null, year = 1): Corner {
  const wanted = old?.feedWanted || old?.feed;
  return {
    regime: old?.regime || 'normal', regimeDay: -99, feedWanted: null,
    feed: wanted && (year >= 2 || !['fish', 'both'].includes(wanted)) ? wanted : 'none',
    fedToday: 'none', shade: false, motor: old?.motor ?? true, motorCall: 0, radio: old?.radio ?? null, hat: old?.hat ?? false,
    kelpFree: 0, crier: null, talks: {}, talkCount: 0, thanked: false, knocks: old?.knocks || 0, thirsty: false,
    lastRecord: null, mutation: null, tipNext: D(year === 1 ? GT.tips.firstY1 : GT.tips.first), tipPending: null, tipRitual: 0,
    history: old?.history || [],
    // [C] Moving Day ({ day, pick, fc, f, rootDays, rootedDay } once the card is answered), the Notebook's choices this year
    // ([{ d, id, text }]: what you chose and, later, what came of it), the receipts filed (heat, cull) and the heat wave now
    moving: null, notebook: { choices: [] }, receipts: {}, wave: null,
  };
}
function setup(s: State, old: Giant|null) {
  const [a, b] = gen.seedsForSpring(s);
  s.giant = { ...plantFrom(a, 1), ...corner(old, s.clock.year), plot2: b ? plantFrom(b, 2) : null };
}

// ------------------------------------------------------------ the model's pieces
export const ottOf = (wc: number) => (Math.max(wc, 0.01) / GT.ott.a) ** (1 / GT.ott.b);
export const chartOf = (ott: number) => GT.ott.a * ott ** GT.ott.b;
export function cWater(m: number) {
  const [[a, va], [b, vb]] = GT.water, W = GT.waterTop;
  return m < a ? va : m < b ? vb : W.base + W.add * Math.min(1, (m - W.from) / W.span);
}
// the sail up costs growth: a little on a clear day, more on a foggy one (she needs what light Marlene leaves her)
export function cLight(f: number, heat: boolean, shade: boolean) {
  if (heat) return shade ? 1 : GT.shade.heatDownGrowth;
  return (1 - GT.light.k * (f - GT.light.mid)) * (shade ? (f > GT.shade.fogF ? GT.shade.upFog : GT.shade.upGrowth) : 1);
}
// S(d): 1 until Sep 20, linear to 0.3 by Oct 20, then 0.3
export function slowdown(d: number) {
  const a = D(GT.slowdown.from), b = D(GT.slowdown.to), fl = GT.slowdown.floor;
  return d <= a ? 1 : d >= b ? fl : 1 - (1 - fl) * (d - a) / (b - a);
}
export const target = (regime: string) => own(GT.regime, regime) ?? GT.regime.normal;
const feedCost = (feed: string|null|undefined) => (feed ? own(GT.feed, feed)?.cost : undefined) ?? 0;
const feedOf = (s: State) => s.giant.fedToday || 'none';
const kelpIn = (feed: string) => feed === 'kelp' || feed === 'both';
const fishIn = (feed: string|undefined) => feed === 'fish' || feed === 'both';
export function stressOf(s: State, p: GiantPlant) {
  const st = GT.stress, m = p.m, f = s.weather.f, heat = !!s.weather.heat, g = s.giant;
  const base = m < st.dry[0] ? st.dry[1] : m <= st.mid[0] ? st.mid[1] : st.mid[1] + st.wetSlope * (m - st.mid[0]);
  const x = base * (p.swing > 0 ? GT.swing.mul : 1) * (heat && !g.shade ? GT.shade.heatDownStress : 1) * (fishIn(feedOf(s)) ? GT.fishStress : 1)
    * (p.cull === 'stump' ? GT.cull.stumpStress : 1) * (p.twins ? CAT.twin_fruit.stress : 1) * gen.phenotype(p.genome).tough
    * (1 + st.F * (p.F || 0)) * (1 - st.fog * f);
  return Math.min(x, st.cap);
}

// ------------------------------------------------------------ rituals (exactly one is real, from a hash of the seed)
export function secretOf(s: State) {
  const h = hash32(s.seed, 'ritual');
  return { ritual: RITUALS[h % RITUALS.length] ?? 'talk', effect: EFFECTS[(h >>> 8) % 3] ?? 'growth' };
}
const weekOf = (p: Fruiting, d: number) => Math.floor((d - p.setDay) / 7);
// "Kept" so far: talk in >= 80% of weeks since set; hat worn at pollination; set within 1 day of full; radio on >= 80%
// of days since set; the estimate kept from the Crier.
export function ritualKept(s: State, p: GiantPlant, r: string|undefined) {
  const g = s.giant, R = GT.rituals;
  switch (r) {
    case 'talk': {
      if (!hasFruit(p)) return false;
      const n = Math.max(1, weekOf(p, s.clock.day));
      let k = 0; for (let w = 0; w < n; w++) if (g.talks[w]) k++;
      return k / n >= R.weeks;
    }
    case 'hat': return !!p.hat;
    case 'moon': return p.moon != null && p.moon <= R.moonWindow;
    case 'radio': return p.days.set > 0 && p.days.radio / p.days.set >= R.radioDays;
    case 'secret': return !g.crier?.told;
  }
  return false;
}
export const ritualsKept = (s: State, p: GiantPlant = s.giant) => Object.fromEntries(RITUALS.map((r) => [r, ritualKept(s, p, r)]));
function secretMul(s: State, p: GiantPlant, effect: Effect) {
  const sec = secretOf(s);
  return sec.effect === effect && ritualKept(s, p, sec.ritual) ? GT.secret[effect] : 1;
}
const moonOffset = (s: State) => hash32(s.seed, s.clock.year, 'moon') % 30;
export function moonInfo(s: State, d = s.clock.day) {
  const off = moonOffset(s), from = daysFromFull(d, off);
  return { phase: round3(moonPhase(d, off)), fromFull: Math.round(from * 10) / 10, full: from <= GT.rituals.moonWindow };
}

// ------------------------------------------------------------ hidden weight (density) and measuring
function updateSecret(s: State, p: GiantPlant) {
  const R = GT.rho, sec = p.secret, n = p.days.set || 1;
  let rho = 1 + R.den * (gen.phenotype(p.genome).den - 3) + R.offset + R.kelp * p.days.kelp / n + R.heavy * p.days.heavy / n + R.sd * sec.rhoZ;
  const se = secretOf(s);
  if (se.effect === 'rho' && ritualKept(s, p, se.ritual)) rho += GT.secret.rho;
  sec.rho = Math.round(rho * 10000) / 10000;
  sec.wTrue = round2(p.wc * sec.rho);
}
// The tape: OTT_true x (1 + N(0, 0.6%)) (fancy tape 0.2%), rounded to 0.5"; noise keyed by day so re-measuring the
// same day reads the same and measuring never moves the giant's own dice.
// The error is mostly a slow drift (how you hold the tape this week) plus a little daily jitter, so day-to-day deltas
// read as growth rather than noise while each reading still has the design's 0.6% error.
export function tape(s: State, p: GiantPlant, d = s.clock.day) {
  const z = (k: string|number|boolean|null|undefined, tag: string|number|boolean|null|undefined) => gauss(makeRng(hash32(s.seed, s.clock.year, k, p.plot, tag)));
  const w = Math.floor(d / 7), f = (d % 7) / 7, drift = (z(w, 'tapeWeek') * (1 - f) + z(w + 1, 'tapeWeek') * f) / Math.hypot(1 - f, f);
  const noise = has(s, 'tape') ? T.shop.tape.noise : GT.ott.noise, e = GT.ott.drift * drift + Math.sqrt(1 - GT.ott.drift ** 2) * z(d, 'ott');
  const ott = Math.max(GT.ott.round, Math.round(ottOf(p.wc) * (1 + noise * e) / GT.ott.round) * GT.ott.round);
  return { ott, est: Math.round(chartOf(ott)) };
}
// ---- the weigh-off slice's view of her (see header)
export const entries = (s: State) => plants(s).filter((p) => alive(p));
export const publishedEstimate = (s: State, p: GiantPlant = s.giant) => p.est || tape(s, p).est;
export const chartEstimate = (s: State, p: GiantPlant = s.giant) => tape(s, p, WEIGHOFF).est;
export const trueWeight = (s: State, p: GiantPlant = s.giant) => Math.round(p.secret.wTrue);
export const hiddenCavity = (p: GiantPlant) => p.split === 'crack' && p.secret.cavityU < (p.treated ? GT.treat.treated : GT.treat.cavity);
export function addScar(_s: State, p: GiantPlant, cause: keyof GiantScarsBy, n = 1) { p.scarsBy[cause] = (p.scarsBy[cause] || 0) + n; p.scars += n; }
export function markMustache(_s: State, p: GiantPlant) { p.mustache = true; }
export function recordResult(_s: State, p: GiantPlant, r: { W: number|null; place: number|null; exhibition: boolean; dq: boolean; pct: number|null; pretty?: number|null; fallback?: boolean; }) { p.result = { ...r }; }
// [C] telling the Crier fills the first weekends: the buzz is there for W1 (set on the day you tell) and held up through W1's
// close for W2, then it fades like any buzz. More folks early, so have pumpkins for them.
export function crierEffects(s: State) {
  const c = s.giant?.crier, C = GT.crier, told = !!c?.told, early = s.clock.day < (weekends()[C.buzzWeekends - 1]?.sun ?? Infinity);
  return { told, est: c?.est ?? null, buzzFloor: told && early ? C.buzz : 0, gawkMul: told ? 1 + C.gawk : 1, gawkSat: C.gawkSat, gawkEst: C.gawkEst, heist: told ? C.heist : 0 };
}
export const heistInterest = (s: State) => crierEffects(s).heist + (fishIn(s.giant?.feed) ? GT.fishHeist : 0);
// STAND-IN until the weigh-off slice publishes rivals' boasts (weighoff.crierBoasts(s)): design §8 W0 (1 + g)^(y-1) with
// noise, Big Tom +20%, Vance accurate, Hoot +5%, Mavis won't say, Vale -5%.
const BOASTERS = ['tom', 'vance', 'hoot', 'mavis', 'vale'] as const;
export function rivalBoasts(s: State, ctx: Ctx) {
  const real = ctx?.mod?.('weighoff')?.crierBoasts?.(s);
  if (real) return real;
  return BOASTERS.flatMap((id) => {
    const R = T.rivals[id], W = gen.rivalStandIn(s, id, s.clock.year);
    return [{ id, name: R.name, est: R.boast == null ? null : Math.round(W * (1 + R.boast)) }];
  });
}

// ------------------------------------------------------------ the season's steps
function payFeed(s: State, ctx: Ctx) {
  const g = s.giant;
  if (plants(s).every((p) => p.split === 'blowout')) { g.fedToday = 'none'; return; }   // nobody left to feed
  let feed = g.feed;
  if (g.kelpFree > 0) feed = feed === 'fish' || feed === 'both' ? 'both' : 'kelp';
  // feed switched off for want of cash comes back on by itself once there's a week of it in the tin
  if (g.feed === 'none' && g.feedWanted && canAfford(s, feedCost(g.feedWanted) * GT.feedResumeDays)) {
    g.feed = g.feedWanted; g.feedWanted = null;
    if (g.kelpFree <= 0) feed = g.feed;
    ctx.emit({ type: 'toast', text: fill(GL.feedBack, { feed: own(GL.feedName, g.feed) }), cls: 'good' });
  }
  let cost = feedCost(g.feed);
  if (g.kelpFree > 0) cost = fishIn(feed) ? GT.feed.fish.cost : 0;
  if (cost > 0) {
    if (!canAfford(s, cost)) { g.feedWanted = g.feed; g.feed = 'none'; feed = g.kelpFree > 0 ? 'kelp' : 'none'; ctx.emit({ type: 'toast', text: GL.feedOff, cls: 'warn' }); }
    else ctx.money(-cost, 'feed');
  }
  g.fedToday = feed;
}
function refill(s: State, ctx: Ctx, p: GiantPlant) {
  const g = s.giant, soaker = has(s, 'soaker');
  const before = p.m, cap = soaker ? GT.soakerRefill : GT.regime.maxRefill;
  p.m = clamp(p.m + Math.min(cap, Math.max(0, target(g.regime) - p.m)) + (s.weather.rain ? GT.moisture.rain : 0), 0, 1);
  if (!soaker || s.weather.rain) checkSwing(s, ctx, p);
  return p.m - before;
}
// A rise of more than 0.25 over the last three days is a swing: stress x3 for three days.
function checkSwing(_s: State, ctx: Ctx, p: GiantPlant) {
  const low = Math.min(...p.mHist.slice(-GT.swing.days), p.m);
  if (p.m - low > GT.swing.rise && p.swing <= 0) {
    p.swing = GT.swing.days;
    ctx.emit({ type: 'giant/swing', plot: p.plot });
    return true;
  }
  return false;
}
function stageStep(s: State, ctx: Ctx, p: GiantPlant, d: number) {
  const g = s.giant;
  if (p.stage === 'started' && p.germDay != null && d >= p.germDay) {
    if (p.failed) promoteBackup(s, ctx, p, d);
    else { p.stage = 'sprout'; ctx.emit({ type: 'giant/germinated', plot: p.plot }); }
  }
  const cables = has(s, 'cables') ? GT.cablesDays : 0;
  if (p.stage === 'sprout' && d >= Math.max(g.moving?.day ?? D(GT.transplant) - cables, (p.germDay ?? 0) + 3)) transplant(s, ctx, p, d, cables);
  if (p.stage === 'seedling' && p.vineDay != null && d >= p.vineDay) p.stage = 'vine';
  if (p.stage === 'vine' && p.flowerDay != null && d >= p.flowerDay) {
    p.stage = 'flower'; p.cardDay = d + 1;
    const [lo, hi] = GT.vigorHint;
    p.vigorHint = p.secret.vigor > hi ? 'vigorous' : p.secret.vigor < lo ? 'so-so' : 'steady';
    ctx.emit({ type: 'giant/flower', plot: p.plot });
    if (p.plot === 1) movingReceipt(s, ctx);
  }
}
// ------------------------------------------------------------ [C] Moving Day (plan §3.11, rulings R7): out to her corner
// She goes out on the morning the player picked from Hal's forecast (Gran's card, May 1). That morning's ACTUAL fog sets how
// long she sulks before she roots: 1 day clear, 3 patchy, 5 foggy (T.giant.moving.rootDays). Sulking days grow nothing and
// push her first flower back (rootDays + flowerShift: -1, +1 or +3 days); her potential moves by sulkPot a day either side of
// T.giant.moving.pivot (a clear move is a head start, a foggy one a setback). The player sees it: she droops under the hoop
// house and Gran fusses every morning, or she perks up with a new leaf the next morning.
export const rootDaysFor = (f: number) => (GT.moving.rootDays.find(([lim]) => f < lim) ?? GT.moving.rootDays[2])[1];
function transplant(s: State, ctx: Ctx, p: GiantPlant, d: number, cables: number) {
  const g = s.giant, rng = ctx.rng('giant'), f = s.weather.f, root = g.moving ? rootDaysFor(f) : 1;
  p.stage = 'seedling'; p.transplantDay = d; p.rootedDay = d + root; p.vineDay = d + root - 1 + GT.vineAfter;
  p.secret.vigor = Math.exp(GT.vigorSd * gauss(rng)) * (1 - GT.moving.sulkPot * (root - (g.moving ? GT.moving.pivot : 1)));
  const [fd, j] = GT.firstFlower;
  p.flowerDay = Math.max(d + GT.minFlowerAfter, D(fd) + int(rng, -j, j) - cables) + (g.moving ? root + GT.moving.flowerShift : 0);
  p.m = target(g.regime);
  if (p.plot === 1 && g.moving) {
    // foggier than Hal said? (the band she rooted in is worse than the one his number pointed at)
    Object.assign(g.moving, { f, rootDays: root, rootedDay: p.rootedDay, foggier: root > rootDaysFor(g.moving.fc ?? f) });
    ctx.mod('firsts')?.mark?.(s, ctx, 'moved');
    if (g.moving.foggier) ctx.moment({ id: `moving:hal:${s.clock.year}`, kind: 'moment', prio: T.moments.prio.receipt, maxWaitDays: 7, say: CL.moving.hal });
  }
  ctx.emit({ type: 'giant/transplant', plot: p.plot, rootDays: root, rootedDay: p.rootedDay, sulk: root > 1 });
}
// Moving Day's receipt lands at her first flower (plan §6 C): a toast in Gran's words, so it takes no window of its own (the
// dawn's receipt is due days later and the foundation allows one a week). Filed in the Notebook either way.
function movingReceipt(s: State, ctx: Ctx) {
  const g = s.giant, m = g.moving;
  if (!m?.rootDays || filed(g).moving) return;
  g.receipts.moving = s.clock.day;
  const shift = m.rootDays + GT.moving.flowerShift, F = CL.moving.flower, worst = GT.moving.rootDays[2][1];
  const n = Math.abs(shift) === 1 ? 'a day' : `${Math.abs(shift)} days`;
  const text = fill(shift < 0 ? F.early : shift === 0 ? F.even : m.rootDays >= worst ? F.fog : F.late, { n });
  if (receiptFresh(s, text)) { ctx.emit({ type: 'toast', text, cls: shift < 0 ? 'good' : 'info' }); receiptSaid(s, text); }
  logChoice(s, 'receipt:moving', text);
}
// the mornings after the move: a clear one shows a new leaf; a sulky one droops, and Gran fusses until she roots
function rootingStep(s: State, ctx: Ctx, p: GiantPlant, d: number) {
  if (p.plot !== 1 || p.transplantDay == null || p.rootedDay == null || d <= p.transplantDay || d > p.rootedDay) return;
  if (d === p.rootedDay) { ctx.emit({ type: 'giant/rooted', plot: p.plot, leaf: true, sulked: p.rootedDay - p.transplantDay > 1 }); return; }
  ctx.emit({ type: 'giant/sulk', plot: p.plot, left: p.rootedDay - d, text: ctx.fresh('giant.fuss', CL.moving.fuss, makeRng(hash32(s.seed, s.clock.year, d, 'fuss'))) ?? '' });
}
// The card: this morning (its fog is known) and the next two (Hal's forecast, give or take). Each option says, in words,
// how she'd likely root; the numbers come from the forecast and T, so the card can't promise what the weather won't give.
const normCdf = (z: number) => { const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), e = Math.exp(-(z * z) / 2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * e; return z >= 0 ? (1 + y) / 2 : (1 - y) / 2; };
export function rootOdds(f: number, sd = 0) {
  const R = GT.moving.rootDays, out: [number, number][] = [];
  let below = 0;
  for (const [lim, days] of R) {
    const p = lim === Infinity ? 1 : sd > 0 ? normCdf((lim - f) / sd) : f < lim ? 1 : 0;
    out.push([days, Math.max(0, p - below)]); below = Math.max(below, p);
  }
  return out;
}
interface MovingOption { id: string; label: string; sub: string; day: number; f: number; sd: number }
function movingOptions(s: State) {
  const d = s.clock.day, fc = s.weather.forecast || [], M = CL.moving, out: MovingOption[] = [];
  for (let k = 0; k < GT.moving.offer; k++) {
    const x = k === 0 ? { day: d, f: s.weather.f, sd: 0 } : fc[k - 1];
    if (!x) break;
    const when = fill(M.when[Math.min(k, M.when.length - 1)] ?? '', { dow: dowName(x.day, true) });
    const label = fill(k === 0 ? M.today : M.ahead, { when, word: fogWord(x.f), pct: Math.round(x.f * 100), sd: Math.round((x.sd || 0) * 100) });
    out.push({ id: String(k), label, sub: consequence(s, 'moving', { f: x.f, sd: x.sd || 0 }), day: x.day, f: x.f, sd: x.sd || 0 });
  }
  return out;
}
function movingCard(s: State, ctx: Ctx) {
  const opts = movingOptions(s);
  ctx.card({ kind: 'moving', data: { title: CL.moving.title, eyebrow: CL.moving.eyebrow, speaker: 'gran', text: CL.moving.text,
    choices: opts.map(({ id, label, sub }) => ({ id, label, sub })), defaultChoice: '0', days: opts.map((o) => o.day), fc: opts.map((o) => o.f) } });
}
function promoteBackup(s: State, ctx: Ctx, p: GiantPlant, d: number) {
  const seed = gen.autoPick(s, []);
  gen.takeSeed(s, seed.id);
  Object.assign(p, { seed: { id: seed.id, short: seed.short, name: seed.name, source: seed.source }, genome: seed.genome, F: seed.genome.F,
    het: !!seed.genome.het, failed: false, stage: 'started', startDay: d, germDay: d + GT.germDays });
  const ph = gen.phenotype(seed.genome);
  Object.assign(p, { color: ph.colour, shape: ph.shape, stripe: ph.stripe, evenness: round3(ph.evenness) });
  ctx.say('gran', [GL.germFail]);
}
// ------------------------------------------------------------ [C] the germination block (rulings R0, R18)
// Starting the seed: three plain taps on her sheet in year 1 (lid, nick, mat), or Gran on Apr 8. `file` is the number of
// strokes a filing close-up counted (a later wave's tin ritual): a good nick (T.giant.tinFile.good) is up a day early, an
// over-filed seed (>= over) a day late; no count (the plain taps, Gran, a bot) is the usual germDays.
const fileShift = (file: number|null) => (file == null ? 0 : file >= GT.tinFile.over ? 1 : file >= GT.tinFile.good[0] && file <= GT.tinFile.good[1] ? -1 : 0);
function startSeeds(s: State, ctx: Ctx, file: number|null = null) {
  const d = s.clock.day, rng = ctx.rng('giant');
  for (const p of plants(s)) {
    if (p.stage !== 'tin') continue;
    gen.takeSeed(s, p.seed.id);
    p.stage = 'started'; p.startDay = d;
    // Germination 95%; a failure promotes the backup 4 days later. Year 1 is scripted to succeed.
    p.failed = s.clock.year > 1 && !chance(rng, GT.germination);
    p.germDay = d + (p.failed ? GT.backupDelay : Math.max(1, GT.germDays + fileShift(file)));
  }
  ctx.emit({ type: 'giant/start' });
}
const queued = (s: State, kind: CardKind, plot?: number) => s.story.cards.some((c) => c.kind === kind && (plot === undefined || ('plot' in c.data && c.data.plot === plot)));
function dawnStep(s: State, ctx: Ctx, p: GiantPlant, d: number) {
  if (p.stage === 'flower' && p.cardDay != null && d >= p.cardDay && !queued(s, 'pollinate', p.plot)) {
    if (s.clock.year === 1 && s.story.beats['giant.pollinate'] === undefined) return;   // Old Moss introduces it first
    if (p.dawn >= GT.beesAfterDawns || p.fails >= GT.maxSetFails) { setFruit(s, ctx, p, { kind: 'open', name: 'open' }, true); return; }
    pollinateCard(s, ctx, p);
  }
  if (p.stage === 'set' && p.cullDay != null && d >= p.cullDay && !queued(s, 'cull', p.plot)) {
    if (s.clock.year === 1 && p.plot === 1 && s.story.beats['giant.cull'] === undefined) return;
    cullCard(s, ctx, p);
  }
}

// ------------------------------------------------------------ cards
// [C] The dawn (plan §3.12, rulings R5): the bees come out by the fog, and the card shows how many. Let the bees (open), your
// own paws (self; a cross or a sib in years 2+ is by paw too) or not today (wait). Year 1 says no odds: the bee count is the
// stakes. Years 2+ add the odds and the father (bees bring fresh blood, paws keep the line).
export const beesOut = (f: number) => (f < GT.set.beesOutF ? GT.set.beesShown[0] : Math.max(1, Math.round(GT.set.beesShown[0] * GT.set.beesShown[1])));
export const setChanceOf = (f: number, choice: string) => (choice === 'open' ? (f < GT.set.beesOutF ? GT.set.bees.clear : GT.set.bees.fog) : GT.set.paws);
interface Father { id: string; label: string; sub: string; W?: number }
function fathers(s: State, p: GiantPlant) {
  const DL = CL.dawn, out: Father[] = [{ id: 'open', label: DL.bees, sub: consequence(s, 'dawn', 'open') }, { id: 'self', label: DL.paws, sub: consequence(s, 'dawn', 'self') }];
  for (const pk of s.genetics.pollen) out.push({ id: `cross:${pk.id}`, label: line(s, GC.cross[0] ?? '', { pack: pk.name }), sub: consequence(s, 'dawn', 'cross'), W: pk.W });
  const o = p.plot === 1 ? s.giant.plot2 : s.giant;
  if (o && o.stage !== 'tin' && o.flowerDay != null && o.seed.short === p.seed.short) out.push({ id: 'sib', label: GC.sib[0] ?? '', sub: consequence(s, 'dawn', 'cross') });
  return out;
}
function pollinateCard(s: State, ctx: Ctx, p: GiantPlant) {
  const f = s.weather.f, bees = beesOut(f), moon = moonInfo(s), F = fathers(s, p), DL = CL.dawn;
  const last = p.dawn >= GT.beesAfterDawns - 1;
  const best = F.flatMap((x) => (x.W ? [{ id: x.id, W: x.W }] : [])).sort((a, b) => b.W - a.W)[0];
  const choices = [...F.map(({ W, ...c }) => c), { id: 'wait', label: DL.wait, sub: last ? DL.lastSub : consequence(s, 'dawn', 'wait') }];
  const first = p.dawn === 0 && !p.fails;
  ctx.card({ kind: 'pollinate', data: {
    plot: p.plot, title: GC.dawn, eyebrow: line(s, GC.pollinateEyebrow, { n: p.dawn + 1, max: GT.beesAfterDawns }), speaker: 'moss',
    text: (s.clock.year > 1 && first ? DL.moss[0] + ' ' : '') + (first ? DL.text : DL.textAgain),
    aside: moon.full ? DL.moonFull : fill(DL.moon, { n: Math.max(1, Math.round(moon.fromFull)) }),
    dawn: p.dawn + 1, fog: f, foggy: bees < GT.set.beesShown[0], bees, setChance: setChanceOf(f, 'open'), chances: { open: setChanceOf(f, 'open'), paws: GT.set.paws },
    moon, choices, defaultChoice: best ? best.id : 'open',
    } });
}
interface FatherPick { kind: string; name: string; genome?: Genome; line?: string; pack?: string }
function fatherFor(s: State, p: GiantPlant, choice: string): FatherPick {
  // [C] year 1's "your own paws" brushes pollen from the patch's other flowers: the line (self) is a year-2 choice (plan §3.12)
  if (choice === 'self' && s.clock.year === 1) return { kind: 'open', name: 'paws' };
  if (choice === 'self') return { kind: 'self', name: 'self' };
  if (choice === 'sib') { const o = p.plot === 1 ? s.giant.plot2 : s.giant; return o ? { kind: 'sib', name: 'sib', genome: o.genome } : { kind: 'open', name: 'open' }; }
  if (choice.startsWith('cross:')) {
    // the other plot's card may have used this pack first (both cards can be up at once): take the best one left
    const pk = s.genetics.pollen.find((x) => x.id === choice.slice(6)) || s.genetics.pollen.slice().sort((a, b) => b.W - a.W)[0];
    if (pk) return { kind: 'cross', name: pk.name, line: pk.line, genome: pk.genome, pack: pk.id };
  }
  return { kind: 'open', name: 'open' };
}
function setFruit(s: State, ctx: Ctx, p: GiantPlant, father: FatherPick, bees = false) {
  const d = s.clock.day, rng = ctx.rng('giant'), g = s.giant;
  if (father.pack) s.genetics.pollen = s.genetics.pollen.filter((x) => x.id !== father.pack);
  const { pack, ...fa } = father;
  Object.assign(p, { setDay: d, t: 0, stage: 'set', father: fa, hat: !!g.hat, moon: moonInfo(s, d).fromFull, cullDay: d + GT.cullAfter });
  const P = GT.preSet, n = Math.max(1, p.pre.days);
  const preSet = P.base + P.water * p.pre.good / n + P.kelp * p.pre.kelp / n;
  p.secret.potEff = gen.potentialEff(p.genome) * p.secret.vigor * preSet * (has(s, 'cables') ? GT.cablesPot : 1);
  p.secret.rhoZ = gauss(rng);
  p.secret.cavityU = next(rng);
  ctx.emit({ type: 'giant/set', plot: p.plot, father: fa.kind });
  const how = fa.name === 'paws' ? 'Your own paws did it' : own({ open: "The Cove's bees did the rest", self: 'Her own pollen', sib: 'Her sister did the honours', cross: `${fa.name} pollen` }, fa.kind) ?? '';
  // the first time, the SHE TOOK! banner says it (firsts.js); later years keep the toast
  if (s.firsts?.career?.took) ctx.emit({ type: 'toast', text: bees ? GL.bees : line(s, GL.took, { father: how }), cls: 'good' });
  ctx.emit({ type: 'sound', name: 'plink' });
}
function cullCard(s: State, ctx: Ctx, p: GiantPlant) {
  const rng = ctx.rng('giant'), g = s.giant;
  let twins = false;
  if (chance(rng, CAT.twin_fruit.chance)) twins = fireNow(s, ctx, 'twin_fruit');
  const opt = (id: string, [label = '', sub]: readonly string[]) => ({ id, label, sub });
  const choices = [opt('safe', GC.safe), opt('stump', GC.stump), opt('round', GC.round)];
  if (twins) choices.push(opt('twins', GC.twinsC));
  const names = shuffle(rng, LINES.giantNames.filter((n) => n !== g.history.at(-1)?.name));
  ctx.card({ kind: 'cull', data: { plot: p.plot, title: GC.cull, eyebrow: GC.cullEyebrow, speaker: 'vance', text: s.clock.year > 1 || p.plot === 2 ? LINES.vance.cull : null,
    choices, defaultChoice: 'safe', names, nameMax: GT.nameMax, twins, color: p.color, shape: p.shape } });
}
function crierCard(s: State, ctx: Ctx) {
  const p = mainAlive(s);
  if (!p) return;
  const last = p.measures.at(-1), est = last && s.clock.day - last.day <= 7 ? p.est : tape(s, p).est;
  const boasts = rivalBoasts(s, ctx);
  ctx.card({ kind: 'crier', data: { title: GC.crier, eyebrow: GC.crierEyebrow, speaker: 'edna', text: LINES.edna.crier, judges: GC.judges, est,
    boasts, choices: [{ id: 'tell', label: line(s, CL.crier.tell[0] ?? '', { est: estText(est) }), sub: consequence(s, 'crier', 'tell') },
      { id: 'secret', label: CL.crier.secret[0] ?? '', sub: consequence(s, 'crier', 'secret') }],
    defaultChoice: 'secret' } });
}
// "est. 1,2?? lb": hundreds shown; the last two digits are always ?? (the hidden-weight motif)
export function estText(est: number | null | undefined) {
  if (est == null || !(est > 0)) return 'est. ???? lb';
  if (est < 100) return 'est. under 100 lb';     // Edna's first tape (Aug 1) should still read as a number
  const h = String(Math.floor(est / 100));
  return `est. ${h.length > 1 ? h.slice(0, -1) + ',' + h.slice(-1) : h}?? lb`;
}

// ------------------------------------------------------------ creaks and splits (two-stage, always telegraphed)
function startCreak(s: State, ctx: Ctx, p: GiantPlant, d: number, practice = false, soft = false) {
  p.creaking = true; p.creakDays = 0; p.practice = practice;
  if (soft) p.softSpot = true;
  p.creaks.push({ day: d, end: null, outcome: null, practice, soft });
  ctx.emit({ type: 'giant/creak', plot: p.plot, practice, soft });
  ctx.alert('creak', { kind: 'creak', cls: 'warn', speaker: 'moss' });          // the UI announces it (giant/creak)
  if (p.plot === 1 && !soft) fileReceipt(s, ctx, { which: 'cull', creaked: true });    // [C] Vance's receipt: her first creak
}
function endCreak(p: GiantPlant, d: number, outcome: string) {
  p.creaking = false; p.practice = false; p.softSpot = false;
  const c = p.creaks.at(-1);
  if (c && !c.outcome) { c.end = d; c.outcome = outcome; }
}
function heal(s: State, ctx: Ctx, p: GiantPlant, d: number) {
  const practice = p.practice, g = s.giant;
  endCreak(p, d, 'healed');
  ctx.emit({ type: 'giant/heal', plot: p.plot });
  // [C] the dial's receipt rides the heal itself (rulings R9: at the visible event, no extra window)
  const dial = !practice && (s.unlocks.dial || s.clock.year > 1) ? own(CL.heal, g.regime) ?? null : null;
  ctx.emit({ type: 'toast', text: line(s, practice ? GL.practiceHealed : dial || GL.healed, { name: p.name || 'She' }), cls: 'good' });
  ctx.goalDone('creak');
}
function split(s: State, ctx: Ctx, p: Fruiting, d: number) {
  const rng = ctx.rng('giant'), blow = chance(rng, GT.split.blowout), t = d - p.setDay;
  endCreak(p, d, 'split');
  p.split = blow ? 'blowout' : 'crack'; p.splitDay = d;
  if (blow) { p.seedsOk = t >= GT.split.seedsAfter; }
  else { p.cracked = true; addScar(s, p, 'crack', GT.split.crackScars); }
  ctx.emit({ type: 'giant/split', plot: p.plot, kind: p.split });
  ctx.say('moss', [blow ? GL.blowout : GL.crack]);
  if (d >= D('Aug 15')) ctx.story('heartbreak', LINES.crier.heartbreak.score, { NAME: (p.name || 'her').toUpperCase(), N: WEIGHOFF - d, blowout: blow });
  ctx.goalLapse('creak', false);                 // not a "Done": Old Moss has the words
}
function creakStep(s: State, ctx: Ctx, p: GiantPlant, d: number, st: number, ratio: number) {
  const rng = ctx.rng('giant'), C = GT.creak;
  if (!alive(p) || p.split) return;
  if (p.creaking) {
    p.creakDays++;
    const x = Math.min(1, st);
    let pSplit = C.split[0] + C.split[1] * x, pHeal = C.heal[0] - C.heal[1] * x;
    if (p.practice) { pSplit = 0; pHeal = p.creakDays >= GT.practice.maxDays ? 1 : Math.max(pHeal, GT.practice.heal); }
    // year 1: the first creak is a lesson; it cannot split before Old Moss has explained creaks
    if (s.clock.year === 1 && s.story.beats['giant.creak'] === undefined) pSplit = 0;
    const u = next(rng);
    if (u < pSplit) split(s, ctx, p, d);
    else if (u < pSplit + pHeal) heal(s, ctx, p, d);
    return;
  }
  if (d - p.setDay < C.fromT) return;
  if (s.clock.year === 1 && s.story.beats['giant.shade'] === undefined) return;     // year 1: one new system at a time
  const u = next(rng);
  // year 1: Old Moss explains the first creak the morning after it starts, so it starts only when that lesson keeps
  // the 25 s intro gap (a creak the night after the shade intro or the kelp wash-up would stack two lessons)
  if (s.clock.year === 1 && s.story.beats['giant.creak'] === undefined && !creakLessonFits(s, d)) return;
  if (u < C.base * ratio * ratio * st * secretMul(s, p, 'creak')) startCreak(s, ctx, p, d);
}

// Tonight's creak would be explained tomorrow morning: is that an intro gap after the last intro, and clear of the kelp?
function creakLessonFits(s: State, d: number) {
  const last = s.story.lastIntro1x, chat = s.story.lastChatter1x, kelp = s.events.last.kelp, at = s.clock.clock1x + secondsPerDay(d);
  if (last != null && at - last < T.story.introGap1x - 1e-9) return false;
  if (chat != null && at - chat < T.story.chatterGap1x) return false;       // a tip or the honey toast just now
  return !(kelp && kelp.y === s.clock.year && at - kelp.t < T.story.chatterGap1x);
}

// ------------------------------------------------------------ overnight: growth, moisture, creaks, scald, soft spots
function night(s: State, ctx: Ctx, p: GiantPlant, d: number) {
  const g = s.giant, f = s.weather.f, heat = !!s.weather.heat, rng = ctx.rng('giant'), feed = feedOf(s);
  if (p.transplantDay == null) return;
  let gain = 0;
  if (alive(p)) {
    const t = d - p.setDay;
    const Q = cWater(p.m) * feedRow(feed).mul * cLight(f, heat, g.shade) * (1 + GT.qNoise * gauss(rng));
    gain = p.secret.potEff * (Lf(t + 1) - Lf(t)) * slowdown(d) * Q * (p.cracked ? GT.cracked : 1) * (p.stemCrack ? GT.rotate.growth : 1)
      * (isActive(s, 'quarter_sun') ? CAT.quarter_sun.growth : 1) * secretMul(s, p, 'growth');
    gain = Math.max(0, gain);
    p.wc = round2(p.wc + gain); p.gain = round2(gain); p.t = t + 1;
    p.days.set++;
    if (kelpIn(feed)) p.days.kelp++;
    if (g.regime === 'heavy') p.days.heavy++;
    if (g.radio) p.days.radio++;
    if (gain > 0) ctx.emit({ type: 'giant/grow', plot: p.plot, gain: Math.round(gain) });
  } else if (p.setDay == null) {
    p.pre.days++;
    if (p.m >= GT.goodWater[0] && p.m <= GT.goodWater[1] && p.swing <= 0) p.pre.good++;
    if (kelpIn(feed)) p.pre.kelp++;
  }
  const peak = p.secret.potEff > 0 ? p.secret.potEff * GT.logistic.k / GT.peakDiv : 1;
  const ratio = alive(p) ? gain / peak : 0;
  const st = stressOf(s, p);
  p.stressHist = [...p.stressHist.slice(-7), round3(st)];
  if (alive(p)) {
    creakStep(s, ctx, p, d, st, ratio);
    // sunscald: from Aug 1, shade down on a clear or heat-wave day (x2 on a Quarter Sun Day), at most 3 marks
    const S = GT.shade;
    if (!g.shade && d >= D(S.scaldFrom) && (heat || f < T.weather.effects.sunscaldF) && p.scarsBy.sunscald < S.maxScald && !p.split
      && chance(rng, S.sunscald * (isActive(s, 'quarter_sun') ? CAT.quarter_sun.sunscald : 1))) {
      addScar(s, p, 'sunscald', 1);
      if (heat && g.wave && p.plot === 1) g.wave.scalds++;                   // [C] for Hal's receipt when the heat breaks
      ctx.emit({ type: 'giant/scald', plot: p.plot });
      ctx.emit({ type: 'toast', text: line(s, GL.scald, { name: p.name || 'Her' }), cls: 'warn' });
    }
    // a soft spot while she sits in October: treated like a creak (telegraphed, and the Treat button clears it)
    if (!p.creaking && !p.split && d >= D(GT.softSpot.from) && chance(rng, GT.softSpot.rate)) startCreak(s, ctx, p, d, false, true);
  }
  // giant moisture overnight: m -= 0.06 + 0.10 (1 - f) + 0.05 gain/peak + 0.08 heat
  const M = GT.moisture;
  p.mHist = [...p.mHist.slice(-(GT.swing.days - 1)), round3(p.m)];
  p.m = round3(clamp(p.m - (M.base + M.sun * (1 - f) + M.growth * ratio + M.heat * (heat ? 1 : 0)), 0, 1));
  if (p.swing > 0) p.swing--;
  updateSecret(s, p);
}

// ------------------------------------------------------------ Old Moss's tips (from real hidden state)
function mistimedRow(s: State) {
  const rows = s.patch?.rows || [], d = s.clock.day, w1 = D('Oct 3'), w4 = D('Oct 25');
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.variety == null) continue;
    const V = own(T.varieties, row.variety);
    if (!V || row.plantedDay == null || !(row.progress < V.dtm)) continue;
    const ripe = d + (V.dtm - row.progress) / 0.8;
    if (ripe + V.prime < w1) return { row: r + 1, early: true };
    if (ripe > w4) return { row: r + 1, early: false };
  }
  return null;
}
// [A] Every pool is a no-repeat pick (story.fresh, plan §3.1): the originals (story.js LINES.tips) plus lines-mischief.js's
// MOSS, keyed by topic, so Old Moss never says the same line twice in a row and a pool is used up before a line comes round
// again, across years. The hidden-state logic is unchanged: some tips are a week late, some are wrong.
type TipKey = 'tense' | 'easy' | 'tenseLate' | 'easyLate' | 'dense' | 'airy';
type Topic = 'stress' | 'rho' | 'ritual' | 'row' | 'lore' | 'notice' | 'mood';
const tipPool = (key: TipKey) => [...LINES.tips[key], ...MOSS[key]];
function tipText(s: State, rng: Rng, topic: Topic, mode: string, p: GiantPlant, row: { row: number; early: boolean; }|null) {
  const TP = LINES.tips, sec = secretOf(s);
  const wrong = mode === 'wrong', pk = (key: string, list: readonly FreshEntry[]): string => fresh(s, rng, `moss.${key}`, list) ?? '';
  if (topic === 'stress') {
    const now = p.stressHist.at(-1) ?? 0, then = p.stressHist[0] ?? now, x = mode === 'late' ? then : now;
    const tense = (x > 0.45) !== wrong, key = mode === 'late' ? (tense ? 'tenseLate' : 'easyLate') : tense ? 'tense' : 'easy';
    return pk(key, tipPool(key));
  }
  if (topic === 'rho') { const key = ((p.secret.rho >= 1) !== wrong) ? 'dense' : 'airy'; return pk(key, tipPool(key)); }
  if (topic === 'ritual') {
    s.giant.tipRitual++;
    const right = chance(rng, GT.rituals.hintRight), r = right ? sec.ritual : pick(rng, RITUALS.filter((x) => x !== sec.ritual)) ?? sec.ritual;
    const base = own(TP.ritual, r);
    return pk(`ritual.${r}`, [...(base ? [base] : []), ...(own(MOSS.ritual, r) ?? [])]);
  }
  if (topic === 'row') {
    if (!row) return '';
    const key = row.early !== wrong ? 'rowEarly' : 'rowLate';
    return line(s, pk(key, [TP[key], ...MOSS[key]]), { row: row.row });
  }
  if (topic === 'lore') return pk('lore', MOSS.lore);
  if (topic === 'notice') return line(s, pk('notice', MOSS_NOTICE));
  s.giant.moodYear = s.clock.year;                       // Marlene's mood: once a year, from year 3
  const moods = Object.keys(LINES.moss.mood);
  return own(LINES.moss.mood, wrong ? pick(rng, moods.filter((m) => m !== s.weather.archetype)) : s.weather.archetype) ?? LINES.moss.mood.normal;
}
function mossTip(s: State, ctx: Ctx) {
  // its own stream: a tip that waits for a quiet moment (design §3) leaves the giant's growth exactly as it was
  const g = s.giant, rng = ctx.rng('chatter'), M = CAT.moss_tip, d = s.clock.day, p = mainAlive(s);
  markChatter(s);
  g.tipNext = d + int(rng, M.every[0], M.every[1]);
  const topics: Topic[] = [];
  if (p) topics.push('stress', 'rho');
  if (g.tipRitual < GT.rituals.hintsPerYear && p) topics.push('ritual', 'ritual');
  const row = mistimedRow(s);
  if (row) topics.push('row');
  // [A] Marlene's mood is a years-3+ line, at most once a year ("Marlene seems... herself" was said 44-48 times a career);
  // otherwise Old Moss remembers things, or notices the farm
  if (s.clock.year >= T.weather.archetypeFromYear && g.moodYear !== s.clock.year) topics.push('mood');
  topics.push('lore');
  if (MOSS_NOTICE.some((e) => e.when(s))) topics.push('notice');
  const u = next(rng), mode = u < M.now ? 'now' : u < M.now + M.late ? 'late' : 'wrong';
  const text = tipText(s, rng, pick(rng, topics), mode, p || g, row);
  // he dozes off mid-line now and then, never on a short one (plan §3.1: "Marlene seems...... zzz.")
  if (text.length >= 40 && chance(rng, M.doze)) {
    const cut = Math.max(10, Math.floor(text.length * 0.45)), at = text.lastIndexOf(' ', cut);
    ctx.say('moss', [text.slice(0, at > 0 ? at : cut) + LINES.tips.doze]);
    g.tipPending = { day: d + M.dozeDays, text: `${LINES.tips.dozeEnd} ${text}` };
  } else ctx.say('moss', [text]);
}
// [A] Old Moss's tips go through the moments queue (mischief.js queues a 'tip' moment when one is due, rulings R2):
// tipDue says one is due; tipDoze finishes a line he dozed off in the middle of.
export function tipDue(s: State) {
  const g = s.giant;
  return s.clock.phase === 'grow' && !!g && s.clock.day >= g.tipNext && (s.events.year.moss_tip || 0) < CAT.moss_tip.cap
    && (s.clock.year > 1 || s.story.beats['giant.kelp'] !== undefined);
}
export function tipDoze(s: State, ctx: Ctx) {
  const g = s.giant;
  if (!g?.tipPending || s.clock.phase !== 'grow') return;
  ctx.say('moss', [g.tipPending.text]);
  g.tipPending = null;
}

// ------------------------------------------------------------ events owned here (design §10)
const inMonths = (s: State, months: string|string[]) => months.includes(monthOf(s.clock.day));
const afterBreak = (s: State) => { const y = s.weather.days[s.clock.day - 1]; return !!y && (y.rain || (y.heat && !s.weather.heat)); };
const EVENTS: NonNullable<SimModule['events']> = [
  { // kelp on the beach: tap within 2 days for a week of free kelp tea. Year 1's first one is scripted for Aug 18.
    id: 'kelp', cls: 'notable', per: 'day', cooldownDays: CAT.kelp.cooldown, capYear: CAT.kelp.cap,
    when: (s: State) => s.clock.phase === 'grow' && inMonths(s, CAT.kelp.months) && !!s.unlocks.feed && !!mainAlive(s) && !isActive(s, 'kelp')
      && !(s.clock.year === 1 && !s.events.year.kelp),     // year 1's first is the scripted one ([A] the otter's, mischief.js)
    rate: (s: State) => (afterBreak(s) ? CAT.kelp.breakRate : CAT.kelp.rate),
    // [A] the sea otter delivers every kelp bundle (plan §3.2 otter_kelp; render/mischief.js floats her in)
    text: (s: State) => fresh(s, makeRng(hash32(s.seed, s.clock.year, s.clock.day, 'kelp')), 'otter.kelp', ML.otter.kelp),
    fire(s: State, ctx: Ctx) {
      activate(s, { id: 'kelp', until: s.clock.day + CAT.kelp.tapDays, x: PLACES.kelp.x, z: PLACES.kelp.z });
      ctx.alert('kelp', { cls: 'event' });
    },
    tap(s: State, ctx: Ctx) {
      s.giant.kelpFree += CAT.kelp.freeDays;
      ctx.emit({ type: 'toast', text: GL.kelpTaken, cls: 'good' });
      ctx.emit({ type: 'sound', name: 'squish' });
      ctx.emit({ type: 'pop', x: PLACES.kelp.x, z: PLACES.kelp.z, color: 0x5d6b3a, n: 8 });
    },
  },
  { id: 'twin_fruit', cls: 'notable', per: 'day', capYear: 1, when: () => false, rate: () => 0 },           // rolled at the cull
  { id: 'record_day', cls: 'minor', per: 'day', cooldownDays: 4, when: () => false, rate: () => 0,         // fired by Measure
    // [A] Edna never prints the same record-day line twice in a row (plan §3.1: x8, a keyed no-repeat pick)
    text: (s: State) => { const r = s.giant.lastRecord; return line(s, r && r.days > 1 ? GL.recordDays : fresh(s, makeRng(hash32(s.seed, s.clock.year, s.clock.day, 'record_day')), 'edna.record', EDNA.record) ?? '', { lb: r?.lb, name: r?.name }); } },
  { id: 'dedication', cls: 'minor', per: 'day', capYear: 1, when: () => false, rate: () => 0,               // fired by the 10th talk
    text: (s: State) => line(s, LINES.events.dedication) },
  { id: 'mutation', cls: 'story', per: 'day', capYear: 1, when: () => false, rate: () => 0,                 // shown by August
    text: (s: State) => (s.giant.mutation === 'white' ? LINES.crier.mutation.text : GL.mutationStripe) },
  { // Old Moss's cryptic tips: every 18-30 days, 6 a year at most. [A] Fired only through the moments queue (mischief.js:
    // a 'tip' moment when tipDue), so a tip never lands on a lesson or another moment, and never starves behind them.
    id: 'moss_tip', cls: 'minor', per: 'day', quiet: true, capYear: CAT.moss_tip.cap,
    when: () => false,
    rate: () => 1,
    fire: (s: State, ctx: Ctx) => mossTip(s, ctx),
  },
];

// ------------------------------------------------------------ onboarding beats (design §3)
const beat = (id: string, order: number, when: Beat['when'], run: Beat['run'], extra: Partial<Beat> = {}): Beat => ({ id: `giant.${id}`, year: 1, order, when, run, ...extra });
const day = (s: State) => s.clock.day;
const BEATS: NonNullable<SimModule['beats']> = [
  beat('seed', 1, (s) => s.clock.phase === 'grow', (_s, ctx) => {
    ctx.unlock('giant');
    ctx.say('gran', LINES.gran.seed, { goal: { id: 'seed', target: { kind: 'station', id: 'giant', control: 'start' } }, glide: GLIDE });
  }),
  // [C] Moving Day replaces Gran's water lesson (plan §3.11): her card is the lesson (the forecast's first job)
  beat('moving', 3, (s) => day(s) >= D(Y1.moving) && s.giant.stage === 'sprout' && !s.giant.moving, (s, ctx) => {
    movingCard(s, ctx);
    s.story.replay['giant.moving'] = { speaker: 'gran', lines: [CL.moving.replay] };
  }, { at: Y1.moving }),
  // [C] kelp is Old Moss's first visit, on Jun 5 (order between patch.plant 5 and patch.water 6, as the dates fall)
  beat('kelp', 5.5, (s) => day(s) >= D(Y1.kelp) && s.giant.transplantDay != null, (_s, ctx) => {
    ctx.unlock('feed');
    ctx.say('moss', CL.kelp.map((l) => fill(l, { frac: fraction(GT.feed.kelp.mul - 1) })), { goal: { id: 'kelp', target: { kind: 'station', id: 'giant', control: 'feed' } }, glide: GLIDE });
  }, { at: Y1.kelp }),
  beat('pollinate', 7, (s) => s.giant.stage === 'flower', (s, ctx) => {
    ctx.say('moss', CL.dawn.moss, { glide: GLIDE });
    s.giant.cardDay = Math.max(s.giant.cardDay ?? 0, day(s) + 1);
  }, { at: (s: State) => s.giant.flowerDay ?? null }),       // known from the transplant: Old Moss's tips keep clear of it
  beat('cull', 8, (s) => s.giant.stage === 'set' && day(s) >= (s.giant.cullDay ?? 0), (s, ctx) => {
    ctx.say('vance', [LINES.vance.cull, GL.cullTomorrow], { glide: GLIDE });
    s.giant.cullDay = day(s) + 1;
  }, { at: (s: State) => (s.giant.stage === 'set' ? s.giant.cullDay ?? null : null) }),
  // (order 10, Edna's tape lesson, is the Vine Crawl now: crawl.js, the first tape in public on Aug 1)
  beat('shade', 11, (s) => day(s) >= D(Y1.shade), (_s, ctx) => {
    ctx.unlock('shade');                         // also lets Hal's heat-forecast alerts start (weather.js)
    ctx.say('hal', [LINES.hal.shade], { goal: { id: 'shade', target: { kind: 'station', id: 'giant', control: 'shade' } }, glide: GLIDE });
  }, { at: Y1.shade, pin: true }),                // Hal warns the day before the scripted heat (Aug 11-13)
  beat('creak', 12, (s) => day(s) > D(Y1.creak.after) && s.story.beats['giant.shade'] !== undefined && !!mainAlive(s)
    && (plants(s).some((p) => p.creaks.some((c) => c.day > D(Y1.creak.after))) || day(s) >= D(Y1.creak.practice)), (s, ctx) => {
    // the lesson always has a live creak: a practice one (it always heals) if hers already went quiet
    if (!s.giant.creaking && !s.giant.split) startCreak(s, ctx, s.giant, day(s), true);
    ctx.unlock('dial');                          // [C] the water dial arrives with the creaks (plan §3.12): Ease, Normal, Push
    ctx.say('moss', CL.creak, { goal: { id: 'creak', target: { kind: 'station', id: 'giant', control: 'regime' } }, glide: GLIDE });
  }, { urgent: (s: State) => plants(s).some((p) => p.creaking), at: Y1.creak.practice }),   // a live creak is explained the morning after it starts
  beat('crier', 14, (s) => day(s) >= D(Y1.crier), (s, ctx) => {
    ctx.unlock('crier');
    crierCard(s, ctx);
    s.story.replay['giant.crier'] = { speaker: 'edna', lines: [LINES.edna.crier] };
  }, { at: Y1.crier, pin: true }),
  beat('rituals', 15, (s) => day(s) >= D(Y1.rituals), (_s, ctx) => {
    ctx.unlock('rituals');
    ctx.say('moss', [LINES.moss.rituals], { goal: { id: 'rituals', target: { kind: 'station', id: 'giant', control: 'talk' } }, glide: GLIDE });
  }, { at: Y1.rituals }),
  // later years: each new layer gets its own intro, never two in the same 6 game days
  { id: 'giant.fish', year: 2, order: 40, when: (s: State) => day(s) >= D(Y1.kelp), run(_s, ctx) { ctx.unlock('fish'); ctx.say('moss', [GL.fish], { glide: GLIDE }); } },
  { id: 'giant.rotate', year: 2, order: 41, when: (s: State) => hasFruit(s.giant) && day(s) - s.giant.setDay >= GT.rotateWindow[0],
    run(_s, ctx) { ctx.unlock('rotate'); ctx.say('gran', [GL.rotate], { goal: { id: 'rotate', text: GL.goalRotate, target: { kind: 'station', id: 'giant', control: 'rotate' } }, glide: GLIDE }); } },
  { id: 'giant.plot2', years: [3, 999], order: 42, when: (s: State) => !!s.giant.plot2 && s.clock.phase === 'grow', run(_s, ctx) { ctx.unlock('plot2'); ctx.say('gran', [GL.plot2], { glide: GLIDE }); } },
];

// ------------------------------------------------------------ actions
const needFruit = (p: GiantPlant|null) => (alive(p) ? null : hasFruit(p) ? 'she split' : 'no fruit yet');
const setting = (ctx: Ctx, key: string, value: string|boolean|null) => ctx.emit({ type: 'giant/setting', key, value });
const ACTIONS = {
  'giant/start': (s, a, ctx) => {
    if (s.clock.phase !== 'grow' || s.giant.stage !== 'tin') return fail('the seed is already started');
    startSeeds(s, ctx, typeof a.file === 'number' && Number.isFinite(a.file) ? a.file : null);
    ctx.goalDone('seed'); ctx.goalDone('giantSeed');
    return ok;
  },
  'giant/regime': (s, a, ctx) => {
    if (!(a.regime in RANK)) return fail('Ease, Normal or Push');
    if (s.giant.transplantDay == null) return fail('she is still on the heat mat');
    if (!dialOpen(s)) return fail('Old Moss shows you the water dial when she first creaks');
    if (s.giant.creaking && s.giant.regime !== a.regime) ctx.goalDone('creak');
    if (s.giant.regime !== a.regime) s.giant.regimeDay = s.clock.day;
    s.giant.regime = a.regime;
    setting(ctx, 'regime', a.regime);
    ctx.goalDone('water');
    return ok;
  },
  'giant/soak': (s, _a, ctx) => {
    const ps = plants(s).filter((p) => p.transplantDay != null);
    if (!ps.length) return fail('she is still on the heat mat');
    let swing = false;
    for (const p of ps) { p.m = round3(clamp(p.m + GT.soak, 0, 1)); swing = checkSwing(s, ctx, p) || swing; }
    ctx.emit({ type: 'giant/soak', swing });
    if (swing) ctx.emit({ type: 'toast', text: GL.swing, cls: 'warn' });
    ctx.goalDone('water');
    return { ok: true, swing };
  },
  'giant/feed': (s, a, ctx) => {
    const F = GT.feed[a.feed];
    if (!F) return fail('none, kelp, fish or both');
    if (!s.unlocks.feed) return fail('Old Moss has not shown you feed yet');
    if (F.fromYear && (s.clock.year < F.fromYear || !s.unlocks.fish)) return fail('fish emulsion arrives in year 2');
    if (s.giant.creaking && fishIn(s.giant.feed) && !fishIn(a.feed)) ctx.goalDone('creak');
    s.giant.feed = a.feed; s.giant.feedWanted = null;   // your choice beats the automatic switch-back
    setting(ctx, 'feed', a.feed);
    ctx.goalDone('kelp');
    return ok;
  },
  'giant/shade': (s, a, ctx) => {
    if (!s.unlocks.shade) return fail('the sail is still in the barn');
    s.giant.shade = a.on ?? !s.giant.shade;
    setting(ctx, 'shade', s.giant.shade);
    if (s.giant.shade) { ctx.goalDone('shade'); if (s.giant.creaking) ctx.goalDone('creak'); }
    return ok;
  },
  'giant/motor': (s, a, ctx) => {
    if (!has(s, 'shadeMotor')) return fail('needs the shade motor');
    s.giant.motor = !!(a.on ?? !s.giant.motor);
    setting(ctx, 'motor', s.giant.motor);
    return ok;
  },
  'giant/measure': (s, a, ctx) => {
    const p = plantOf(s, a.plot), d = s.clock.day;
    if (!p) return fail('no such plot');
    if (!s.unlocks.measure) return fail('Edna brings the tape to the Vine Crawl, Aug 1');
    if (!alive(p)) return fail(needFruit(p) ?? 'no fruit yet');
    // [C] she rests between tapes (rulings R4): Edna tapes her every Sunday, so your own Measure is a treat, not a chore
    if (d < nextTapeDay(p)) return fail(fill(CL.measure.cooldown, { day: tapeDayLabel(s, nextTapeDay(p)) }));
    const r = takeTape(s, ctx, p, 'you');
    ctx.goalDone('measure');
    return { ok: true, ...r };
  },
  'giant/knock': (s, a, ctx) => {
    const p = plantOf(s, a.plot);
    if (!alive(p)) return fail(needFruit(p) ?? 'no fruit yet');
    // (at the Vine Crawl the Cove hushes for it, and the card has its own words for the knock: Old Moss stays quiet)
    const crawling = s.story.cards.some((c) => c.kind === 'crawl'), pitch = knockPitch(s, p, crawling ? T.crawl.hush : 1);
    if (!s.giant.knocks++ && !crawling) ctx.say('moss', [GL.knock]);
    ctx.emit({ type: 'giant/knock', plot: p.plot, pitch });
    return { ok: true, pitch };
  },
  'giant/talk': (s, a, ctx) => {
    const g = s.giant, p = g, d = s.clock.day;
    if (p.stage === 'tin' || p.stage === 'started') return fail('talk to her once she is up');
    const phrase = clamp(a.phrase | 0, 0, LINES.rituals.talk.length - 1);
    g.talkCount++;
    if (hasFruit(p)) { const w = weekOf(p, d); g.talks[w] = (g.talks[w] || 0) + 1; }
    ctx.emit({ type: 'giant/talk', phrase, text: LINES.rituals.talk[phrase] ?? '' });
    // 1 in 60 talks, at most once a year, she says "...thanks". Never logged, never mentioned.
    if (!g.thanked && hasFruit(p) && next(makeRng(hash32(s.seed, s.clock.year, g.talkCount, 'thanks'))) < 1 / CAT.thanks.odds) {
      g.thanked = true;
      ctx.emit({ type: 'giant/thanks' });
    }
    if (g.talkCount >= CAT.dedication.talks) fireNow(s, ctx, 'dedication');
    ctx.goalDone('rituals');
    return ok;
  },
  'giant/radio': (s, a, ctx) => {
    if (a.station != null && !RADIO.includes(a.station)) return fail('KQSC plays shanties, smooth jazz or The Vine Borers');
    s.giant.radio = a.station || null;
    setting(ctx, 'radio', s.giant.radio);
    return ok;
  },
  'giant/hat': (s, a, ctx) => {
    s.giant.hat = !!(a.on ?? !s.giant.hat);
    setting(ctx, 'hat', s.giant.hat);
    return ok;
  },
  'giant/name': (s, a) => {
    const p = plantOf(s, a.plot), name = clean(a.name, GT.nameMax);
    if (!p?.name || !name) return fail(p?.name ? 'she needs a name' : 'name her at the cull');
    if (s.clock.phase !== 'grow' && s.clock.phase !== 'october') return fail('too late to rename her');
    p.name = name;
    return ok;
  },
  'giant/rotate': (s, a, ctx) => {
    const p = plantOf(s, a.plot), d = s.clock.day, R = GT.rotate;
    if (s.clock.year < GT.rotateFromYear) return fail('Gran shows you rotating next year');
    if (!alive(p)) return fail(needFruit(p) ?? 'no fruit yet');
    const t = d - p.setDay;
    if (p.rotated) return fail('she has already been turned');
    if (t < GT.rotateWindow[0] || t > GT.rotateWindow[1]) return fail(`only from day ${GT.rotateWindow[0]} to ${GT.rotateWindow[1]} after set`);
    p.rotated = true;
    // Stem-crack chance 1% + 1% per 100 lb of estimate: earlier is safer.
    if (chance(ctx.rng('giant'), R.crack + R.crackPer100 * p.wc / 100)) {
      p.stemCrack = true;
      ctx.emit({ type: 'toast', text: line(s, GL.stemCrack, { name: p.name }), cls: 'bad' });
    } else ctx.emit({ type: 'toast', text: line(s, GL.rotated, { name: p.name }), cls: 'good' });
    ctx.emit({ type: 'giant/rotate', plot: p.plot, crack: p.stemCrack });
    ctx.goalDone('rotate');
    return { ok: true, crack: p.stemCrack };
  },
  'giant/treat': (s, a, ctx) => {
    const p = plantOf(s, a.plot);
    if (p?.softSpot) {
      endCreak(p, s.clock.day, 'treated');
      ctx.emit({ type: 'toast', text: GL.softTreated, cls: 'good' });
      ctx.emit({ type: 'giant/heal', plot: p.plot });
      return ok;
    }
    if (!p || p.split !== 'crack') return fail('nothing to treat');
    if (p.treated) return fail('already treated');
    if (!canAfford(s, GT.treat.cost)) return fail('not enough cash');
    ctx.money(-GT.treat.cost, 'giant');
    p.treated = true;
    ctx.emit({ type: 'toast', text: GL.treated, cls: 'good' });
    return ok;
  },
} satisfies ActionHandlers;

// The knock: a pitch that follows her density (corr ~0.5), keyed by the day so knocking twice sounds the same.
// [C] hush: at the Vine Crawl the whole Cove goes quiet for your knock (T.crawl.hush): its noise is the mean of that many
// keyed draws, so the Crawl's knock is the clearest of the year. hush 1 is the everyday knock, unchanged.
export function knockPitch(s: State, p: GiantPlant, hush = 1) {
  const K = GT.knock, c = GT.knockCorr;
  let z = 0;
  for (let k = 0; k < hush; k++) {
    const key = [s.seed, s.clock.year, s.clock.day, p.plot, 'knock', ...(k ? [k] : [])];   // (k = 0: the everyday knock's key)
    z += gauss(makeRng(hash32(...key)));
  }
  const read = (p.secret.rho - 1) + K.rhoSd * Math.sqrt(1 / (c * c) - 1) * (z / hush);
  return round3(clamp(1 - K.k * read, K.range[0], K.range[1]));
}

// ------------------------------------------------------------ [C] the tape (Measure, Edna's Sunday tape, the Vine Crawl)
// One tape: OTT over her, the chart estimate, a dot on the chart, the sign. `by` is who held it ('you', 'edna', 'crawl').
export function takeTape(s: State, ctx: Ctx, p: Fruiting, by = 'you') {
  const d = s.clock.day, { ott, est } = tape(s, p), prev = p.measures.at(-1);
  p.measures.push({ day: d, ott, est, by });
  if (p.measures.length > 120) p.measures.shift();
  p.est = est; p.ottShown = ott;
  const days = prev ? d - prev.day : 0, delta = prev ? est - prev.est : 0, perDay = days ? delta / days : 0;
  let record = false;
  // a personal-best day: only a real jump counts (8% over the old best), and the toast keeps its cooldown
  if (prev && perDay >= 5 && perDay > p.bestPerDay * 1.08) {
    const first = !p.bestPerDay;
    p.bestPerDay = round2(perDay);
    s.giant.lastRecord = { lb: Math.round(perDay), days, name: p.name || 'Her' };
    record = !first && fireNow(s, ctx, 'record_day');
  } else if (prev && perDay > p.bestPerDay) p.bestPerDay = round2(perDay);
  const pc = pace(s, p);
  ctx.emit({ type: 'giant/measure', plot: p.plot, by });
  ctx.emit({ type: 'giant/measured', plot: p.plot, ott, est, delta, days, perDay: Math.round(perDay), record, by, pace: pc });
  return { ott, est, delta, days, pace: pc };
}
export const nextTapeDay = (p: GiantPlant|null) => { const last = p?.measures.at(-1); return last ? last.day + GT.measureEvery : 0; };
const tapeDayLabel = (s: State, d: number) => (d - s.clock.day === 1 ? 'tomorrow' : dowName(d, true));
// The water dial is hidden in year 1 until Old Moss's creak lesson; in years 2+ it is live from Moving Day.
export const dialOpen = (s: State) => s.clock.year > 1 || !GT.regimeHiddenUntilCreak || !!s.unlocks.dial;

// ------------------------------------------------------------ [C] the pace line (plan §3.12)
// The latest tape's estimate projected along the public growth curve (T.giant.logistic x the late-season slowdown) to the
// weigh-off. It reads only the tape (est), the set day and T: never the hidden weight (a test greps for it). Give or take:
// T.giant.pace.err x the share of her growth still to come, so it narrows as the season goes. Vance's usual is his line's
// expected weight this year; kelp's share is the growth the kelp days added to this tape.
const curveCache = new Map();
function curve(setDay: number, t: number) {
  const k = `${setDay}|${t}`;
  if (!curveCache.has(k)) { let c = 0; for (let u = 0; u < t; u++) c += (Lf(u + 1) - Lf(u)) * slowdown(setDay + u); curveCache.set(k, c); }
  return curveCache.get(k);
}
export const vanceUsual = (s: State) => { const V = T.rivals.vance; return Math.round(V.W0 * (1 + V.g) ** (s.clock.year - 1) / 10) * 10; };
export function pace(s: State, p: GiantPlant = s.giant) {
  const m = p?.measures?.at(-1), P = GT.pace;
  if (!m || !hasFruit(p) || p.split === 'blowout') return null;
  const t = Math.max(1, m.day - p.setDay), tW = WEIGHOFF - p.setDay, done = curve(p.setDay, t), all = curve(p.setDay, tW);
  const r10 = (x: number) => Math.round(x / P.round) * P.round, lb = m.est * all / done, left = Math.max(0, 1 - done / all);
  const share = p.days.set ? p.days.kelp / p.days.set : 0, km = GT.feed.kelp.mul - 1;
  return { lb: r10(lb), give: r10(Math.max(P.min, P.err * left) * lb), left: round3(left), vance: vanceUsual(s),
    kelp: share > 0 ? Math.round(m.est * (1 - 1 / (1 + km * share))) : 0 };
}

// ------------------------------------------------------------ bots (design §14): balanced / novice / greedy / cautious
// Policy giant fields: { regime, feed, shade: 'forecast' | true | false, respond (ease to Light while she creaks),
//   ease (also shade up and no fish while she creaks), stepUp (return one notch at a time; default true), measure (every
//   n days), talk, rotate, treat }.
const shadeWant = (s: State, mode: string|boolean, ease: boolean) => {
  if (ease) return true;
  if (mode === true || mode === 'always') return true;
  if (mode === 'forecast') return !!s.weather.heat || !!s.weather.forecast?.[0]?.heat;
  return false;
};
function bot(s: State, _ctx: Ctx, P: Policy): Action[] {
  if (P.name === 'idle' || !growing(s)) return [];
  const C: Partial<GiantPolicy> = P.giant ?? {}, g = s.giant, d = s.clock.day, acts: Action[] = [];
  if (g.stage === 'tin') return [{ type: 'giant/start' }];
  if (g.transplantDay == null) return [];
  const creak = plants(s).some((p) => p.creaking), ease = !!C.respond && creak, full = ease && !!C.ease;
  // regime: ease to Light while she creaks; afterwards step back up one notch at a time (a sudden Light -> Heavy swings)
  let want: 'light' | 'normal' | 'heavy' = ease ? 'light' : C.regime || 'normal';
  if (!ease && C.stepUp !== false && rankOf(want) - rankOf(g.regime) >= 2) want = 'normal';
  if (want !== g.regime && dialOpen(s) && (ease || d - g.regimeDay >= GT.regimeStepDays)) acts.push({ type: 'giant/regime', regime: want });
  if (s.unlocks.feed) {
    let f: FeedId = C.feed || 'none';
    if (fishIn(f) && (s.clock.year < 2 || !s.unlocks.fish)) f = f === 'both' ? 'kelp' : 'none';
    if (full && fishIn(f)) f = 'kelp';
    if (f !== g.feed) acts.push({ type: 'giant/feed', feed: f });
  }
  if (s.unlocks.shade && !(has(s, 'shadeMotor') && g.motor)) {
    const sh = shadeWant(s, C.shade ?? false, full && C.shade !== false && C.shade !== 'never');
    if (sh !== g.shade) acts.push({ type: 'giant/shade', on: sh });
  }
  for (const p of plants(s)) {
    if (!alive(p)) continue;
    const t = d - p.setDay, lastTape = p.measures.at(-1);
    if (s.unlocks.measure && (C.measure ?? 3) > 0 && (!lastTape || d - lastTape.day >= (C.measure ?? 3))) acts.push({ type: 'giant/measure', plot: p.plot });
    if (C.treat !== false && (p.split === 'crack' && !p.treated && canAfford(s, GT.treat.cost) || p.softSpot)) acts.push({ type: 'giant/treat', plot: p.plot });
    if ((C.rotate ?? P.name === 'balanced') && s.clock.year >= GT.rotateFromYear && !p.rotated && t >= GT.rotateWindow[0] && t <= GT.rotateWindow[1]) acts.push({ type: 'giant/rotate', plot: p.plot });
  }
  if ((C.talk ?? P.name === 'balanced') && s.unlocks.rituals && hasFruit(g) && !g.talks[weekOf(g, d)]) acts.push({ type: 'giant/talk', phrase: d % 3 });
  // a playing bot answers the onboarding goals the way a player would (so ?jump states don't carry them for months)
  const goal = s.story.goal?.id;
  if (goal === 'kelp' && !acts.some((a) => a.type === 'giant/feed')) acts.push({ type: 'giant/feed', feed: g.feed });
  if (goal === 'rituals' && !acts.some((a) => a.type === 'giant/talk') && hasFruit(g)) acts.push({ type: 'giant/talk', phrase: 0 });
  return acts;
}

// [C] How a bot answers the giant's cards (bots.js wraps every policy's answer with it; a policy's own answer goes first).
//   P.moving: 'now' (this morning, the card's default) | 'best' (the lowest fog on the card) | 'worst' (the highest)
//   P.dawn (year 1): 'bees' (the default) | 'read' (bees when they're all out, else paws) | 'paws' | 'clear' (wait for the bees)
export function botChoice(c: Card, s: State, P: Policy): string | undefined {
  if (c.kind === 'moving' && P.moving && P.moving !== 'now') {
    const fs = c.data.fc, pick = P.moving === 'worst' ? Math.max(...fs) : Math.min(...fs);
    return String(Math.max(0, fs.indexOf(pick)));
  }
  // (year 1 only: from year 2 the dawn card is the breeding plan's (a cross, a sib or the card's default father), and a
  // bot reading the bees there would self her in every fog)
  if (c.kind === 'pollinate' && P.dawn && P.dawn !== 'bees' && s.clock.year === 1) {
    const many = c.data.bees >= GT.set.beesShown[0], last = c.data.dawn >= GT.beesAfterDawns;
    if (P.dawn === 'paws') return 'self';
    if (P.dawn === 'read') return many ? 'open' : 'self';
    if (P.dawn === 'clear') return many || last ? 'open' : 'wait';
  }
  return undefined;
}

// ------------------------------------------------------------ module
export default {
  id: 'giant',
  init(s) { setup(s, null); },
  newYear(s: State) { setup(s, s.giant); },
  dayStart(s: State, ctx: Ctx) {
    if (!growing(s)) return;
    const g = s.giant, d = s.clock.day;
    if (d === 0 && s.clock.year > 1 && g.stage === 'tin') ctx.goal('giantSeed', GL.goalSeed, { kind: 'station', id: 'giant', control: 'start' });
    if (g.stage === 'tin' && d >= GT.autoStart && s.clock.phase === 'grow') { startSeeds(s, ctx); ctx.say('gran', [GL.autoStart]); ctx.goalDone('seed'); ctx.goalDone('giantSeed'); }
    // [C] years 2+: Moving Day is a card every May 1 (year 1's is Gran's lesson, the giant.moving beat)
    const cables = has(s, 'cables') ? GT.cablesDays : 0;
    if (s.clock.year > 1 && s.clock.phase === 'grow' && !g.moving && g.stage === 'sprout' && d >= D(Y1.moving) - cables && !queued(s, 'moving')) movingCard(s, ctx);
    for (const p of plants(s)) stageStep(s, ctx, p, d);
    for (const p of plants(s)) rootingStep(s, ctx, p, d);
    if (g.transplantDay == null) return;
    // [C] receipts at a visible event (rulings R9): the heat breaking (Hal, after the shade), and Vance's at her first creak,
    // or on cullBy if she never creaked
    const yday = s.weather.days[d - 1];
    if (s.weather.heat && !yday?.heat) g.wave = { from: d, scalds: 0 };
    else if (!s.weather.heat && yday?.heat && g.wave && s.unlocks.shade && alive(g)) { fileReceipt(s, ctx, { which: 'heat', scalds: g.wave.scalds }); g.wave = null; }
    if (d >= D(GT.receipts.cullBy) && alive(g) && g.cull) fileReceipt(s, ctx, { which: 'cull', creaked: false });
    if (has(s, 'shadeMotor') && g.motor && s.unlocks.shade) g.shade = !!g.motorCall;
    payFeed(s, ctx);
    for (const p of plants(s)) if (p.transplantDay != null) refill(s, ctx, p);
    if (s.clock.year > 1 && d >= D(Y1.crier) && !g.crier && !queued(s, 'crier') && s.clock.phase === 'grow' && alive(g)) { crierCard(s, ctx); g.crier = { told: false, est: null, day: d, pending: true }; }
    for (const p of plants(s)) dawnStep(s, ctx, p, d);
    // the colour shows by August: a white or striped sport is a story
    if (d >= D('Aug 1') && alive(g) && g.genome.mut && !g.mutationShown && (g.color === 'W' || g.stripe)) {
      g.mutationShown = true; g.mutation = g.color === 'W' ? 'white' : 'stripe';
      if (fireNow(s, ctx, 'mutation')) ctx.story('mutation', 30, { NAME: (g.name || 'her').toUpperCase() });
    }
    const [lo, hi] = GT.thirsty;
    if (!g.thirsty && hasFruit(g) && g.m < lo) { g.thirsty = true; ctx.alert('giantThirsty', { text: line(s, GL.thirsty, { name: g.name || 'Your giant' }), cls: 'warn' }); }
    if (g.thirsty && g.m >= hi) g.thirsty = false;
  },
  dayEnd(s: State, ctx) {
    if (!growing(s)) return;
    const g = s.giant, d = s.clock.day;
    for (const p of plants(s)) night(s, ctx, p, d);
    if (g.kelpFree > 0 && g.transplantDay != null) g.kelpFree--;
    g.motorCall = s.weather.forecast?.[0]?.heat ? 1 : 0;
  },
  phase(s: State, ctx: Ctx, from, to) {
    if (from === 'weighoff' && to === 'halloween') {
      // FALLBACK until the weigh-off slice records results: the honest scale, a hidden cavity is exhibition only
      for (const p of plants(s)) if (hasFruit(p) && !p.result) {
        const W = trueWeight(s, p), E = chartEstimate(s, p);
        recordResult(s, p, { W: alive(p) ? W : null, pct: alive(p) && E ? round3(W / E - 1) : null, place: null,
          exhibition: hiddenCavity(p) || p.split === 'blowout', dq: p.split === 'blowout', fallback: true });
      }
    }
    if (from === 'halloween' && to === 'winter') {
      const best = plants(s).filter((p) => hasFruit(p) && (p.split !== 'blowout' || p.seedsOk)).sort((a, b) => (b.result?.W || b.wc) - (a.result?.W || a.wc))[0];
      if (s.genetics.lotYear !== s.clock.year) {
        const lot = gen.scoopSeeds(s, ctx, best);
        if (!lot.length) ctx.emit({ type: 'toast', text: GL.noSeeds, cls: 'warn' });
      }
    }
    if (to === 'winter') {
      const g = s.giant;
      g.history = [...g.history.slice(-4), { year: s.clock.year, name: g.name, measures: g.measures.map((m) => ({ t: m.day - (g.setDay ?? m.day), est: m.est })),
        result: g.result ? { W: g.result.W, place: g.result.place ?? null, exhibition: !!g.result.exhibition } : null, split: g.split, creaks: g.creaks.length }];
    }
  },
  actions: ACTIONS,
  cards: {
    // [C] Moving Day: the morning she goes out (this morning moves her now; a later one on that morning)
    moving(s, card, choice, ctx) {
      const g = s.giant, k = Math.max(0, Math.min((card.data.days || []).length - 1, +choice || 0)), day = card.data.days?.[k] ?? s.clock.day;
      if (g.moving || g.transplantDay != null) return undefined;
      g.moving = { day, pick: k, fc: card.data.fc?.[k] ?? null, f: null, rootDays: null, rootedDay: null, foggier: false };
      logChoice(s, 'moving', card.data.choices?.[k]?.label || label(day));
      ctx.emit({ type: 'giant/moving', day, pick: k, text: fill(CL.moving.picked, { day: k === 0 ? 'this morning' : k === 1 ? 'tomorrow' : dowName(day, true) }) });
      if (day <= s.clock.day) {
        const cables = has(s, 'cables') ? GT.cablesDays : 0;
        for (const p of plants(s)) if (p.stage === 'sprout') transplant(s, ctx, p, s.clock.day, cables);
      }
      return undefined;
    },
    pollinate(s, card, choice, ctx) {
      const p = plantOf(s, card.data.plot), d = s.clock.day;
      if (!p || p.setDay != null) return undefined;
      if (choice === 'wait') {
        p.dawn++; p.cardDay = d + 1;
        ctx.emit({ type: 'toast', text: GL.waited, cls: '' });
        return undefined;
      }
      const father = fatherFor(s, p, choice), f = s.weather.f, bees = choice === 'open';
      if (!chance(ctx.rng('giant'), setChanceOf(f, choice))) {
        p.fails++; p.cardDay = d + GT.failedSetDelay;
        ctx.emit({ type: 'giant/noset', plot: p.plot });
        ctx.emit({ type: 'toast', text: GL.noSet, cls: 'warn' });
        return undefined;
      }
      setFruit(s, ctx, p, father);
      // [C] Old Moss's receipt follows SHE TOOK (rulings R9): how she took, and whether reading the bees paid
      if (p.plot === 1) {
        const fog = beesOut(f) < GT.set.beesShown[0];
        logChoice(s, 'dawn', `${bees ? CL.dawn.bees : CL.dawn.paws}, ${fog ? 'a fog dawn' : 'a clear dawn'}`);
        fileReceipt(s, ctx, { which: 'dawn', how: bees ? 'bees' : 'paws', fog, late: p.fails > 0 || p.dawn > 1 });
      }
      return undefined;
    },
    cull(s, card, choice, ctx, a) {
      const p = plantOf(s, card.data.plot);
      if (!p || p.stage !== 'set') return undefined;
      p.cull = choice; p.twins = choice === 'twins';
      p.secret.potEff *= own(GT.cull, choice) ?? 1;
      p.name = clean(a.name, GT.nameMax) || card.data.names?.[0] || 'Big Earl';
      p.stage = 'fruit';
      if (p.plot === 1) logChoice(s, 'cull', `${cullLabel(choice)?.[0] ?? choice}: ${p.name}`);
      ctx.emit({ type: 'giant/cull', plot: p.plot, choice });
      if (s.firsts?.career?.named) ctx.emit({ type: 'toast', text: line(s, GL.meet, { name: p.name }), cls: 'good' });   // (MEET {NAME} the first time)
      if (choice === 'twins') ctx.say('vance', [GL.twins]);
      ctx.story('named', 1, { name: p.name });
      return undefined;
    },
    crier(s, card, choice, ctx) {
      const told = choice === 'tell';
      s.giant.crier = { told, est: told ? card.data.est : null, day: s.clock.day };
      logChoice(s, 'crier', told ? line(s, CL.crier.tell[0] ?? '', { est: estText(card.data.est) }) : CL.crier.secret[0] ?? '');
      if (told && s.rep) s.rep.buzz = round3(Math.max(s.rep.buzz || 0, GT.crier.buzz));     // the Cove reads it before W1
      ctx.say('edna', [told ? GL.tellCrier : GL.keepSecret]);
      ctx.emit({ type: 'giant/crier', told });
      if (told) ctx.story('crierTold', 5, { est: card.data.est });
      return undefined;
    },
  },
  beats: BEATS,
  events: EVENTS,
  // [C] the receipts (filed by fileReceipt, said through the moments queue at the next quiet window)
  moments: {
    giantReceipt: {
      run(s, ctx: Ctx, m) {
        const r = receiptLine(s, m.data);
        if (!r) return;
        ctx.say(r[0], [r[1]]);
        receiptSaid(s, r[1]);
        logChoice(s, `receipt:${m.data.which}`, r[1]);
      },
      drop(s, _ctx, m) { const r = receiptLine(s, m.data); if (r) logChoice(s, `receipt:${m.data.which}`, r[1]); },   // filed in the Notebook
    },
  },
  // a goal lets go when its moment has passed (story.js): the honey is in, the creak went quiet or split
  goals: { creak: (s) => plants(s).some((p) => p.creaking) },
  bot,
  summary(s: State) {
    const g = s.giant;
    return { giantW: alive(g) ? trueWeight(s, g) : 0, giantEst: g.est, giantSplit: g.split ? 1 : 0, giantBlowout: g.split === 'blowout' ? 1 : 0, giantCreaks: g.creaks.length };
  },
} satisfies SimModule;

// ------------------------------------------------------------ [C] consequence lines (plan §3.12)
// consequence(s, choice, option) -> one plain line for a choice's option, computed from T so a retune can't make it lie.
// choice: 'moving' (option { f, sd }), 'feed', 'shade', 'dial', 'soak', 'dawn', 'cull', 'crier', 'tape' (the pace line).
// Year 1's dawn and cull say no odds (rulings R5): the bee count and the flavour are the stakes.
const pct = (x: number) => Math.round(Math.abs(x) * 100);
export const commas = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const FRACTIONS: [number, string][] = [[2, 'a half'], [3, 'a third'], [4, 'a quarter'], [5, 'a fifth'], [10, 'a tenth'], [20, 'a twentieth']];
export function fraction(x: number) {
  const n = 1 / Math.max(1e-9, x), hit = FRACTIONS.find(([k]) => Math.abs(n - k) / k < 0.12);
  return hit ? hit[1] : `${pct(x)}%`;
}
const stressAt = (m: number) => { const st = GT.stress; return m < st.dry[0] ? st.dry[1] : m <= st.mid[0] ? st.mid[1] : st.mid[1] + st.wetSlope * (m - st.mid[0]); };
const timesWord = (r: number) => (r >= 0.4 && r <= 0.6 ? 'half as often' : r >= 0.25 && r < 0.4 ? 'a third as often' : r >= 1.8 && r <= 2.2 ? 'twice as often'
  : r > 2.2 ? `${Math.round(r)} times as often` : `${pct(r)}% as often`);
const cullLabel = (choice: string) => own({ safe: GC.safe, stump: GC.stump, round: GC.round, twins: GC.twinsC }, choice);
type MovingPick = { f: number; sd: number };
const isMovingPick = (o: unknown): o is MovingPick => typeof o === 'object' && o !== null && 'sd' in o;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export function consequence(s: State, choice: string, option: string|MovingPick|GiantPlant|null): string {
  const y1 = s.clock.year === 1, M = CL.moving;
  switch (choice) {
    case 'moving': {
      if (!isMovingPick(option)) return '';
      const odds = rootOdds(option.f, option.sd).filter(([, p]) => p > 0.01).sort((x, y) => y[1] - x[1]);
      const say = (days: number) => own(M.days, String(days)) ?? '';
      const first = odds[0], second = odds[1];
      if (!first) return '';
      if (option.sd <= 0 || first[1] >= 0.97 || !second) return cap(say(first[0]));
      const [a, b] = [first[0], second[0]].sort((x, y) => x - y);
      if (a === undefined || b === undefined) return '';
      const top = first[1] >= GT.moving.likely ? fill(M.likely, { a: say(first[0]) })
        : a > 1 ? fill(M.range, { a, b }) : fill(M.either, { a: say(a), b: own(M.short, String(b)) ?? '' });
      return cap(top);
    }
    case 'feed': {
      if (option !== 'kelp') return CL.feed.none;
      const F = GT.feed.kelp, left = Math.max(0, WEIGHOFF - s.clock.day);
      return fill(CL.feed.kelp, { cost: F.cost, total: Math.round(F.cost * left / 10) * 10, pct: pct(F.mul * (1 + GT.kelpDensity) - 1) });   // bigger, and kelp makes them heavy
    }
    case 'shade': return option === 'on' ? fill(CL.shade.on, { pct: pct(1 - GT.shade.upFog), clear: pct(1 - GT.shade.upGrowth) }) : CL.shade.off;
    case 'dial': {
      const g = (r: string) => cWater(target(r)), sN = stressAt(target('normal'));
      if (option === 'light') return fill(CL.dial.light, { slow: pct(1 - g('light') / g('normal')), less: timesWord(stressAt(target('light')) / sN) });
      if (option === 'heavy') return fill(CL.dial.heavy, { fast: pct(g('heavy') / g('normal') - 1), more: timesWord(stressAt(target('heavy')) / sN) });
      return CL.dial.normal;
    }
    case 'soak': return CL.soak.sub;
    case 'crier': return (option === 'tell' ? CL.crier.tell : CL.crier.secret)[1] ?? '';
    case 'cull': return (typeof option === 'string' ? cullLabel(option)?.[1] : undefined) ?? '';
    case 'dawn': {
      const D2 = CL.dawn, f = s.weather.f, n = beesOut(f), tm = s.weather.forecast?.[0];
      if (option === 'wait') {
        if (!tm) return D2.lastSub;
        return fill(y1 ? D2.waitSub : D2.waitOdds, { word: fogWord(tm.f), pct: Math.round(tm.f * 100) });
      }
      const p10 = (x: number) => Math.round(x * 10);
      if (option === 'open') {
        if (!y1) return fill(D2.beesOdds, { n, p: p10(setChanceOf(f, 'open')) });
        return fill(n >= GT.set.beesShown[0] ? D2.beesSub.many : n === 1 ? D2.beesSub.one : D2.beesSub.some, { n });
      }
      if (option === 'cross') return fill(D2.crossOdds, { p: p10(GT.set.paws) });
      return y1 ? D2.pawsSub : fill(D2.pawsOdds, { p: p10(GT.set.paws) });
    }
    case 'tape': {
      const P = CL.pace, pc = pace(s, typeof option === 'object' && option && !isMovingPick(option) ? option : s.giant);
      if (!pc) return P.none;
      return [fill(P.line, { lb: commas(pc.lb), give: commas(pc.give) }), fill(P.vance, { v: commas(pc.vance) })].join(' ');
    }
  }
  return '';
}

// ------------------------------------------------------------ [C] receipts and the Notebook's choices (rulings R9)
// A receipt is filed once a year per kind at its visible event (the dawn -> SHE TOOK, the heat breaking -> the shade, her
// first creak -> the cull) and said through the moments queue (story.receipt); the Notebook keeps what you chose and what
// came of it.
// (a save from before track C, v3 or an early v4, has no receipts or Notebook choices yet: they start empty mid-year)
const filed = (g: Giant) => (g.receipts ??= {});
function fileReceipt(s: State, ctx: Ctx, data: GiantReceipt) {
  const g = s.giant, which = data.which;
  if (filed(g)[which]) return;
  g.receipts[which] = s.clock.day;
  const r = receiptLine(s, data);
  if (r && !receiptFresh(s, r[1])) { logChoice(s, `receipt:${which}`, r[1]); return; }   // heard it lately: the Notebook only
  ctx.receipt({ id: `${which}:${s.clock.year}`, kind: 'giantReceipt', due: s.clock.day, data });
}
// A receipt's line is said at most once in T.giant.receipts.fresh years (plan §6 C: none repeats its text within 3 years).
// The memory is s.story.heard, which outlives the year.
function receiptFresh(s: State, text: string) {
  return !s.story.heard.some(([t, y]) => t === text && s.clock.year - y < GT.receipts.fresh);
}
function receiptSaid(s: State, text: string) {
  const mem = s.story.heard;
  mem.push([text, s.clock.year]);
  if (mem.length > 40) mem.splice(0, mem.length - 40);
}
const pair = (l: readonly string[] | undefined): [string, string] | null => (l?.[0] !== undefined && l[1] !== undefined ? [l[0], l[1]] : null);
function receiptLine(s: State, data: GiantReceipt): [string, string] | null {
  const R = CL.receipts, g = s.giant;
  if (data.which === 'dawn') return pair(own(R.dawn, data.late ? 'late' : `${data.fog ? 'fog' : 'clear'}${data.how === 'bees' ? 'Bees' : 'Paws'}`));
  if (data.which === 'heat') return pair(data.scalds > 0 ? R.heat.scald : R.heat.clean);
  if (g.cull) return pair(own(R.cull, `${g.cull}${data.creaked ? 'Creak' : 'Quiet'}`));
  return null;
}
function logChoice(s: State, id: string, text: string) {
  const c = ((s.giant.notebook ??= { choices: [] }).choices ??= []);
  c.push({ d: s.clock.day, id, text });
  if (c.length > GT.receipts.keep) c.splice(0, c.length - GT.receipts.keep);
}
