// Between years (design §9): the Halloween epilogue (porch carving that scoops out the seed lot, trick-or-treaters), then
// winter: the ledger with row report cards, the Quarter Sun Crier's year-end edition, the scrapbook page, and the winter
// hub (seeds, the Grange, the shop, the Almanac) ending in "Begin Year N+1" (winter/beginYear, game.js).
//
// What the player should feel at each step (design §13), and what makes it so:
//   Carving      self-expression, a sweet goodbye to her: finger-draw Shave (glow) and Punch (blaze), or a stencil;
//                Done lights her up on the porch. Skip is honest: the seeds are saved either way.
//   Seed lot     legacy, next year's bet: six cards pop out with plinks, each named by her official weight.
//   Trick-or-treat  a cosy coda: kits, joeys and owlets in sheets; tap them and they hop.
//   Ledger       "next year I'll plant later", never "that was unfair": every number has a reason (row report cards).
//   The Crier    pride and laughter: the year's best story is the headline, with the reveal photo; every year tells one.
//   Scrapbook    a page per year; the split years get "The One That Got Away".
//   Shop         ambition and a real choice: two things you want, money for one (the full shop lands around year 6).
//
// s.winter = { stage: 'carve'|'treats' (Halloween) | 'ledger'|'crier'|'scrapbook'|'hub' (winter) | null, year, plot (the one
//   on the porch), carved, skipped, stencil, lot: [seed ids], candy, repStart, edition (the Crier, built when winter starts) }
// s.scrapbook = [{ year, headline, name, weight, pct, place, pretty, stars, net, moment, split, exhibition, mustache }]
// Actions: winter/carve { plot?, stencil?, ink? }, winter/skipCarve { plot? }, winter/treat { group }, winter/next.
// Out-events: winter/stage { stage }, winter/carved { plot, n, skipped }, winter/treat { group, candy }.
// Helpers: crierEdition(s), ledgerSummary(s), porchPlant(s), STAGES, HALLOWEEN_STAGES.
import { T } from './tuning.js';
import { HALLOWEEN, label } from './calendar.js';
import { makeRng, next, pick, shuffle } from './rng.js';
import { hash32, fill, round3 } from './util.js';
import { LINES, SPEAKERS, line, yearLog, runBeats } from './story.js';
import { CATALOGUE, count, forYear } from './economy.js';
import { genYear, inShare } from './weather.js';
import { reportCards, LINES as PL } from './patch.js';
import * as giant from './giant.js';
import * as gen from './genetics.js';
import { judgesFor } from './weighoff.js';

export const HALLOWEEN_STAGES = ['carve', 'treats'];
export const STAGES = ['ledger', 'crier', 'scrapbook', 'hub'];
const LW = LINES.winter, fail = (reason) => ({ ok: false, reason });
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
const MONTH_LONG = { Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October' };
// story ids that are the weigh-off's own news: the scrapbook's "best moment" is something else that happened
const RESULT_IDS = new Set(['record', 'doubleCrown', 'heaviest', 'second', 'third', 'pb', 'prettiest', 'exhibition', 'mustache', 'vows',
  'auction', 'raccoonEntry', 'loan', 'heartbreak', 'marlene', 'carved', 'candy', 'arrive', 'named', 'crierTold', 'scouts', 'fad', 'trucked']);

// ------------------------------------------------------------ the porch
// The one you carve: the heaviest she weighed in at, else the one that got away (if her seeds are any good), else her.
export function porchPlant(s) {
  const ps = giant.plants(s).filter((p) => giant.hasFruit(p));
  return ps.sort((a, b) => (b.result?.W || 0) - (a.result?.W || 0))[0] || null;
}
function scoop(s, ctx, plot) {
  const p = plot ? giant.plantOf(s, plot) : porchPlant(s);
  const seeds = p ? gen.scoopSeeds(s, ctx, p) : [];
  s.winter.plot = p?.plot ?? 1;
  s.winter.lot = seeds.map((x) => x.id);
  return { p, seeds };
}

// ------------------------------------------------------------ the Quarter Sun Crier (year-end edition)
const tmplOf = (id) => LINES.wo.crier[id] || LINES.crier[id] || null;
const filled = (str, v) => { const t = fill(str, v); return /\{\w+\}/.test(t) ? null : t; };
function baseVars(s) {
  const p = porchPlant(s) || s.giant;
  return { FARM: s.meta.farmName.toUpperCase(), NAME: (p?.name || 'HER').toUpperCase(), X: Math.round(inShare(s, HALLOWEEN) * 100) };
}
function marleneYear(s) {
  const days = s.weather.days || [];
  const by = Object.fromEntries(MONTHS.map((m) => [m, []]));
  days.forEach((d, i) => { const m = label(i).split(' ')[0]; by[m]?.push(d.f); });
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const foggiest = MONTHS.slice().sort((a, b) => mean(by[b]) - mean(by[a]))[0];
  const heat = days.filter((d, i) => d.heat && !days[i - 1]?.heat).length, rain = days.filter((d) => d.rain).length;
  const pct = Math.round(inShare(s, HALLOWEEN) * 100);
  return { pct, month: MONTH_LONG[foggiest], heat, rain, text: fill(LW.marlene, { pct, month: MONTH_LONG[foggiest], heat, rain }),
    spark: MONTHS.map((m) => round3(mean(by[m]))) };
}
// The headline is the year's best-scored story beat that has a headline template; the next two make the briefs.
export function crierEdition(s) {
  const y = s.clock.year, r = makeRng(hash32(s.seed, y, 'crier')), V = baseVars(s);
  const log = yearLog(s, y);
  const used = new Set(), items = [];
  for (const e of log) {
    if (used.has(e.id)) continue;
    const t = tmplOf(e.id), vars = { ...V, ...varsOf(e.vars) };
    const head = t && filled(t.text, vars);
    const brief = filled(LW.briefs[e.id] || '', vars) || head;
    if (!head && !brief) continue;
    used.add(e.id);
    items.push({ id: e.id, score: e.score, head, brief });
  }
  const top = items.find((x) => x.head);
  const headline = top?.head || fill(LINES.crier.marlene.text, V);
  const sub = top?.id === 'record' ? LINES.crier.record.alt : null;
  const briefs = items.filter((x) => x !== top).slice(0, 2).map((x) => x.brief);
  // next year: the fad, the judges, Marlene's mood (Old Moss, right 70% of the time)
  const nf = s.patch?.nextFad;
  const fad = nf ? fill(LW.fad, { Variety: PL.names?.[nf.variety] || nf.variety, conf: Math.round((nf.confidence || 0) * 100) }) : null;
  const judges = fill(LW.judges, { judges: judgesFor(y + 1).map((j) => SPEAKERS[j]?.name || j).join(', ') });
  const mood = y + 1 >= T.weather.archetypeFromYear ? fill(LW.mood, { hint: LINES.moss.mood[genYear(s.seed, y + 1).hint] || LINES.moss.mood.normal }) : null;
  // two letters to the editor: one argues about which superstition works
  const rituals = ['talk', 'hat', 'moon', 'radio', 'secret'], others = Object.keys(LW.letters).filter((k) => !rituals.includes(k));
  const letters = [LW.letters[pick(r, rituals)], LW.letters[pick(r, others)]];
  const record = s.weighoff?.history?.at(-1)?.record;
  const column = record ? [LW.oldTimer.record] : shuffle(r, LW.oldTimer.lines).slice(0, 2);
  // a classified teasing something the shop has next winter that you don't own yet (new items first)
  const fy = forYear(s);
  const ads = Object.values(CATALOGUE).filter((it) => LW.classifieds[it.id] && it.from <= fy && count(s, it.id) < (it.max || 1) && s.hires?.[it.id] !== fy);
  const fresh = ads.filter((it) => it.from === fy);
  const ad = (fresh.length ? pick(r, fresh) : ads.length ? pick(r, ads) : null);
  return { year: y, headline, sub, briefs, marlene: marleneYear(s), fad, judges, mood, letters, column, classified: ad ? LW.classifieds[ad.id] : LW.classifieds.forklift,
    classifiedItem: ad?.id ?? 'forklift' };
}
// a story beat's vars, plus UPPERCASE copies for the headline templates ({NAME}, {R} = row number)
function varsOf(v = {}) {
  const out = { ...v };
  for (const [k, x] of Object.entries(v)) if (out[k.toUpperCase()] === undefined) out[k.toUpperCase()] = typeof x === 'string' ? x.toUpperCase() : x;
  if (typeof v.row === 'number' && out.R === undefined) out.R = v.row + 1;
  return out;
}

// ------------------------------------------------------------ the ledger (one scrollable card)
const sumOf = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
export function ledgerSummary(s) {
  const H = s.ledger.history, L = H.at(-1) || { year: s.clock.year, income: s.ledger.year.income, expense: s.ledger.year.expense, net: 0 };
  const rows = (o) => Object.entries(o || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ cat: k, label: LW.cats[k] || k[0].toUpperCase() + k.slice(1), v }));
  const st = s.season?.totals || {};   // the season slice's year totals (served, turned, walkoffs, rStart, buzzPeak, goatAte)
  const rep = s.patch?.report, rowsR = (rep?.rows || []).filter(Boolean);
  const waste = { soft: rowsR.reduce((a, R) => a + Math.max(0, (R.soft || 0) - (R.soldSoft || 0)), 0), rotten: rowsR.reduce((a, R) => a + (R.rotten || 0), 0),
    green: rowsR.reduce((a, R) => a + (R.green || 0), 0), goat: st.goatAte ?? 0 };
  const p = porchPlant(s) || s.giant;
  const hist = s.giant?.history || [];
  return {
    year: L.year, income: rows(L.income), expense: rows(L.expense), totalIn: sumOf(L.income), totalOut: sumOf(L.expense), net: L.net,
    nets: H.map((h) => ({ year: h.year, net: h.net })),
    families: st.families ? { served: st.served, turned: st.turned ?? 0, walkOffs: st.walkoffs ?? 0 } : null,
    stars: [st.families ? st.rStart : s.winter?.repStart ?? T.season.R.start, s.rep.R], buzzPeak: st.families ? st.buzzPeak : null, waste,
    cards: rep ? reportCards(s).filter((c) => c.variety) : [],
    giant: p ? { name: p.name, W: p.result?.W ?? null, pct: p.result?.pct ?? null, place: p.result?.place ?? null, pretty: p.result?.pretty ?? null,
      exhibition: !!p.result?.exhibition, split: p.split, creaks: p.creaks?.length ?? 0, rituals: giant.ritualsKept(s, p),
      chart: hist.at(-1)?.measures || [], last: hist.at(-2)?.measures || [], lastName: hist.at(-2)?.name || null } : null,
    loan: s.loan.owed > 0 ? s.loan.owed : 0,
  };
}

// ------------------------------------------------------------ the scrapbook page
function page(s, ed) {
  const p = porchPlant(s) || s.giant, res = p?.result || {}, H = s.ledger.history.at(-1);
  // the best moment is the year's next-best story: the top one is already the headline above it
  const isHead = (e) => tmplOf(e.id) && filled(tmplOf(e.id).text, { ...baseVars(s), ...varsOf(e.vars) }) === ed.headline;
  const moment = yearLog(s).find((e) => !RESULT_IDS.has(e.id) && (LW.briefs[e.id] || tmplOf(e.id)) && !isHead(e));
  const mtext = moment ? filled(LW.briefs[moment.id] || tmplOf(moment.id).text, { ...baseVars(s), ...varsOf(moment.vars) }) : null;
  return { year: s.clock.year, headline: ed.headline, name: p?.name || null, weight: res.W ?? null, pct: res.pct ?? null, place: res.place ?? null,
    pretty: res.pretty ?? null, stars: Math.round(s.rep.R * 10) / 10, net: H?.net ?? 0, moment: mtext, split: p?.split === 'blowout' ? 'blowout' : null,
    exhibition: !!res.exhibition, mustache: !!p?.mustache, est: p?.est || null };
}

// ------------------------------------------------------------ the module
function setStage(s, ctx, st) { s.winter.stage = st; ctx.emit({ type: 'winter/stage', stage: st }); }
// Carved (or skipped): the Halloween goal re-aims at its second half, quietly (genetics/choose completes it; if you pick
// nothing, Gran plants the plumpest when the year begins and the chip goes with the winter)
function seedGoal(s, ctx) { if (s.story.goal?.id === 'carve') ctx.goal('pickSeed', LINES.goals.pickSeed, null, { quiet: true }); }
const ACTIONS = {
  'winter/carve': (s, a, ctx) => {
    if (s.clock.phase !== 'halloween' || s.winter.stage !== 'carve') return fail('the carving knife is put away');
    const { p, seeds } = scoop(s, ctx, a.plot);
    if (p) p.stage = 'carved';
    Object.assign(s.winter, { carved: true, stencil: LW.stencils[a.stencil] ? a.stencil : null, ink: round3(Math.max(0, Math.min(1, +a.ink || 0))) });
    ctx.story('carved', 8, { name: p?.name || 'her' });
    ctx.emit({ type: 'winter/carved', plot: s.winter.plot, n: seeds.length, skipped: false });
    for (let i = 0; i < seeds.length; i++) ctx.emit({ type: 'sound', name: 'plink', pitch: 1 + i * 0.08 });
    seedGoal(s, ctx);
    setStage(s, ctx, 'treats');
    return { ok: true, seeds: seeds.map((x) => x.id) };
  },
  'winter/skipCarve': (s, a, ctx) => {
    if (s.clock.phase !== 'halloween' || s.winter.stage !== 'carve') return fail('nothing to skip');
    const { seeds } = scoop(s, ctx, a.plot);
    s.winter.skipped = true;
    ctx.emit({ type: 'toast', text: seeds.length ? LW.skipped : LW.noSeeds, cls: '' });
    ctx.emit({ type: 'winter/carved', plot: s.winter.plot, n: seeds.length, skipped: true });
    seedGoal(s, ctx);
    setStage(s, ctx, 'treats');
    return { ok: true, seeds: seeds.map((x) => x.id) };
  },
  'winter/treat': (s, a, ctx) => {
    if (s.clock.phase !== 'halloween' || s.winter.stage !== 'treats') return fail('no trick-or-treaters now');
    s.winter.candy = Math.min(999, (s.winter.candy || 0) + 1);
    ctx.emit({ type: 'winter/treat', group: a.group | 0, candy: s.winter.candy });
    return { ok: true };
  },
  'winter/next': (s, a, ctx) => {
    if (s.clock.phase === 'halloween') {
      if (s.winter.stage === 'carve') return ACTIONS['winter/skipCarve'](s, a, ctx);
      if (s.winter.candy) ctx.story('candy', 4, { N: s.winter.candy });
      ctx.setPhase('winter');
      return { ok: true };
    }
    if (s.clock.phase !== 'winter') return fail('not winter');
    const i = STAGES.indexOf(s.winter.stage);
    if (i < STAGES.length - 1) setStage(s, ctx, STAGES[i + 1]);
    return { ok: true };
  },
};

const BEATS = [
  // design §3 #26: Old Moss (carving), Edna (the Crier), Gran (the shop)
  { id: 'winter.carve', year: 1, order: 26, when: (s) => s.clock.phase === 'halloween' && s.winter.stage === 'carve',
    run(s, ctx) { ctx.say('moss', [LINES.moss.carving], { goal: { id: 'carve' } }); } },
  { id: 'winter.crier', year: 1, order: 27, when: (s) => s.clock.phase === 'winter' && s.winter.stage === 'crier',
    run(s, ctx) { ctx.say('edna', [LW.edna]); } },
  { id: 'winter.shop', year: 1, order: 28, when: (s) => s.clock.phase === 'winter' && s.winter.stage === 'hub',
    run(s, ctx) { ctx.unlock('shop'); ctx.say('gran', [LINES.gran.shop]); } },
];

function fresh(s) {
  return { stage: null, year: s.clock.year, plot: 1, carved: false, skipped: false, stencil: null, ink: 0, lot: [], candy: 0,
    repStart: s.rep?.R ?? T.season.R.start, edition: s.winter?.edition ?? null };
}

export default {
  id: 'winter',
  init(s) { s.winter = fresh(s); s.scrapbook = []; },
  newYear(s) { s.winter = fresh(s); },
  phase(s, ctx, from, to) {
    if (to === 'halloween') {
      s.clock.day = HALLOWEEN; s.clock.minute = T.winter.halloweenMinute; s.clock.dayFrac = 0;
      s.winter.year = s.clock.year;
      s.winter.plot = porchPlant(s)?.plot ?? 1;
      setStage(s, ctx, porchPlant(s) ? 'carve' : 'treats');
      if (s.clock.year > 1 && porchPlant(s)) ctx.say('moss', [pick(makeRng(hash32(s.seed, s.clock.year, 'carve')), LW.carve.later)]);
      runBeats(s, ctx);
    }
    if (to === 'winter') {
      const ed = crierEdition(s);
      s.winter.edition = ed;
      s.scrapbook = [...(s.scrapbook || []).slice(-(T.winter.scrapbook.keep * 2 - 1)), page(s, ed)];
      setStage(s, ctx, 'ledger');
      if (s.clock.year > 1) ctx.emit({ type: 'toast', text: LW.ednaLater, cls: '', icon: 'ledger' });
    }
  },
  actions: ACTIONS,
  beats: BEATS,
  bot(s, ctx, P) {
    if (s.clock.phase === 'halloween') {
      if (s.winter.stage === 'carve') return P.name === 'idle' ? { type: 'winter/skipCarve' } : { type: 'winter/carve', stencil: 'grin', ink: 0.4 };
      return { type: 'winter/next' };
    }
    if (s.clock.phase === 'winter') return { type: 'winter/beginYear' };
  },
};
