// The commercial patch and the bees [slice: patch] (design §4, §1, §5, §10; numbers in T.varieties, T.patch, T.events.cat).
//
// What the player should feel at each step (design §13), and what makes it so:
//   Planting   the ghost bar lands on the weekends: "I'm placing a bet on October." (ghost(): climatology + Hal's
//              forecast, whiskers +/-(3 + 0.06 DTM) days)
//              the bar firms up through summer: anticipation (whiskers shrink with the growth still to come)
//              a row goes prime on a Saturday morning: "I nailed it." (patch/ripe with weekend: true)
//              ledger: "38 went soft before W3": "Next year I'll plant later", never "that was unfair" (reportCards())
//   Watering   leaves droop, tap, the soil darkens: caretaking, a light rhythm that teaches the fog (M < 0.3 droops)
//   Bugs       a cluster appears (a hand pin), the hunt (hunt.js): a small panic, then triumph
//   Mildew Y2  white dust after a fog streak: "Marlene giveth and taketh", then a reason to grow Warty and Blue
//   Honey      jar pin, plink: cosy background income (jars for the stand shelf)
//   Barn       cut ripe fruit before it goes soft: prudence (barn fruit ages 0.35x)
//   The store  a picked-over row visibly empties, a restock fills it: pride in a full patch
//
// State. Render-facing fields first (architecture §3.2):
//   s.patch.rows[r] = { open, variety, plantedDay, progress, stage, stock: { green, prime, soft, rotten }, health,
//     bugs (infestation 0..1), mildew (0..1), shiny: { id, kind } | null, late ("won't make it"), plan: { variety, day } | null,
//     set (fruit set), beeFrac, by: { [variety]: { green, prime, soft } } (rows may hold restocked varieties),
//     fruit: [{ v, n, off, st: 'green'|'prime'|'soft', age, sa, tr }] (cohorts; age = prime days used, sa = soft days,
//     tr = trucked-in), ...internals }
//   stage: 'bramble' | 'tilled' | 'seeded' | 'sprouts' | 'vines' | 'flowers' | 'green' | 'ripe' | 'done'
//   s.patch.moisture (one meter for the whole patch), s.patch.wet (live once a row is planted this year),
//   s.patch.barn = { [variety]: n } (prime + soft, a summary of barnLots), s.patch.barnLots = [{ v, n, age, st, sa, tr }],
//   s.patch.hives, s.patch.honeyJars (collected, on the stand shelf for sale), s.patch.honeyReady (on the hives),
//   s.patch.fad (this year, Y2+) and s.patch.nextFad (forecast for next year, made when winter starts) =
//     { year, variety, confidence, held, viral, revealed }, s.patch.shinies = [{ id, row, v, kind, state, day, until }]
//     (state: field | found | sold | display | auction | grabbed | lost), s.patch.volunteer = { spot, day, shiny, state },
//   s.patch.report = { y, rows: [...], unmet: { [variety]: n } } (the winter ledger's row report cards: reportCards(s))
//
// Out-events: patch/planted {row, variety, scheduled}, patch/watered {auto}, patch/ripe {row, first, weekend},
//   patch/bugs {row} (new cluster), patch/hunt {row, n, hits, left}, patch/squish {row, left}, patch/bugsCleared {row, by?},
//   patch/sprayed {row, kind},
//   patch/mildew {row}, patch/cut {row, n}, patch/restock {row, n}, patch/honey {ready}, patch/honeyCollected {jars},
//   patch/shiny {id, row, kind, state}, patch/swarm {state}, patch/volunteer {state}, patch/cleared {row},
//   patch/trucked {n}, patch/focus {x, z, zoom} (glide request for toast-only intros), plus toast/sound/alert/coins.
//
// Cross-slice helpers (season.js calls these; all take the state first and never throw):
//   primeStock, fullness, take, rowsWithPrime, barnStock, barnTake, restockRow, cutToBarn, varietiesInPrime,
//   truckedShare, firstImpressionBad, varietyBonus, noteUnmet, honeyTake, fadMul, fadTolerance, shinyAt, shinyGrab,
//   displayVariety, yieldOf, projectDemand.
import { T } from './tuning.js';
import { dayOf, monthOf, label, isWeekend, weekends, weekendIndex, weekendMult, secondsPerDay, realSeconds, LAST_DAY, EVE } from './calendar.js';
import { ROWS, rowZ, PLACES, SWARM_SPOTS, VINE_SPOTS } from './layout.js';
import { makeRng, next, chance, pick, weighted } from './rng.js';
import { clamp, round2, round3, hash32, fill } from './util.js';
import { bugsShown, bugsAfter, playHunt, LINES as HUNT } from './hunt.js';   // [E] the bug hunt
import { has, count, hired, spend, canAfford } from './economy.js';
import { activate, deactivate, isActive, getActive, fireNow } from './events.js';
import { LINES as STORY, quietForChatter } from './story.js';
import { LINES as T_MS } from './lines-mischief.js';   // [A] the swarm's and the volunteer's lines

const P = T.patch, VT = T.varieties, G = P.growth, CAT = T.events.cat;
const TB = P.table, SH = P.shelf, FJ = P.fogJob, HV = P.hives;   // [B] the Table, the crates, the June fog job, honey
const dCache = new Map();
const D = (x) => { if (typeof x === 'number') return x; let d = dCache.get(x); if (d === undefined) dCache.set(x, (d = dayOf(x))); return d; };
const SEP1 = D('Sep 1'), OCT1 = D('Oct 1'), JUN1 = D('Jun 1');
export const VARIETIES = Object.keys(VT);
export const yieldOf = (v) => VT[v]?.fruit ?? 0;
const fail = (reason, extra) => ({ ok: false, reason, ...extra });
const grows = (s) => s.clock.phase === 'grow';
const live = (s) => s.clock.phase === 'grow' || s.clock.phase === 'october';
const u01 = (...k) => hash32(...k) / 4294967296;           // stable per-key noise for bots (never consumes a stream)

// ------------------------------------------------------------ line pool (voices from design §11)
export const LINES = {
  names: { classic: 'Classic', mini: 'Mini', white: 'White', warty: 'Warty', cinderella: 'Cinderella', blue: 'Blue' },
  full: { classic: 'Cove Classic', mini: 'Jack Be Little', white: 'Lumina', warty: 'Knucklehead', cinderella: 'Cinderella', blue: 'Jarrahdale' },
  loved: { classic: 'Everyone. Pelicans adore them.', mini: 'Every kid. Possum joeys, always.', white: 'Foxes, raccoons and photo families.',
    warty: 'Coyotes, owls, skunks. Kids want "the weird one".', cinderella: 'Foxes, photo families, decorators.', blue: 'Beavers, owls and old-timers.' },
  gran: {
    plant2: 'Tap a row. The bar shows when it would ripen. Orange on a weekend is money.',
    planned: "That's how I'd do it. Waves, sweet pea. Never all at once.",
    barn0: "A ripe pumpkin sells full price for about ten days. Then it goes soft and sells for half. Then it rots.",
    barn2: "Big ones first: a barn spot's worth more with a Classic in it. Minis keep fine in the field.",
    barnMissed: "Those went soft on the vine. Next ripe row, cut 'em before they turn, sweet pea.",
    bugs2: 'Tap the bug pin, then squish fast. Quick paws make a combo.',
    replant: 'Pull it up and start again? Costs seed again, sweet pea.',
  },
  // (line 2 points at the crates: a thirsty row loses days, and the days are October's)
  hal: { water2: 'Thirsty rows lose days, and lost days slide your October crates. Water when the ring runs low. Awooo!' },
  mayor: {
    store1: 'Hear ye! On October first your field becomes a store. Full rows sell. Bare rows... embarrass.',
    store2: 'Row one faces the gate: your shop window, so to speak. First impressions! I say so into my pouch daily.',
  },
  edna: {
    y2: "NEW AT THE GRANGE: WHITE AND WARTY SEED. I mean, they're in stock. Lumina and Knucklehead.",
    y3: 'CINDERELLA AND BLUE ARRIVE IN COVE. Seed, I mean. Blue keeps forever but must go in by June 5.',
    fad: "FAD WATCH: CITY WANTS {VARIETY}. We're {pct} percent sure. Roughly. Ish.",
    held: 'FAD HOLDS: {VARIETY} STILL HOT. The city remains predictable. For now.',
    fizzled: 'FAD FIZZLES: NOBODY WANTS {VARIETY}. We regret the headline. Slightly.',
    flipped: "FAD FLIPS: {VARIETY} OUT, {VIRAL} IN. Our sources say 'vibes'.",
  },
  moss: {
    mildew1: "White dust on the leaves... that's Marlene. Damp days. Damp... zzz.",
    mildew2: "Milk spray. Ten dollars a row. Don't ask me why milk. Nobody knows why milk.",
    mildew3: 'Warty and Blue shrug it off... the others sulk.',
  },
  ladybug: 'Go on, darlings. Row {row} is all yours.',
  raccoons: { title: 'A whisper from a trench coat', text: "40 Classics a lot, $200, in your barn tomorrow. Folks might notice they're from the valley." },
  toast: {
    planted: 'Row {row} planted: {Variety}.', cantAfford: "Couldn't afford seed for row {row}. The plan's on hold.",
    thirsty: 'The patch is thirsty. The leaves are drooping.', bugs: 'Squash bugs on row {row}!', bugsGone: 'The first cold night sent the squash bugs packing.',
    mildew: 'Powdery mildew on row {row}.', ripe: 'Row {row} is ripe! {Variety} in prime.', ripeWeekend: 'Row {row} went prime right on a weekend. Nailed it.',
    cut: '{n} to the barn.', restock: '{n} restocked into row {row}.', honey: '+{n} jars of honey for the stand.',
    honeyFull: 'The hives are full of honey.', honeyIntro: 'The hives are full! Tap the jars to collect honey.',
    cleared: 'Row {row} cleared! The bramble had a good run.', trucked: 'The raccoons left {n} Classics at the barn door. Do not ask.',
    swarmHive: 'The swarm moved in: a free hive! {n} hives now.', swarmJars: 'No room for another hive, so the swarm paid rent: +{n} jars.',
    swarmGone: 'The swarm drifted off over the ridge.', shinyLost: 'The shiny on row {row} went soft. Marlene giveth...', shinyGone: 'Somebody bought your shiny without noticing.',
    volunteerRipe: 'The {spot} pumpkin is ripe. Go and get it.', volunteer: 'Harvested the {spot} pumpkin. Into the barn it goes.',
    soldShiny: 'Sold to a collector for {amt}.', displayShiny: 'On display at the stand. Folks are already pointing.', auctionShiny: 'Saved for the weigh-off auction.',
  },
  swarm: {
    scarecrow: "Your bees have moved onto the scarecrow's head. He seems fine with it.",
    sail: "Your bees have moved onto the shade sail. It's a bee sail now.",
    cupola: 'Your bees have moved into the barn cupola. Very stately of them.',
    giantStem: "Your bees have settled on {name}'s stem. She's being very brave about it.",
    weighmasterHat: "Your bees have landed on the Weighmaster's hat. He has not reacted.",
  },
  spots: { barnRoof: 'barn-roof', dockEnd: 'dock', lighthouse: 'lighthouse', maze: 'corn-maze' },
  vine: {
    barnRoof: 'A pumpkin is growing on the barn roof. Nobody planted it.',
    dockEnd: 'A pumpkin vine is growing off the end of the dock. Nobody planted it.',
    lighthouse: 'A pumpkin is growing under the lighthouse. The keeper denies everything.',
    maze: 'A pumpkin vine is growing in the corn maze. It seems to know the way out.',
  },
  shiny: {
    title: 'A shiny!',
    sphere: 'A perfectly round pumpkin. Mathematicians have been informed.',
    heart: 'A heart-shaped pumpkin. Mayor Pouch is weeping into his pouch.',
    smiley: 'A pumpkin with a scar like a smile. It seems happy here.',
    twins: 'Two pumpkins fused at the hip. Double the gourd.',
    beak: "A pumpkin shaped exactly like the Mayor's beak. He has been informed.",
    weighmaster: "A pumpkin with the Weighmaster's face. Unimpressed, somehow.",
    sell: 'Sell it now', sellSub: 'A collector pays {amt}, today', display: 'Display it at the stand', displaySub: 'Buzz every day; folks at the stand smile',
    auction: 'Auction it at the weigh-off', auctionSub: '{lo} to {hi}, depending on the bidding',
  },
  report: {
    head: 'Row {row} · {Variety} · planted {planted}',
    ripe: ' · ripe {ripe}', sold: ' · sold {sold}/{set}',
    // when fruit moved through the barn (October restocks), "sold 171/82" would be nonsense: say where it went
    grew: ' · grew {set} · sold {sold} here', restockedIn: ', with restocks from the barn', cutTo: ', the rest to the barn',
    soft: '{soft} went soft {when}. Try planting ~{days} days later, or cut to the barn.',
    green: "{green} never ripened. Plant by about {by}.",
    soldOut: 'Sold out {when}. Folks wanted {unmet} more.',
    bugs: 'Bugs cost about {lost} fruit. Squish early.',
    dry: 'Thirsty days cost about {lost} fruit.',
    mildew: 'Mildew cost about {lost} fruit. Milk spray, or Warty and Blue.',
    good: 'Nicely timed.', rested: 'Row {row} · rested this year.',
  },
  goals: { milk: 'Spray row {row} with milk' },
  // ---------------------------------------------------------- [B] the Planting Table and the October crates (plan §8)
  // The May 20 lesson (Gran, an intro), then her chalk on the Table itself: she teaches rows 1 and 2 and hands over.
  plan: ["Seed's come. Let's plan October now, before it's planting weather.",
    'A weekend wants about fifty big ones. A Classic row gives a hundred. One row of minis does the lot.'],
  table: {
    row1: 'Row 1, up front: Classics for the first weekend. Slide the bar onto W1.',
    row1b: "See W1's big side fill? That's October. Plant it, sweet pea.",
    row2: "Minis. Kids want one each. One row does the month if it's ripe for two weekends.",
    handover: "Rows 3 and 4 are yours. Fill the crates. W4's the big one.",
    bare: "W{n}'s looking bare. You've till Jul 10 to fix it. I'll nag.",
    askBig: "W{n}'s short of big ones. A Classic for W{n} would do it.",
    askSmall: 'W{n} needs minis. Kids riot, sweet pea. Ask me how I know.',
    askNone: 'Nothing to fix. Go and have a biscuit.',
    clock: "Clock stopped · Gran's put the kettle on",
  },
  goalPlan: 'Plan October (tap the patch)', goalCrates: "Fill October's crates (rows 3 and 4)", goalPlanLate: 'Plan a row by Jul 10, or October has nothing to sell',
  lapsePlan: ['gran', "No rows this year? The giant will have to carry us, sweet pea."],
  // sowing days (a moment each: one beat with Grandpa's note and the First that rides it, rulings R2)
  window: "Planting window's open. Row {r} goes in {date}.", windowNone: "Planting window's open. Plan a row by Jul 10.",
  sown: "Row {r}'s in: {Variety}s, ripe for {targets}. ${seed}.", sownMany: 'Rows {rs} are in, ripe for {targets}. ${seed}.',
  sownLate: 'Row {r} went in on {date}: {Variety}s, ripe for {targets}.',
  // the crates: a level word each; a slip names its weekend, its cause and its lever (rulings R9)
  level: ['empty', 'thin', 'good', 'full'],
  slip: {
    dry: 'W{n} slipping: the patch is thirsty. Row {r} lost {d}.',
    bugs: 'W{n} slipping: bugs on row {r}. Squish them.',
    mildew: 'W{n} slipping: mildew on row {r}. Milk spray.',
  },
  fabThirsty: 'THIRSTY · W{n}',
  // Gran's tally speaks only when a crate's level moved since the last one, and always names a lever (rulings R9)
  tally: {
    head: 'Sunday tally: W1 {l1}, W2 {l2}, W3 {l3}, W4 {l4}.',
    dry: "Row {r}'s been thirsty, and W{n} felt it. Water when the ring runs low.",
    bugs: "Row {r}'s bugs ate into W{n}. Squish 'em young, sweet pea.",
    mildew: "Mildew on row {r} cost W{n}. Milk spray. Don't ask me why milk.",
    fog: "Marlene's sulk cost W{n} a few days. Keep the rows watered and they'll catch up.",
    late: "W{n}'s short. Row {r} isn't in yet: aim it at W{n}.",
    back: "W{n}'s back on track. The water did it.",
    set: "W{n} filled up: row {r} set {k}. Keep 'em watered till they ripen, sweet pea.",
    sun: 'A sunny week, and W{n} filled up. Keep the water coming.',
  },
  // row milestones: low-salience toasts (year 1 says them all; years 2+ only a thin set)
  milestone: { flower: "Row {r}'s in flower. Bees work clear days.", set: "Row {r} set {n} {Variety}s. W{w}'s crate is real now.",
    setNone: 'Row {r} set {n} {Variety}s.', bees: ' +{m} from the bees.', thin: 'Row {r} set thin: {n} {Variety}s. The fog dawns, probably.' },
  // honey after the lesson (rulings R4): Gran shelves it weekly in year 1; from year 2 the hives ask once a week
  honey: { shelved: 'Gran shelved {n} jar{s} of honey for the stand.' },
  // years 2+: Gran opens the Table on Apr 20 with last October in one line (rulings R13; the Seed Letter's par is Wave 2)
  letter: {
    ranOut: "Last October W{n} ran out of {kind} by Sunday.", soft: "Last October {k} went soft before W{n}.",
    both: 'Last October W{n} ran out of {kind}, and {k} went soft before W{m}.', fine: 'Last October went about right. Same again, only better, sweet pea.',
    plan: "The Table's out. My usual's on it if you're busy, sweet pea.",
    lapse: "No plan? I've put my usual in. Don't make that face.",
    big: 'big ones', small: 'minis', goal: 'Plan October (tap the patch)',
  },
  // the safety net (rulings R14): the last sowing day, one tap
  safety: { title: 'Last sowing day', text: "Row {r}'s empty. {Variety}s in it? One tap.", yes: '{Variety}s in it · ${seed}',
    yesSub: 'Sown this morning, ripe for {targets}', no: 'Leave it empty', noSub: 'It rests till next year' },
};
const vname = (v) => LINES.names[v] || v;

// ------------------------------------------------------------ rows
function freshRow(open) {
  return {
    open, variety: null, plantedDay: null, progress: 0, stage: open ? 'tilled' : 'bramble',
    stock: { green: 0, prime: 0, soft: 0, rotten: 0 }, health: P.health.start, bugs: 0, mildew: 0, shiny: null,
    late: false, plan: null, set: 0, beeFrac: 0, by: {}, fruit: [], rot: [],
    beeDays: 0, beeGood: 0, sprayed: false, sprayUntil: -1, milkUntil: -1, drop: 0, ripeDay: null, midDay: null,
    // [B] growth days lost to a dry patch and to Marlene's pea soup (the slips and the tally say them), the row's milestones
    // said this year, and a slow start (the June fog job); [A] reads shieldUntil (the possum's joeys)
    lost: { dry: 0, fog: 0 }, told: 0, slow: 0, shieldUntil: 0,
  };
}
const ownsRow = (s, r) => r < P.openY1 || !!s.owned?.['row' + (r + 1)];
const planted = (row) => row.open && row.plantedDay != null;
const growing = (row) => planted(row) && row.stage !== 'done' && row.stage !== 'ripe';
const rowsOf = (s) => s.patch.rows;
const plantedRows = (s) => rowsOf(s).filter((row) => planted(row) && row.stage !== 'done').length;
export const displayVariety = (row) => row?.variety || row?.fruit?.find((c) => c.n > 0)?.v || null;
const cohortL = (row, c) => VT[c.v].prime;

// Recompute the render-facing summary of a row (stock, by-variety stock, stage) after any change.
function refresh(s, row) {
  const st = { green: 0, prime: 0, soft: 0, rotten: 0 }, by = {};
  row.fruit = row.fruit.filter((c) => c.n > 0);
  for (const c of row.fruit) {
    st[c.st] += c.n;
    const b = (by[c.v] ||= { green: 0, prime: 0, soft: 0 });
    b[c.st] += c.n;
  }
  const d = s.clock.day;
  row.rot = row.rot.filter((x) => d - x.d < P.aging.rottenShow);
  st.rotten = row.rot.reduce((a, x) => a + x.n, 0);
  row.stock = st; row.by = by;
  row.stage = stageOf(row);
}
function stageOf(row) {
  if (!row.open) return 'bramble';
  if (row.plantedDay == null) return 'tilled';
  const own = row.fruit.filter((c) => c.off != null);
  if (row.set && !own.length) return 'done';
  if (own.some((c) => c.st !== 'green')) return 'ripe';
  let stage = 'seeded';
  for (const [at, name] of P.stages) if (row.progress >= at) stage = name;
  return stage;
}

// ------------------------------------------------------------ growth, set and ripening (§4)
const growthOn = (f, heat) => (heat ? G.heat : G.base - G.fog * f);
const frozen = (s) => s.clock.day >= D(P.moisture.frozenFrom);
function beeMul(s, row) { return 1 + P.bees.perHive * s.patch.hives * (row.sprayed ? 0 : row.beeFrac); }
const compost = (s) => (has(s, 'compost') ? P.compost : 1);

// n = round(yield x health x (1 + 0.03 x hives x beeFrac) x compost), split into 5 cohorts (largest remainder)
function setFruit(s, row) {
  row.beeFrac = row.beeDays ? row.beeGood / row.beeDays : s.weather.f < P.bees.f ? 1 : 0;
  const n = Math.round(yieldOf(row.variety) * row.health * beeMul(s, row) * compost(s));
  row.set = n; row.setDay = s.clock.day;
  const { offsets, shares } = P.cohorts;
  const raw = shares.map((k) => k * n), base = raw.map(Math.floor);
  let left = n - base.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - base[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) base[i]++; });
  row.fruit = row.fruit.filter((c) => c.off == null);
  offsets.forEach((off, i) => row.fruit.push({ v: row.variety, n: base[i], off, st: 'green', age: 0, sa: 0, tr: false }));
  repOf(s, row).set = n;
  repOf(s, row).beeFrac = round2(row.sprayed ? 0 : row.beeFrac);
}

function growRow(s, ctx, r, row) {
  const w = s.weather, spec = VT[row.variety];
  if (row.progress >= spec.dtm + P.cohorts.offsets.at(-1)) return;
  const dry = !frozen(s) && s.patch.moisture < G.dryBelow, g = growthOn(w.f, w.heat);
  row.progress = round3(row.progress + g * (dry ? G.dryMul : 1) * (row.slow > 0 ? FJ.slowMul : 1));
  if (row.slow > 0) row.slow--;
  // [B] the days it lost, for the slips and the tally: a dry day costs (1 - dryMul) of a day's growth, a pea-soup day what
  // it fell short of the month's usual weather
  if (row.lost) {
    if (dry) row.lost.dry = round3(row.lost.dry + (1 - G.dryMul));
    if (w.f > SH.fogF && !w.heat) { const c = growthOn(climF(s, s.clock.day), false); if (c > g) row.lost.fog = round3(row.lost.fog + (c - g) / c); }
  }
  const [b0, b1] = P.beeWindow;
  if (!row.set && row.progress >= b0) { row.beeDays++; if (w.f < P.bees.f) row.beeGood++; }
  if (!row.set && row.progress >= P.fruitSetAt) setFruit(s, row);
  if (!row.set) return;
  for (const c of row.fruit) {
    if (c.off == null || c.st !== 'green' || row.progress < spec.dtm + c.off) continue;
    c.st = 'prime'; c.age = 0; c.rd = s.clock.day + 1;
    if (c.off === 0) row.midDay = c.rd;
    const first = row.ripeDay == null;
    if (first) { row.ripeDay = s.clock.day + 1; repOf(s, row).ripeDay = row.ripeDay; }
    ctx.emit({ type: 'patch/ripe', row: r, first, weekend: isWeekend(s.clock.day + 1), n: c.n });
    if (first) ctx.emit({ type: 'toast', text: fill(isWeekend(s.clock.day + 1) ? LINES.toast.ripeWeekend : LINES.toast.ripe, { row: r + 1, Variety: vname(row.variety) }), cls: 'good', icon: 'pumpkin' });
    maybeShiny(s, ctx, r, row, c);
  }
}

// Prime ages 1/day (1.5 on heat-wave days; prime life x0.7 with mildew), soft fruit rots after its soft days.
function ageRow(s, row, rate = 1) {
  const heat = s.weather.heat && rate === 1 ? P.aging.heat : 1;
  for (const c of row.fruit) {
    if (c.st === 'prime') {
      c.age += rate * heat / (row.mildew > 0 ? P.aging.mildewLife : 1);
      if (c.age >= cohortL(row, c) - 1e-9) { c.st = 'soft'; c.sa = 0; softened(s, row, c); }
    } else if (c.st === 'soft') {
      c.sa += rate;
      if (c.sa >= VT[c.v].soft - 1e-9) { rotted(s, row, c); c.n = 0; }
    }
  }
}
function softened(s, row, c) {
  const R = repOf(s, row);
  if (!R) return;
  R.soft += c.n; R.softDaySum += c.n * s.clock.day;
  octOf(s, s.clock.day, (o) => { o.soft += c.n; });
}
function rotted(s, row, c) {
  if (row.rot) row.rot.push({ n: c.n, d: s.clock.day, v: c.v });
  const R = repOf(s, row);
  if (R) R.rotten += c.n;
  else s.patch.report.barn.rotten += c.n;
}

// After fruit set a sick vine drops green fruit in proportion to the health it loses (youngest cohorts first).
// [A] exported: Pamela grazing a planted row (years 2+) hurts it this way (cause 'goat').
export function hurt(s, row, dh, cause) {
  if (dh <= 0) return;
  const h0 = row.health, h1 = Math.max(P.health.floor, h0 - dh);
  row.health = round3(h1);
  const R = repOf(s, row);
  if (R) R.lost[cause] ??= 0;
  if (!row.set) { if (R) R.lost[cause] += yieldOf(row.variety) * (h0 - h1); return; }
  const green = row.fruit.filter((c) => c.off != null && c.st === 'green');
  const n = green.reduce((a, c) => a + c.n, 0);
  if (!n || h0 <= 0) return;
  row.drop += n * (h0 - h1) / h0;
  if (R) R.lost[cause] += n * (h0 - h1) / h0;
  let k = Math.floor(row.drop);
  row.drop -= k;
  for (const c of green.sort((a, b) => b.off - a.off)) { const t = Math.min(c.n, k); c.n -= t; k -= t; if (!k) break; }
}

// ------------------------------------------------------------ pests (§4)
function bugsDay(s, ctx, r, row) {
  const B = P.bugs, d = s.clock.day;
  if (!growing(row) || row.stock.green + (row.set ? 0 : 1) === 0) { row.bugs = 0; return; }
  if (row.bugs > 0) {
    row.bugs = round3(Math.min(1, row.bugs + B.grow));
    hurt(s, row, B.health * row.bugs, 'bugs');
    if (hired(s, 'ladybug') && row.bugs >= T.hires.ladybug.clears) {
      row.bugs = 0;
      ctx.say('ladybug', [fill(LINES.ladybug, { row: r + 1 })]);
      ctx.emit({ type: 'patch/bugsCleared', row: r, by: 'ladybug' });
    }
    return;
  }
  if (d < D(B.from) || d - row.plantedDay < B.minAge || d < row.sprayUntil) return;
  if (s.clock.year === 1 && !s.unlocks.bugs) return;           // year 1: no bugs before Gran's Jul 20 lesson
  const f = s.weather.f, rows = rowsOf(s);
  let p = B.rate * (f < B.clearF ? B.clearMul : f > B.fogF ? B.fogMul : 1);
  for (const k of [r - 1, r + 1]) if (rows[k]?.bugs >= B.infested) p += B.neighbour;
  if (has(s, 'compost')) p *= B.compost;
  if (!chance(ctx.rng('patch'), p)) return;
  // [A] the possum's joeys herd bugs off this row while she rests: no new cluster until shieldUntil (checked after the roll,
  // so the shield never moves the patch stream for the other rows)
  if (d < (row.shieldUntil || 0)) return;
  row.bugs = B.start;
  repOf(s, row).clusters++;
  ctx.emit({ type: 'patch/bugs', row: r });
  ctx.alert('bugs', { text: fill(LINES.toast.bugs, { row: r + 1 }), cls: 'warn', row: r });
}

// [E] the bots on a row with bugs. A policy with hands { skill, diligence } hunts: on a bug day it gets to the pin with
// probability diligence (keyed by row and day: a person doesn't always look at once) and plays the hunt itself (hunt.js
// playHunt, a thumb of that skill, seeded by row and day); with bugs left when the ring runs out it goes again, up to
// T.hands.bot.sessions a day. bugs: 'spray' sprays every cluster instead (a balance policy). A policy without hands
// squishes a share P_.squish of the clusters, as before.
function botBugs(s, P_, r, row) {
  const y = s.clock.year, d = s.clock.day, H = P_.hands;
  if (P_.bugs === 'spray') return canAfford(s, P.bugs.spray) ? [{ type: 'patch/spray', row: r }] : [];
  if (!H) {
    if (u01(s.seed, y, r, row.plantedDay, repOf(s, row)?.clusters || 0, 'sq') >= (P_.squish ?? 1)) return [];
    return Array.from({ length: Math.ceil(row.bugs / P.bugs.squish) }, () => ({ type: 'patch/squish', row: r }));
  }
  if (u01(s.seed, y, d, r, 'hunt') >= H.diligence) return [];
  const acts = [];
  for (let k = 0, b = row.bugs; k < T.hands.bot.sessions && b > 0; k++) {
    const { hits } = playHunt({ n: bugsShown(b), skill: H.skill, seed: hash32(s.seed, y, d, r, k, 'hunt') });
    acts.push({ type: 'patch/hunt', row: r, hits });
    b = bugsAfter(b, hits);
  }
  return acts;
}

function mildewDay(s, ctx, r, row) {
  const Mi = P.mildew, d = s.clock.day;
  if (!planted(row) || row.stage === 'done') { row.mildew = 0; return; }
  if (row.mildew > 0) {
    if (d <= D(Mi.window[1])) row.mildew = round3(Math.min(1, row.mildew + Mi.grow));
    hurt(s, row, Mi.health, 'mildew');
    if (hired(s, 'ladybug')) { row.mildew = 0; ctx.emit({ type: 'patch/sprayed', row: r, kind: 'ladybug' }); }
    return;
  }
  if (s.clock.year < Mi.fromYear || d < D(Mi.window[0]) || d > D(Mi.window[1]) || d < row.milkUntil) return;
  const f = s.weather.f;
  let p = (Mi.base + Mi.fog2 * f * f) * VT[row.variety].mildew * (s.patch.moisture > P.moisture.wet ? P.moisture.wetMildew : 1);
  if (has(s, 'compost')) p *= Mi.compost;
  if (!chance(ctx.rng('patch'), p)) return;
  infectMildew(s, ctx, r, row);
}
function infectMildew(s, ctx, r, row) {
  row.mildew = P.mildew.start;
  repOf(s, row).mildew++;
  ctx.emit({ type: 'patch/mildew', row: r });
  if (s.unlocks.mildew) ctx.emit({ type: 'toast', text: fill(LINES.toast.mildew, { row: r + 1 }), cls: 'warn', icon: 'alert' });
}

// ------------------------------------------------------------ water (§4)
const waterBill = (s) => P.water.perRow * plantedRows(s);
function water(s, ctx, auto = false) {
  const bill = waterBill(s);
  if (!spend(s, ctx, bill, 'water')) return false;
  s.patch.moisture = round3(Math.min(1, s.patch.moisture + P.water.add));
  s.patch.watered++;
  ctx.emit({ type: 'patch/watered', auto, M: s.patch.moisture });
  return true;
}
function moistureDay(s, ctx) {
  const M = P.moisture, w = s.weather, pa = s.patch;
  if (!pa.wet || frozen(s)) return;
  const before = pa.moisture;
  pa.moisture = round3(clamp(pa.moisture - (M.base + M.sun * (1 - w.f) + M.heat * (w.heat ? 1 : 0)) + M.rain * (w.rain ? 1 : 0), 0, 1));
  if (has(s, 'irrigation') && pa.moisture < T.shop.irrigation.below && plantedRows(s)) water(s, ctx, true);
  // (not on the last night of September: from Oct 1 Gran keeps the hose going and the Water button is gone)
  if (before >= M.dry && pa.moisture < M.dry && s.unlocks.patchWater && plantedRows(s) && s.clock.day + 1 < D(M.frozenFrom)) ctx.alert('thirsty', { text: LINES.toast.thirsty, cls: 'warn' });
}

// ------------------------------------------------------------ the barn (§4)
export const barnCap = (s) => (has(s, 'loft') ? P.barn.loft : P.barn.cap);
const barnTotal = (s) => s.patch.barnLots.reduce((a, l) => a + l.n, 0);
export const barnFree = (s) => Math.max(0, barnCap(s) - barnTotal(s));
function barnSummary(s) {
  const b = {};
  s.patch.barnLots = s.patch.barnLots.filter((l) => l.n > 0);
  for (const l of s.patch.barnLots) b[l.v] = (b[l.v] || 0) + l.n;
  s.patch.barn = b;
}
function barnDay(s) {
  const k = P.aging.barn;
  for (const l of s.patch.barnLots) {
    if (l.st === 'prime') { l.age += k; if (l.age >= VT[l.v].prime - 1e-9) { l.st = 'soft'; l.sa = 0; s.patch.report.barn.soft += l.n; } }
    else if (l.st === 'soft') { l.sa += k; if (l.sa >= VT[l.v].soft - 1e-9) { s.patch.report.barn.rotten += l.n; l.n = 0; } }
  }
  barnSummary(s);
}

// ------------------------------------------------------------ cross-slice helpers (season.js)
/** Prime fruit in a row, of one variety or all. @returns {number} */
export function primeStock(s, r, variety) {
  const row = rowsOf(s)[r];
  if (!row) return 0;
  return variety ? row.by[variety]?.prime || 0 : row.stock.prime;
}
/** Fullness of a row = prime stock / yield of its variety, capped at 1 (§4 "the field is the store"). @returns {number} 0..1 */
export function fullness(s, r) {
  const row = rowsOf(s)[r], v = displayVariety(row);
  if (!row || !v) return 0;
  return Math.min(1, row.stock.prime / yieldOf(v));
}
/** Pumpkins the renderer draws for a stock count: round(slots x stock / yield) (16 slots large, 28 mini). */
export function displayCount(v, n) {
  if (!v || n <= 0) return 0;
  const slots = VT[v].large ? P.display.large : P.display.mini;
  return Math.min(slots, Math.max(1, Math.round(slots * n / yieldOf(v))));
}
/**
 * Take fruit out of a row (a family picks, a sale, a goat). Oldest prime fruit first, so good sales mean less waste.
 * @param {object} s state  @param {number} r row  @param {string|null} variety  (null: any)  @param {number} n
 * @param {{ soft?: boolean, out?: object }} [opts] soft: take soft fruit instead (half price); out receives { trucked }
 * @returns {number} how many were taken (may be fewer than n)
 */
export function take(s, r, variety, n, { soft = false, out } = {}) {
  const row = rowsOf(s)[r];
  if (!row || !(n > 0)) { if (out) out.trucked = 0; return 0; }
  const st = soft ? 'soft' : 'prime';
  const cs = row.fruit.filter((c) => c.st === st && c.n > 0 && (!variety || c.v === variety)).sort((a, b) => (soft ? b.sa - a.sa : b.age - a.age));
  let got = 0, tr = 0;
  for (const c of cs) { const k = Math.min(c.n, n - got); c.n -= k; got += k; if (c.tr) tr += k; if (!soft) soldFrom(s, c.o ?? r, k); if (got >= n) break; }
  if (!got) { if (out) out.trucked = 0; return 0; }
  refresh(s, row);
  const R = repOf(s, row);
  if (R) { if (soft) R.soldSoft += got; else R.sold += got; R.truckedSold += tr; if (!soft && !row.stock.prime && R.soldOutDay == null && s.clock.phase === 'october') R.soldOutDay = s.clock.day; }
  octSale(s, variety || displayVariety(row), got);
  if (row.shiny && !row.stock.prime) { shinyEnd(s, row.shiny.id, 'grabbed'); row.shiny = null; }
  if (out) out.trucked = tr;
  return got;
}
/** Rows holding prime fruit of a variety (or any), front row first. @returns {number[]} */
export function rowsWithPrime(s, variety) {
  return rowsOf(s).map((row, r) => r).filter((r) => primeStock(s, r, variety) > 0);
}
/** Barn stock of a variety (or all): prime only unless { soft: true }. @returns {number} */
export function barnStock(s, variety, { soft = false } = {}) {
  return s.patch.barnLots.filter((l) => (!variety || l.v === variety) && (soft || l.st === 'prime')).reduce((a, l) => a + l.n, 0);
}
/** Take prime fruit straight out of the barn ("Fetch from barn"), oldest first. @returns {number} taken */
export function barnTake(s, variety, n) {
  let got = 0;
  for (const l of s.patch.barnLots.filter((x) => x.st === 'prime' && (!variety || x.v === variety)).sort((a, b) => b.age - a.age)) {
    const k = Math.min(l.n, n - got); l.n -= k; got += k; soldFrom(s, l.o, k); if (got >= n) break;
  }
  s.patch.report.barn.out += got;
  octSale(s, variety || 'classic', got);
  barnSummary(s);
  return got;
}
/**
 * Restock a row from the barn (barn -> row), up to the row's yield. Oldest prime lots first; prefers the given variety,
 * then the row's own variety, then anything. The fruit keeps its age (barn days count at 0.35).
 * @param {{ variety?: string }} [opts] @returns {number} how many moved
 */
export function restockRow(s, r, n = P.barn.restockN, { variety } = {}) {
  const row = rowsOf(s)[r];
  if (!row?.open || !(n > 0)) return 0;
  const lots = s.patch.barnLots.filter((l) => l.st === 'prime' && l.n > 0);
  const want = variety || displayVariety(row);
  const order = (l) => (l.v === want ? 0 : want && VT[l.v].large !== VT[want]?.large ? 2 : 1);
  lots.sort((a, b) => order(a) - order(b) || b.age - a.age);
  if (variety) for (let i = lots.length - 1; i >= 0; i--) if (lots[i].v !== variety) lots.splice(i, 1);
  const cap = Math.max(0, yieldOf(want || lots[0]?.v) - row.stock.prime);
  let moved = 0;
  for (const l of lots) {
    const k = Math.min(l.n, n - moved, cap - moved);
    if (k <= 0) break;
    l.n -= k; moved += k;
    const same = row.fruit.find((c) => c.off == null && c.v === l.v && c.st === 'prime' && c.tr === l.tr && c.o === l.o && Math.abs(c.age - l.age) < 0.5);
    if (same) same.n += k; else row.fruit.push({ v: l.v, n: k, off: null, st: 'prime', age: l.age, sa: 0, tr: l.tr, o: l.o });
    if (!row.variety) row.variety = l.v;
  }
  if (!moved) return 0;
  barnSummary(s); refresh(s, row);
  const R = repOf(s, row);
  if (R) R.restocked += moved;
  s.patch.report.barn.out += moved;
  return moved;
}
/** Cut a row's prime fruit to the barn, oldest first, up to n and the barn's capacity. @returns {number} how many moved */
export function cutToBarn(s, r, n = Infinity) {
  const row = rowsOf(s)[r];
  if (!row) return 0;
  // a shiny stays in the field: you cut everything but the sparkly one
  let free = Math.min(barnFree(s), row.stock.prime - (row.shiny ? 1 : 0), n), moved = 0;
  for (const c of row.fruit.filter((x) => x.st === 'prime').sort((a, b) => b.age - a.age)) {
    const k = Math.min(c.n, free);
    if (k <= 0) break;
    c.n -= k; free -= k; moved += k;
    const o = c.o ?? r, lot = s.patch.barnLots.find((l) => l.v === c.v && l.st === 'prime' && l.tr === c.tr && l.o === o && Math.abs(l.age - c.age) < 0.5);
    if (lot) lot.n += k; else s.patch.barnLots.push({ v: c.v, n: k, age: c.age, st: 'prime', sa: 0, tr: c.tr, o });
  }
  if (!moved) return 0;
  barnSummary(s); refresh(s, row);
  const R = repOf(s, row);
  if (R) R.cut += moved;
  s.patch.report.barn.cut += moved;
  return moved;
}
/** Recompute every row's stock and stage (after a test or another slice edits cohorts directly). */
export function refreshRows(s) { for (const row of rowsOf(s)) refresh(s, row); barnSummary(s); }
/** Where a row's squash-bug cluster sits (x): the renderer draws it there and the bug pin points at it. */
export const bugSpot = (r) => -7 + ((r * 5) % 7) * 2;
/** Distinct varieties with prime fruit anywhere in the field. @returns {string[]} */
export function varietiesInPrime(s) {
  const out = new Set();
  for (const row of rowsOf(s)) for (const [v, b] of Object.entries(row.by)) if (b.prime > 0) out.add(v);
  return VARIETIES.filter((v) => out.has(v));
}
/** Share of a row's prime fruit that was trucked in (season rolls "noticed" with it). @returns {number} 0..1 */
export function truckedShare(s, r) {
  const row = rowsOf(s)[r];
  if (!row?.stock.prime) return 0;
  return row.fruit.filter((c) => c.st === 'prime' && c.tr).reduce((a, c) => a + c.n, 0) / row.stock.prime;
}
/** First impression (§4): row 1 under 30% full, or still green, when the gate opens. */
export function firstImpressionBad(s) {
  const row = rowsOf(s)[0];
  return !row?.stock.prime || fullness(s, 0) < P.fullness.firstImpression;
}
/** Variety bonus (§4): +3 satisfaction per distinct prime variety beyond the first, up to +9. */
export function varietyBonus(s) {
  return Math.min(P.fullness.varietyMax, P.fullness.varietySat * Math.max(0, varietiesInPrime(s).length - 1));
}
/** Record wants nobody could meet (for the row report cards: "Kids wanted 212 more minis"). */
export function noteUnmet(s, variety, n = 1) {
  const u = s.patch.report.unmet; u[variety] = (u[variety] || 0) + n;
  if (s.clock.phase === 'october') octOf(s, s.clock.day, (o) => { o[VT[variety]?.large === false ? 'missSmall' : 'missBig'] += n; }, true);
}
/** Take honey jars off the stand shelf (season sells them at $10). @returns {number} taken */
export function honeyTake(s, n = 1) { const k = Math.max(0, Math.min(s.patch.honeyJars, Math.floor(n))); s.patch.honeyJars -= k; return k; }
/** Fad multiplier for adult want weights (§7): held x1.8, fizzled x0.8, the surprise viral variety x1.5 from W2. */
export function fadMul(s, variety, day = s.clock.day) {
  const f = s.patch?.fad, F = T.species.fads;
  if (!f) return 1;
  if (variety === f.variety) return f.held ? F.hold : F.fizzle;
  if (variety === f.viral && day >= weekends()[F.viralWeekend - 1].sat) return F.viralMul;
  return 1;
}
/** Price tolerance bonus for a held fad (Premium costs no purchase chance for it). @returns {number} 0 or 0.25 */
export const fadTolerance = (s, variety) => (s.patch?.fad?.held && s.patch.fad.variety === variety ? T.species.fads.priceTolerance : 0);
/** The shiny sitting in a row, if any (season: a visiting kid grabs it 20% of visits). */
export const shinyAt = (s, r) => (rowsOf(s)[r]?.shiny ? s.patch.shinies.find((x) => x.id === rowsOf(s)[r].shiny.id && x.state === 'field') || null : null);
/** A visiting kid grabs the row's shiny (it sells as a normal pumpkin through take()). @returns {boolean} */
export function shinyGrab(s, ctx, r) {
  const sh = shinyAt(s, r);
  if (!sh) return false;
  shinyEnd(s, sh.id, 'grabbed');
  ctx?.emit({ type: 'patch/shiny', id: sh.id, row: r, kind: sh.kind, state: 'grabbed' });
  return true;
}

// ------------------------------------------------------------ shinies, swarm, volunteer vine, the parking lot (§10)
function maybeShiny(s, ctx, r, row, c) {
  const C = CAT.shiny;
  if (!C.months.includes(monthOf(s.clock.day)) || row.shiny || !(c.n > 0)) return;
  if (!chance(ctx.rng('patch'), c.n / C.perFruit)) return;
  fireNow(s, ctx, 'shiny', { row: r, v: c.v, life: VT[c.v].prime });
}
function shinyEnd(s, id, state) {
  const sh = s.patch.shinies.find((x) => x.id === id);
  if (!sh) return;
  if (sh.state === 'field') sh.state = state;
  for (const row of rowsOf(s)) if (row.shiny?.id === id) row.shiny = null;
  if (!s.patch.shinies.some((x) => x.state === 'field')) deactivate(s, 'shiny');
}
function shinyCard(s, ctx, sh) {
  const C = CAT.shiny, L = LINES.shiny, amt = Math.round(VT[sh.v].price * C.sellMul);
  ctx.card('shiny', {
    eyebrow: `Row ${sh.row + 1} · ${vname(sh.v)}`, title: L.title, text: L[sh.kind], kind: sh.kind, shiny: sh.id,
    choices: [
      { id: 'sell', label: L.sell, sub: fill(L.sellSub, { amt: `$${amt}` }) },
      { id: 'display', label: L.display, sub: L.displaySub },
      { id: 'auction', label: L.auction, sub: fill(L.auctionSub, { lo: `$${C.auction[0]}`, hi: `$${C.auction[1]}` }), primary: true },
    ],
    defaultChoice: 'sell',
  });
}
function newShiny(s, ctx, { row: r, v, life = 10, state = 'field' }) {
  // his face is a callback for growers who have met him: the Weighmaster is never seen before the first weigh-off
  const kinds = Object.keys(CAT.shiny.kinds).filter((k) => k !== 'weighmaster' || s.clock.year > 1);
  const sh = { id: `sh${s.clock.year}-${++s.patch.seq}`, row: r, v, kind: pick(ctx.rng('patch'), kinds), state, day: s.clock.day, until: s.clock.day + life, year: s.clock.year };
  s.patch.shinies.push(sh);
  if (r != null && state === 'field') {
    rowsOf(s)[r].shiny = { id: sh.id, kind: sh.kind };
    activate(s, { id: 'shiny', until: sh.until, x: bugSpot(r) - 2, z: rowZ(r) });   // where the camera director looks
  }
  ctx.emit({ type: 'patch/shiny', id: sh.id, row: r, kind: sh.kind, state });
  ctx.story('shiny', 15, { kind: sh.kind, row: r });
  return sh;
}

const swarmSpots = () => Object.keys(SWARM_SPOTS).filter((k) => k !== 'weighmasterHat');
const daysFor1x = (seconds, d) => Math.max(1, Math.ceil(seconds / secondsPerDay(d)));
/** Land a swarm (the director's swarm event, or the weigh-off slice's 15% on the Weighmaster's hat). */
export function startSwarm(s, ctx, spot) {
  const p = SWARM_SPOTS[spot];
  activate(s, { id: 'swarm', until: s.clock.day + daysFor1x(CAT.swarm.tapSeconds, s.clock.day), x: p.x, z: p.z, data: { spot, y: p.y } });
  s.patch.swarm = { spot, day: s.clock.day };
  ctx.emit({ type: 'patch/swarm', state: 'landed', spot });
  ctx.emit({ type: 'sound', name: 'buzz' });
}
const swarmText = (s) => fill(LINES.swarm[s.patch.swarm?.spot] || LINES.swarm.scarecrow, { name: s.giant?.name || 'your giant' });

// [A] the swarm's look mode (plan §3.2): in year 1, before the honey lesson, a swarm is a "bee day after a sulk" (the first
// clear morning after days of pea soup) on the scarecrow's hat: a ✦ to look at, nothing to catch (swarm_look). After honey,
// and in years 2+, it is the director's catchable swarm as before (its own task pin, ui/patch.js).
const MS = T.mischief.swarm;
const swarmLook = (s) => s.clock.year === 1 && !s.unlocks.hives;
const afterSulk = (s) => {
  const d = s.clock.day, ds = s.weather.days;
  if (s.weather.f >= MS.clearF || d < MS.sulkDays) return false;
  for (let k = 1; k <= MS.sulkDays; k++) if ((ds[d - k]?.f ?? 0) < MS.sulkF) return false;
  return true;
};
const EVENTS = [
  { // swarm (notable): Jun-Sep, f < 0.4, >= 4 hives. Tap within 15 s of 1x clock: a free hive (if < 6) or +6 jars.
    // ([A] in year 1 before the honey lesson the bees' swarm is a look, the swarm_look delight below, not this one)
    id: 'swarm', cls: 'notable', per: 'day', cooldownDays: CAT.swarm.cooldown, capYear: CAT.swarm.cap,
    when: (s) => grows(s) && CAT.swarm.months.includes(monthOf(s.clock.day)) && s.weather.f < CAT.swarm.f && s.patch.hives >= CAT.swarm.hives && !isActive(s, 'swarm')
      && !swarmLook(s),
    rate: () => CAT.swarm.rate,
    fire(s, ctx, data) { startSwarm(s, ctx, data?.spot || pick(ctx.rng('patch'), swarmSpots())); },
    text: swarmText,
    tap(s, ctx) {
      const C = CAT.swarm, pa = s.patch;
      if (pa.hives < C.maxHives) { pa.freeHives++; syncHives(s); ctx.emit({ type: 'toast', text: fill(LINES.toast.swarmHive, { n: pa.hives }), cls: 'good', icon: 'hives' }); }
      else { pa.honeyJars += C.jars; ctx.emit({ type: 'toast', text: fill(LINES.toast.swarmJars, { n: C.jars }), cls: 'good', icon: 'hives' }); }
      pa.swarm = null;
      ctx.emit({ type: 'patch/swarm', state: 'caught' });
      ctx.emit({ type: 'sound', name: 'plink', pitch: 1.3 });
      ctx.story('swarm', 12, {});
    },
  },
  { // [A] the swarm's look (a delight): year 1 before the honey lesson, a bee day after a sulk, the bees on the scarecrow's
    // hat. A ✦ to look at (Gran: they'll go home by supper), nothing to catch.
    id: 'swarm_look', cls: 'delight', per: 'day', cooldownDays: CAT.swarm.cooldown, capYear: 1, needs: ['marlene'],
    when: (s) => grows(s) && swarmLook(s) && MS.months.includes(monthOf(s.clock.day)) && afterSulk(s) && !s.mischief?.look,
    rate: () => 1,
    cause: (s) => (afterSulk(s) ? 'sulk' : null),
    fire(s) {
      const p = SWARM_SPOTS.scarecrow;
      s.mischief.look = { id: 'swarm', x: p.x, y: p.y, z: p.z, day: s.clock.day };
      (s.mischief.met.swarm ||= { y: 0, n: 0 }).y = s.clock.year; s.mischief.met.swarm.n++;
      return { at: { x: p.x, y: p.y + 0.5, z: p.z }, label: 'A swarm' };
    },
    look(s, ctx) { s.mischief.look = null; return { dialog: ctx.say('gran', [T_MS.swarm.gran], { pause: true }) }; },
    leftAlone(s, ctx) { s.mischief.look = null; ctx.emit({ type: 'toast', text: T_MS.swarm.home, cls: '', icon: 'hives' }); },
    text: () => T_MS.swarm.look,
  },
  { // shiny (notable): fired from cohort ripening (1 per T.events.cat.shiny.perFruit fruit), spaced by its cooldown and cap, not the director's gap
    id: 'shiny', cls: 'notable', per: 'day', cooldownDays: CAT.shiny.cooldown, capYear: CAT.shiny.capSeason,
    when: () => false, rate: () => 0,
    fire(s, ctx, data) { newShiny(s, ctx, data); },
    text: (s) => LINES.shiny[s.patch.shinies.at(-1)?.kind] || STORY.events.shiny,
  },
  { // volunteer vine (story): Jun 1-20, 35% a year. A vine somewhere silly bears one pumpkin by Oct 1 (30% shiny).
    id: 'volunteer_vine', cls: 'story', per: 'day', capYear: 1,
    when: (s) => grows(s) && s.clock.day >= D(CAT.volunteer_vine.window[0]) && s.clock.day <= D(CAT.volunteer_vine.window[1]) && !s.patch.volunteer,
    rate: () => 1 - Math.pow(1 - CAT.volunteer_vine.chance, 1 / (D(CAT.volunteer_vine.window[1]) - D(CAT.volunteer_vine.window[0]) + 1)),
    fire(s, ctx) {
      const r = ctx.rng('patch');
      s.patch.volunteer = { spot: pick(r, Object.keys(VINE_SPOTS)), day: s.clock.day, shiny: chance(r, CAT.volunteer_vine.shiny), state: 'growing' };
      ctx.emit({ type: 'patch/volunteer', state: 'sprouted', spot: s.patch.volunteer.spot });
      ctx.story('volunteer', 18, { spot: s.patch.volunteer.spot });
    },
    text: (s) => LINES.vine[s.patch.volunteer?.spot] || STORY.events.volunteer_vine,
  },
  { // [A] a look at the volunteer (a delight): once a vine has sprouted somewhere silly, the lane puts a ✦ over it on its
    // own odds, not its gap (`own`). Its arrival line is the vine's own toast, so this one is quiet. Tap: Gran's line.
    id: 'volunteer_look', cls: 'delight', per: 'day', capYear: 1, own: true, quiet: true,
    when: (s) => grows(s) && s.patch.volunteer?.state === 'growing' && !s.patch.volunteer.seen,
    rate: () => 1,
    cause: (s) => (s.patch.volunteer?.state === 'growing' ? 'vine' : null),
    fire(s) {
      const v = s.patch.volunteer, sp = VINE_SPOTS[v.spot];
      v.seen = true;
      return { at: { x: sp.x, y: sp.y + 0.6, z: sp.z }, label: 'A volunteer' };
    },
    look(s, ctx) { return { dialog: ctx.say('gran', [T_MS.volunteer.gran], { pause: true }) }; },
  },
  { // the Parking Lot Patch offer (notable): Sep 15 (Y1: after Gran's barn lesson) if October looks short. A fallback for a
    // struggling field, so it skips the director's spacing (urgent) rather than miss its window.
    id: 'parking_lot_offer', cls: 'notable', per: 'day', capYear: 1, urgent: true,
    when: (s) => grows(s) && s.clock.day >= D(CAT.parking_lot_offer.date) && s.clock.day <= D(CAT.parking_lot_offer.until)
      && (s.clock.year > 1 || s.clock.day >= (s.patch.barnDay ?? Infinity) + 3) && projectSeason(s).largeMet < CAT.parking_lot_offer.below,
    rate: () => 1,
    fire(s, ctx) {
      const C = CAT.parking_lot_offer, n = clamp(Math.floor(barnFree(s) / C.lot), 1, C.maxLots);
      const choices = Array.from({ length: n }, (_, i) => ({ id: `lots${i + 1}`, label: `${i + 1} lot${i ? 's' : ''} · $${C.price * (i + 1)}`, sub: `${C.lot * (i + 1)} Classics in the barn tomorrow` }));
      choices.push({ id: 'no', label: 'No thanks', sub: 'Grow your own', primary: true });
      ctx.card('parking_lot_offer', { speaker: 'raccoons', eyebrow: 'The Parking Lot Patch', title: LINES.raccoons.title, text: `${STORY.raccoons.offer} ${LINES.raccoons.text}`, choices, defaultChoice: 'no' });
    },
  },
];

// ------------------------------------------------------------ hives and honey (§1, §5)
function syncHives(s) { s.patch.hives = Math.min(P.hives.max, P.hives.start + count(s, 'hive') + (s.patch.freeHives || 0)); }
function honeyDay(s, ctx) {
  const pa = s.patch, H = P.hives;
  if (s.weather.f >= H.honeyF) return;
  const cap = pa.hives * H.cap, before = pa.honeyReady;
  pa.honeyReady = round3(Math.min(cap, pa.honeyReady + pa.hives * H.jarPerDay));
  if (!s.unlocks.hives) return;
  if (Math.floor(pa.honeyReady) > Math.floor(before)) ctx.emit({ type: 'patch/honey', ready: Math.floor(pa.honeyReady) });
  if (before < cap && pa.honeyReady >= cap) ctx.alert('honeyFull', { text: LINES.toast.honeyFull, cls: 'good', calm: true });
}

// ------------------------------------------------------------ fads (§7, Y2+)
function makeFad(s, year) {
  if (year < 2) return null;
  const r = makeRng(hash32(s.seed, year, 'fad')), F = T.species.fads;
  const pool = VARIETIES.filter((v) => VT[v].large && VT[v].unlock <= year);
  const weights = pool.map((v) => [v, v === 'classic' ? 1 : VT[v].unlock === year ? 4 : 2]);
  const variety = weighted(r, weights);
  const confidence = Math.round((F.confidence[0] + next(r) * (F.confidence[1] - F.confidence[0])) * 20) / 20;
  const held = next(r) < confidence;
  const viral = !held && next(r) < F.viral ? pick(r, pool.filter((v) => v !== variety)) : null;
  return { year, variety, confidence, held, viral, revealed: false };
}
function revealFad(s, ctx, intro) {
  const f = s.patch.fad;
  if (!f || f.revealed) return;
  f.revealed = true;
  const E = LINES.edna, vars = { VARIETY: vname(f.variety).toUpperCase(), VIRAL: vname(f.viral || '').toUpperCase() };
  const text = fill(f.held ? E.held : f.viral ? E.flipped : E.fizzled, vars);
  ctx.say('edna', [text], intro ? {} : {});
  ctx.story('fad', f.held ? 8 : 22, { variety: f.variety, held: f.held, viral: f.viral });
}

// ------------------------------------------------------------ the forecast bar and projections (pure, for the UI and bots)
// Expected growth on a future day: Hal's 3-day forecast, then climatology (the month's mean fog plus this year's bias) with
// the month's share of heat-wave days. Real weather never leaks: the bar only knows what Hal and the Almanac know.
// The year's mood is what Old Moss hinted in the Almanac (from year 3, right 70% of the time), never the truth.
const mood = (s) => (s.clock.year >= T.weather.archetypeFromYear && T.weather.archetypes[s.weather.hint]) || {};
const climF = (s, t) => clamp(T.weather.mu[monthOf(Math.min(t, LAST_DAY))] + (mood(s).b || 0), 0, 1);
const climate = new WeakMap();   // per-year table of expected growth by day (keyed by that year's weather array)
function climateGrowth(s) {
  let tab = climate.get(s.weather.days);
  if (!tab) {
    const A = mood(s);
    tab = Array.from({ length: LAST_DAY + 1 }, (_, t) => {
      const pHeat = Math.min(0.5, (T.weather.heatStart[monthOf(t)] || 0) * (A.heatMul || 1) * 2.5);
      return (1 - pHeat) * growthOn(climF(s, t), false) + pHeat * G.heat;
    });
    climate.set(s.weather.days, tab);
  }
  return tab;
}
function expectedGrowth(s, t, tab = climateGrowth(s)) {
  if (t > s.clock.day && t <= s.clock.day + 3) { const fc = s.weather.forecast?.find((x) => x.day === t); if (fc) return growthOn(fc.f, fc.heat); }
  return tab[Math.min(t, LAST_DAY)];
}
// The days (from `from`, with progress p0 already done) on which progress first reaches each threshold. Today's own
// growth is still to come, so it counts. Projects past Oct 31 on October's climate (the bar clips it).
// [B] dry: the first `dry` of those days grow at the dry rate (a thirsty patch, if nobody waters it this week).
function crossDays(s, from, p0, ths, dry = 0) {
  const out = ths.map(() => null);
  let p = p0, k = 0;
  const order = ths.map((th, i) => [th, i]).sort((a, b) => a[0] - b[0]), tab = climateGrowth(s);
  for (let t = from; t < LAST_DAY + 120 && k < order.length; t++) {
    p += expectedGrowth(s, t, tab) * (t - from < dry ? G.dryMul : 1);
    while (k < order.length && p >= order[k][0]) { out[order[k][1]] = t; k++; }
  }
  return out;
}
const whiskerFor = (rem) => (rem <= 0 ? 0 : P.ghostWhisker[0] * clamp(rem / P.ghostSettle, 0, 1) + P.ghostWhisker[1] * rem);

// Timeline of a row's fruit: [{ v, n, ripe, soft, rot }] with day numbers (prime from `ripe`, soft from `soft`, gone at `rot`).
function cohortTimeline(v, n, crossings, offs, mildew = false) {
  const L = VT[v].prime / (mildew ? P.aging.mildewLife : 1), S = VT[v].soft;
  return offs.map((off, i) => {
    const ripe = crossings[i] == null ? 999 : crossings[i] + 1;
    return { v, n: n[i], ripe, soft: ripe + Math.round(L), rot: ripe + Math.round(L) + S };
  });
}
function expectedSet(s, v) {
  return Math.round(yieldOf(v) * (1 + P.bees.perHive * s.patch.hives * 0.6) * compost(s));
}
function splitShares(n) { return P.cohorts.shares.map((k) => k * n); }

/** Projection for one planted (or scheduled) row: { cohorts, mid, whisker, late, ripeFrom, primeTo } in sim days. */
export function projectRow(s, r) {
  const row = rowsOf(s)[r], d = s.clock.day;
  if (!row?.open) return null;
  const offs = P.cohorts.offsets;
  if (!planted(row)) {
    if (row.plan) return ghost(s, row.plan.variety, row.plan.day);
    if (!row.fruit.length) return null;
  }
  const v = row.variety, spec = VT[v];
  const cohorts = [];
  for (const c of row.fruit) {
    const L = VT[c.v].prime / (row.mildew > 0 ? P.aging.mildewLife : 1), S = VT[c.v].soft;
    if (c.st === 'prime') { const soft = d + Math.max(1, Math.round(L - c.age)); cohorts.push({ v: c.v, n: c.n, ripe: c.rd ?? d, soft, rot: soft + S, tr: c.tr }); }
    else if (c.st === 'soft') { cohorts.push({ v: c.v, n: c.n, ripe: -1, soft: d - Math.round(c.sa), rot: d + Math.max(1, Math.round(S - c.sa)) }); }
  }
  const pending = row.fruit.filter((c) => c.st === 'green' && c.off != null);
  let mid = row.midDay ?? null;
  if (planted(row) && row.stage !== 'done') {
    // [B] an honest projection: bugs or a dry spell before fruit set show on the crates (the set will follow the health)
    const nset = row.set ? null : splitShares(expectedSet(s, v) * (1 - SH.healthScale + SH.healthScale * row.health));
    const greens = row.set ? pending : offs.map((off, i) => ({ off, n: nset[i] }));
    // [B] a thirsty patch this morning: the projection says "if it stays dry this week" (the crates dip; watering refills them)
    const dryNow = grows(s) && !frozen(s) && s.patch.wet && s.patch.moisture < G.dryBelow ? SH.dryAhead : 0;
    const days = crossDays(s, d, row.progress, greens.map((c) => spec.dtm + c.off), dryNow);
    cohorts.push(...cohortTimeline(v, greens.map((c) => c.n), days, greens.map((c) => c.off), row.mildew > 0));
    const i0 = greens.findIndex((c) => c.off === 0);
    if (i0 >= 0 && days[i0] != null) mid = days[i0] + 1;
  }
  const rem = planted(row) ? Math.max(0, spec.dtm - row.progress) : 0;
  return finishProjection(cohorts, mid, whiskerFor(rem), v, planted(row) && row.ripeDay == null);
}
function finishProjection(cohorts, mid, whisker, v, canBeLate = true) {
  const live = cohorts.filter((c) => c.n > 0);
  const ripeFrom = Math.min(...live.map((c) => c.ripe).filter((x) => x >= 0), 999);
  const primeTo = Math.max(...live.map((c) => c.soft), -1);
  return { v, cohorts: live, mid, whisker, ripeFrom, primeTo, late: canBeLate && (mid == null || mid > EVE) };
}
/** The ghost bar: variety v planted on day `day` (default today), from climatology. Whiskers +/-(3 + 0.06 x DTM). */
export function ghost(s, v, day = s.clock.day) {
  const spec = VT[v], offs = P.cohorts.offsets;
  const n = splitShares(expectedSet(s, v));
  const days = crossDays(s, day, 0, offs.map((o) => spec.dtm + o));
  const cohorts = cohortTimeline(v, n, days, offs);
  const mid = days[offs.indexOf(0)] == null ? null : days[offs.indexOf(0)] + 1;
  return { ...finishProjection(cohorts, mid, P.ghostWhisker[0] + P.ghostWhisker[1] * spec.dtm, v), day };
}
/** Fruit of a projected timeline in each state on day t. @returns {{ g, p, s }} */
export function stateOn(proj, t) {
  const o = { g: 0, p: 0, s: 0 };
  for (const c of proj?.cohorts || []) {
    if (t < c.ripe) o.g += c.n; else if (t < c.soft) o.p += c.n; else if (t < c.rot) o.s += c.n;
  }
  return o;
}

/**
 * Expected wants on day d (design §7 N_day x wants), the patch's own projection for the forecast bar and the Sep 15
 * offer. season.js owns the real crowd; it may export a better projectDemand and this one should then defer to it.
 * @returns {{ families, large, mini }}
 */
export function projectDemand(s, d) {
  const S = T.season, W = T.species.wants;
  const y = Math.min(s.clock.year, S.capYear), base = S.base * (1 + S.growth * (y - 1));
  const rep = S.rep[0] + S.rep[1] * (s.rep?.R ?? S.R.start);
  const fc = s.weather.forecast?.find((x) => x.day === d);
  const f = fc ? fc.f : climF(s, d);
  const wx = (S.wx.base - S.wx.fog * f) * (fc?.heat ? S.wx.heat : 1);
  const wk = weekendMult(d), buzz = 1 + (s.rep?.buzz || 0);
  const fam = (wk > 0 ? base * rep * wk : S.weekday * base * rep) * wx * (wk > 0 ? buzz : 1);
  const kid = 2 * W.kidMini * (s.clock.year >= W.weirdFromYear ? 1 - W.weird : 1);
  return { families: fam, large: fam * W.adultLarge * (1 + W.two), mini: fam * kid };
}

/**
 * Walk October with the projected supply (every row's timeline plus the barn) against projected demand, oldest
 * fruit first, and report how many wants each weekend would meet. `swap` replaces one row's projection (the ghost).
 * @returns {{ weekends: [{ i, met, large, mini }], largeMet, miniMet }}
 */
export function projectSeason(s, swap) {
  const W = walkOctober(s, swap);
  return {
    weekends: W.wk.map((w) => ({ i: w.i, past: w.past, met: w.needL + w.needM ? (w.gotL + w.gotM) / (w.needL + w.needM) : 0,
      large: w.needL ? w.gotL / w.needL : 0, mini: w.needM ? w.gotM / w.needM : 0 })),
    largeMet: W.needL ? W.gotL / W.needL : 0, miniMet: W.needM ? W.gotM / W.needM : 0,
  };
}
// The October walk shared by projectSeason (the forecast bar's weekends, the Sep 15 offer) and the crates (shelf): every
// row's projected fruit and the barn's against the projected wants (x kL big, x kM small), oldest fruit first. Per weekend:
// the wants and what was found for them, in fruit, and which rows found it (by: { [row]: n }, the barn is row -1); val: what
// the whole of October's found fruit sells for (the chips player's yardstick).
function walkOctober(s, swap, K = null) {
  const kw = (wi) => (K && wi >= 0 ? K.w[wi] : 1), kL = K?.large ?? 1, kM = K?.mini ?? 1;
  const d0 = Math.max(s.clock.day, OCT1), today = s.clock.day, [wa, wb] = SH.spread;
  const base = [];
  rowsOf(s).forEach((row, r) => {
    const pr = swap && swap.row === r ? swap.proj : projectRow(s, r), k = Math.round((pr?.whisker || 0) * wa);
    for (const c of pr?.cohorts || []) base.push({ v: c.v, n: c.n, ripe: c.ripe, soft: c.soft, large: VT[c.v].large, p: VT[c.v].price, r, k: c.ripe > today ? k : 0 });
  });
  for (const l of s.patch.barnLots) if (l.st === 'prime') {
    const left = Math.max(0, (VT[l.v].prime - l.age) / P.aging.barn);
    base.push({ v: l.v, n: l.n, ripe: -1, soft: s.clock.day + Math.round(left), large: VT[l.v].large, p: VT[l.v].price, r: -1, k: 0 });
  }
  const wk = weekends().map((w) => ({ i: w.i, past: w.sun < d0, needL: 0, needM: 0, gotL: 0, gotM: 0, by: {} }));
  const dem = [], mix = wantMix(s);
  for (let t = d0; t <= EVE; t++) dem.push(projectDemand(s, t));
  let needL = 0, gotL = 0, needM = 0, gotM = 0, val = 0;
  // fruit still to ripen has its give-or-take: one summer in four runs early (every unripe row a x its whisker early, all
  // together: it's the weather), one in four late. The crates are the three summers' weighted average: an honest projection
  // that doesn't flip on a one-day shift at a weekend's edge, and that knows a plan with no slack spoils when summer's warm.
  const summers = base.some((c) => c.k >= 1) ? [[-1, wb], [0, 1 - 2 * wb], [1, wb]] : [[0, 1]];
  // (flat arrays, no copies: this runs every morning of the summer and on every frame of a drag)
  const N = base.length, left = new Float64Array(N), lists = new Map(), big = [], small = [];
  const subs = mix.large.length > 1;
  for (const [sg, f] of summers) {
    const ord = Array.from({ length: N }, (_, i) => i).sort((a, b) => (base[a].soft + sg * base[a].k) - (base[b].soft + sg * base[b].k));
    lists.clear(); big.length = 0; small.length = 0;
    for (const i of ord) {
      const c = base[i];
      left[i] = c.n;
      let l = lists.get(c.v);
      if (!l) lists.set(c.v, (l = []));
      l.push(i); (c.large ? big : small).push(i);
    }
    // oldest fruit first, from one list of pools
    const serve = (t, want, idx, w) => {
      let rest = want;
      for (let j = 0; j < idx.length && rest > 0; j++) {
        const i = idx[j], c = base[i], sh = sg * c.k;
        if (left[i] <= 0 || t < c.ripe + sh || t >= c.soft + sh) continue;
        const k = Math.min(left[i], rest); left[i] -= k; rest -= k; val += f * k * c.p;
        if (w) w.by[c.r] = (w.by[c.r] || 0) + f * k;
      }
      return want - rest;
    };
    for (let t = d0; t <= EVE; t++) {
      const wi = weekendIndex(t), w = wi >= 0 ? wk[wi] : null, dm = dem[t - d0], kk = kw(wi);
      // big: each variety's own wants (year 1: all Classics), then half of what's left takes another big one (season.js)
      let want = 0, got = 0, short = 0;
      for (const [v, sh] of mix.large) {
        const n = (dm.large * kL * sh + dm.mini * kM * (mix.weird[v] || 0)) * kk, g = lists.has(v) ? serve(t, n, lists.get(v), w) : 0;
        want += n; got += g; short += n - g;
      }
      if (short > 0 && subs) got += serve(t, short * T.season.substitute, big, w);
      const wm = dm.mini * kM * kk, gm = serve(t, wm, small, w);
      needL += f * want; gotL += f * got; needM += f * wm; gotM += f * gm;
      if (w) { w.needL += f * want; w.gotL += f * got; w.needM += f * wm; w.gotM += f * gm; }
    }
  }
  return { wk, needL, gotL, needM, gotM, val };
}
// [B] Who wants which big pumpkin (season.js newFamily, in expectation): year 1 all Classics; from year 2 each species' taste
// (a photo family weights the photogenic ones) times the fad's expected pull (its confidence, never whether it holds), and a
// kid's "weird one" (per mini want) shared among the unlocked Warty and White. { large: [[v, share]], weird: { v: perMini } }
function wantMix(s) {
  const y = s.clock.year, SPx = T.species, Wt = SPx.wants, F = SPx.fads, f = s.patch?.fad;
  if (y < Wt.weirdFromYear) return { large: [['classic', 1]], weird: {} };
  const large = Object.keys(VT).filter((v) => VT[v].large && VT[v].unlock <= y);
  const fadE = (v) => (f && v === f.variety ? f.confidence * F.hold + (1 - f.confidence) * F.fizzle : 1);
  const share = Object.fromEntries(large.map((v) => [v, 0])), TY = SPx.types.photo;
  for (const sp of SPx.list) {
    const pr = SPx[sp].prefs, photo = sp === 'fox' ? TY.fox : TY.share;
    for (const [pp, tw] of [[1 - photo, {}], [photo, TY.weights]]) {
      const ws = large.map((v) => (pr[v] ?? 1) * (tw[v] ?? 1) * fadE(v)), sum = ws.reduce((a, b) => a + b, 0);
      large.forEach((v, i) => { share[v] += pp * ws[i] / sum / SPx.list.length; });
    }
  }
  const odd = ['warty', 'white'].filter((v) => VT[v].unlock <= y), weird = {};
  for (const v of odd) weird[v] = Wt.weird / (1 - Wt.weird) / odd.length;   // per mini want (projectDemand's mini has the weird ones out)
  return { large: large.map((v) => [v, share[v]]), weird };
}

/** Everything the Row sheet's ripeness forecast bar draws (Sep 1 - Oct 31), with the ghost for (variety, day). */
export function forecastBar(s, { row: sel = null, variety = null, day = s.clock.day } = {}) {
  const from = SEP1, to = LAST_DAY, today = s.clock.day;
  const rows = rowsOf(s).map((row, r) => {
    if (!row.open) return { row: r, closed: true };
    const proj = projectRow(s, r);
    return { row: r, v: displayVariety(row), planned: !planted(row) && !!row.plan, proj, hist: s.patch.hist[r] || [] };
  });
  const g = variety ? ghost(s, variety, Math.max(day, today)) : null;
  const cover = projectSeason(s, g && sel != null ? { row: sel, proj: g } : null);
  return { from, to, today, weekends: weekends(), weighoff: dayOf(T.calendar.weighoff), rows, ghost: g, cover };
}

// ------------------------------------------------------------ the ledger's row report cards (§9)
function newReport(y) {
  return { y, rows: Array.from({ length: P.rows }, () => null), unmet: {}, barn: { cut: 0, out: 0, soft: 0, rotten: 0 }, trucked: { lots: 0, n: 0 },
    oct: freshOct(), wkd: freshOct()[0] };
}
// [B] what October really sold, weekend by weekend: [{ big, small, missBig, missSmall, soft }] (the crates after their
// weekend, last October's line in years 2+, the crates' honesty tests). A sale or a want nobody met counts on its own day (a
// weekday's in wkd); fruit going soft counts against the weekend it was waiting for.
const freshOct = () => weekends().map(() => ({ big: 0, small: 0, missBig: 0, missSmall: 0, soft: 0 }));
function octOf(s, d, fn, sale = false) {
  const rep = s.patch.report;
  if (!rep) return;
  rep.oct ??= freshOct();
  const i = sale ? weekendIndex(d) : weekends().findIndex((w) => d <= w.sun);
  if (i >= 0) fn(rep.oct[i]);
  else if (sale) fn(rep.wkd ??= freshOct()[0]);
}
// [B] which weekend a row's fruit sold on, wherever it sold from (barn fruit and restocked fruit remember their row, o):
// report.rows[r].wk = [W1, W2, W3, W4, a weekday] (the honesty test: a row's label is the weekends it really sells on)
function soldFrom(s, r, n) {
  const row = rowsOf(s)[r];
  if (s.clock.phase !== 'october' || !row || !(n > 0)) return;
  const R = repOf(s, row), wi = weekendIndex(s.clock.day);
  if (R) (R.wk ??= [0, 0, 0, 0, 0])[wi >= 0 ? wi : 4] += n;
}
function octSale(s, v, n) {
  if (s.clock.phase === 'october' && n > 0) octOf(s, s.clock.day, (o) => { o[VT[v]?.large === false ? 'small' : 'big'] += n; }, true);
}
function repOf(s, row) {
  const r = rowsOf(s).indexOf(row);
  if (r < 0) return null;
  const rep = s.patch.report;
  return (rep.rows[r] ||= { variety: row.variety, plantedDay: row.plantedDay, ripeDay: null, set: 0, beeFrac: 0, sold: 0, soldSoft: 0, soft: 0,
    softDaySum: 0, rotten: 0, green: 0, cut: 0, restocked: 0, truckedSold: 0, clusters: 0, mildew: 0, soldOutDay: null,
    lost: { bugs: 0, dry: 0, mildew: 0 } });
}
const whenLabel = (d) => {
  if (d < OCT1) return 'before October';
  const w = weekends().find((x) => d <= x.sun);
  return w ? (d >= w.sat ? `W${w.i + 1} ${d === w.sat ? 'Saturday' : 'Sunday'}` : `before W${w.i + 1}`) : 'after W4';
};
/** Row report cards for the winter ledger: [{ row, variety, text, ...numbers }]. Pure; reads s.patch.report. */
export function reportCards(s) {
  const rep = s.patch.report, L = LINES.report, told = new Set();   // "Folks wanted N more" once per variety
  return rep.rows.map((R, r) => {
    if (!R || !R.variety || R.plantedDay == null) return { row: r, text: fill(L.rested, { row: r + 1 }) };
    const V = vname(R.variety);
    let text = fill(L.head, { row: r + 1, Variety: V, planted: label(R.plantedDay) });
    if (R.ripeDay != null) text += fill(L.ripe, { ripe: label(Math.min(R.ripeDay, LAST_DAY)) });
    const sold = R.sold + R.soldSoft;
    if (R.set && (R.cut || R.restocked)) {
      text += fill(L.grew, { set: R.set, sold }) + (R.restocked ? L.restockedIn : L.cutTo);
    } else if (R.set) text += fill(L.sold, { sold, set: R.set });
    text += '. ';
    const wasted = R.soft - R.soldSoft, notes = [];
    if (R.set && wasted >= Math.max(8, 0.2 * R.set)) {
      // the fruit was prime around (soft day - L/2); move that onto the weekend it went soft before
      const md = Math.round(R.softDaySum / Math.max(1, R.soft)), centre = md - VT[R.variety].prime / 2;
      const target = weekends().find((w) => w.sun >= md)?.sat ?? EVE;
      const days = clamp(Math.round((target + 1 - centre) / 5) * 5, 5, 30);
      notes.push(fill(L.soft, { soft: wasted, when: whenLabel(md), days }));
    }
    if (R.green >= Math.max(8, 0.2 * R.set)) notes.push(fill(L.green, { green: R.green, by: label(D('Jul 1')) }));
    const unmet = rep.unmet[R.variety] || 0;
    if (R.soldOutDay != null && unmet >= 5 && !told.has(R.variety)) { told.add(R.variety); notes.push(fill(L.soldOut, { when: whenLabel(R.soldOutDay), unmet })); }
    const lost = Object.entries(R.lost).sort((a, b) => b[1] - a[1])[0];
    if (lost && lost[1] >= 6 && L[lost[0]]) notes.push(fill(L[lost[0]], { lost: Math.round(lost[1]) }));
    if (!notes.length) notes.push(L.good);
    return { row: r, ...R, wasted, unmet, text: text + notes.slice(0, 2).join(' ') };
  });
}

// ------------------------------------------------------------ planting (§4)
function plantNow(s, ctx, r, v) {
  const row = rowsOf(s)[r], spec = VT[v];
  if (!spend(s, ctx, spec.seed, 'seed')) return false;
  const keep = { rot: row.rot };
  // [B] "won't make it" (the red stake) only when it really won't: after the window a Mini can still be ripe for W3-4, and
  // the Table (or Gran's empty-row bubble) just said so
  const late = s.clock.day > D(P.window[1]) && ghost(s, v, s.clock.day).late;
  Object.assign(row, freshRow(true), keep, { variety: v, plantedDay: s.clock.day, stage: 'seeded', late });
  if (!s.patch.wet) { s.patch.wet = true; s.patch.moisture = P.moisture.start; }
  s.patch.report.rows[r] = null;
  repOf(s, row);
  s.patch.firstPlant ??= s.clock.day;
  refresh(s, row);
  ctx.emit({ type: 'patch/planted', row: r, variety: v, scheduled: false });
  ctx.emit({ type: 'sound', name: 'plink' });
  return true;
}
const unlocked = (s, v) => !!VT[v] && VT[v].unlock <= s.clock.year;
export const unlockedVarieties = (s) => VARIETIES.filter((v) => unlocked(s, v));

// Gran's plan (Y1 "Plan it like Gran", "Gran's usual" from Y2): Classic waves Jun 12 / Jul 3 / Jul 10 + Mini Jul 10,
// ignoring fads. Fills open rows that have nothing planted or planned; a date already past becomes today.
export function gransPlan(s) {
  const out = [];
  const entries = [...P.gransPlan.map((e, i) => [...e, P.gransRows[i]]), ...P.gransExtra.map((e, i) => [...e, P.openY1 + i])];
  for (const [v, date, r] of entries) {
    const row = rowsOf(s)[r];
    if (!row?.open || planted(row) || row.plan) continue;
    out.push({ row: r, variety: v, day: Math.max(s.clock.day, D(date)) });
  }
  return out;
}

// ------------------------------------------------------------ actions
const rowArg = (s, a) => { const row = rowsOf(s)[a.row]; return row && row.open ? row : null; };
const ACTIONS = {
  // Plant (or schedule) a row: { row, variety, day?, early?, replant? }. Before Jun 1 Gran asks first (reason 'early'
  // with her line in `confirm`); after Jul 10 the row is flagged "won't make it".
  'patch/plant': (s, a, ctx) => {
    if (!s.unlocks.patch) return fail(`Gran plans October on ${label(D(SY.plant))}`);
    if (!grows(s)) return fail('planting is over for the year');
    const row = rowArg(s, a);
    if (!row) return fail('that row is still bramble');
    if (!unlocked(s, a.variety)) return fail(VT[a.variety] ? `${vname(a.variety)} seed arrives in year ${VT[a.variety].unlock}` : 'unknown variety');
    const day = a.day == null ? s.clock.day : Math.round(a.day);
    if (day < s.clock.day || day >= OCT1) return fail('pick a day between today and September');
    if (day < JUN1 && !a.early) return fail('early', { confirm: STORY.gran.plantEarly, quiet: true });
    if (planted(row) && !a.replant) return fail('replant', { confirm: LINES.gran.replant, quiet: true });
    if (day > s.clock.day) {
      if (planted(row)) return fail('replant today, or not at all');
      row.plan = { variety: a.variety, day };
      ctx.emit({ type: 'patch/planted', row: a.row, variety: a.variety, scheduled: true, day });
      if (!a.gran) planned(s, ctx, true);
      return { ok: true, scheduled: true };
    }
    if (!canAfford(s, VT[a.variety].seed)) return fail('not enough cash for seed');
    plantNow(s, ctx, a.row, a.variety);
    sowing(s, ctx, a.row, true);                         // "Plant now": the sowing beat answers the tap at once
    if (!a.gran) planned(s, ctx, true);
    return { ok: true };
  },
  'patch/unplan': (s, a) => { const row = rowArg(s, a); if (!row?.plan) return fail('nothing planned there'); row.plan = null; return { ok: true }; },
  // Gran's waves for every row without a plan (the bots' year-1 plan; "Gran's usual" on the Table from year 2)
  'patch/gran': (s, a, ctx) => {
    if (!s.unlocks.patch || !grows(s)) return fail('not now');
    const plan = gransPlan(s);
    if (!plan.length) return fail('every row already has a plan');
    for (const p of plan) ACTIONS['patch/plant'](s, { ...p, early: true, gran: true }, ctx);
    ctx.say('gran', [LINES.gran.planned]);
    planned(s, ctx, true);
    return { ok: true, n: plan.length };
  },
  // Water All (the FAB): M += 0.5 for $2 x planted rows.
  'patch/water': (s, a, ctx) => {
    if (!grows(s) || frozen(s)) return fail('nothing to water');
    if (!plantedRows(s)) return fail('nothing planted to water yet');
    if (!canAfford(s, waterBill(s))) return fail('not enough cash for the water bill');
    water(s, ctx);
    ctx.emit({ type: 'sound', name: 'plink', pitch: 0.9 });
    ctx.goalDone('patchWater');
    return { ok: true, M: s.patch.moisture };
  },
  // One squish tap: -0.35 infestation. The UI chains taps within 1.5 s into a combo (cosmetic).
  'patch/squish': (s, a, ctx) => {
    const row = rowArg(s, a);
    if (!row?.bugs) return fail('no bugs there');
    row.bugs = round3(Math.max(0, row.bugs - P.bugs.squish));
    if (row.bugs < 0.02) row.bugs = 0;
    ctx.emit({ type: 'patch/squish', row: a.row, left: row.bugs });
    if (!row.bugs) {
      ctx.emit({ type: 'patch/bugsCleared', row: a.row });
      if (s.story.goal?.target?.id === a.row) ctx.goalDone('bugs');
    }
    return { ok: true, left: row.bugs };
  },
  // [E] A bug hunt's result (plan §3.14): the close-up squished `hits` of the bugsShown(b) bugs (clamped to them). The rest
  // stay (bugsAfter: exactly that many show); all of them clears the row and its goal, and a row cleared by hand stays
  // clear for T.hands.grace days (the word gets round: finishing the job pays, and nobody hunts the same row every
  // morning). Gran's last word is a fresh line, picked with a keyed hash so a hunt never moves a stream.
  'patch/hunt': (s, a, ctx) => {
    const row = rowArg(s, a);
    if (!row?.bugs) return fail('no bugs there');
    const n = bugsShown(row.bugs), hits = clamp(Math.round(+a.hits) || 0, 0, n);
    row.bugs = bugsAfter(row.bugs, hits);
    const cleared = !row.bugs, kind = cleared ? 'clear' : 'ground';
    if (cleared) row.sprayUntil = Math.max(row.sprayUntil, s.clock.day + T.hands.grace);   // (the row's bug-free days)
    const line = ctx.fresh(`hunt.${kind}`, HUNT[kind], makeRng(hash32(s.seed, s.clock.year, s.clock.day, a.row, 'hunt', n)));
    ctx.emit({ type: 'patch/hunt', row: a.row, n, hits, left: bugsShown(row.bugs) });
    if (cleared) {
      ctx.emit({ type: 'patch/bugsCleared', row: a.row, by: 'hunt' });
      if (s.story.goal?.target?.id === a.row) ctx.goalDone('bugs');
    }
    return { ok: true, n, hits, left: bugsShown(row.bugs), cleared, line };
  },
  // Bug spray: $15/row, clears now, blocks new clusters for 14 days, voids the row's bee bonus for the season.
  'patch/spray': (s, a, ctx) => {
    const row = rowArg(s, a);
    if (!row || !planted(row)) return fail('nothing growing there');
    if (!spend(s, ctx, P.bugs.spray, 'sprays')) return fail('not enough cash for spray');
    row.bugs = 0; row.sprayUntil = s.clock.day + P.bugs.block; if (!row.set) row.sprayed = true;
    ctx.emit({ type: 'patch/sprayed', row: a.row, kind: 'bugs' });
    ctx.emit({ type: 'patch/bugsCleared', row: a.row });
    if (s.story.goal?.target?.id === a.row) ctx.goalDone('bugs');
    return { ok: true };
  },
  // Milk spray (Y2+): $10/row, leaves 20% of the mildew (gone under 0.1), protects for 10 days. Bees don't mind.
  'patch/milk': (s, a, ctx) => {
    const row = rowArg(s, a);
    if (!row || !planted(row)) return fail('nothing growing there');
    if (s.clock.year < P.mildew.fromYear) return fail('no mildew in year 1');
    if (!spend(s, ctx, P.mildew.spray, 'sprays')) return fail('not enough cash for milk');
    row.mildew = round3(row.mildew * (1 - P.mildew.cure));
    if (row.mildew < P.mildew.gone) row.mildew = 0;
    row.milkUntil = s.clock.day + P.mildew.protect;
    ctx.emit({ type: 'patch/sprayed', row: a.row, kind: 'milk' });
    if (!row.mildew && s.story.goal?.target?.id === a.row) ctx.goalDone('milk');
    return { ok: true, left: row.mildew };
  },
  // Cut ripe -> barn (from Sep 1), all of it or the oldest { n }. On weekend days season.js sends the farmer and calls
  // cutToBarn on arrival.
  'patch/cut': (s, a, ctx) => {
    if (!live(s) || s.clock.day < D(P.barn.cutFrom)) return fail('nothing is ripe until September');
    const row = rowArg(s, a);
    if (!row?.stock.prime) return fail('nothing ripe in that row');
    if (!barnFree(s)) return fail(`the barn is full (${barnCap(s)})`);
    const n = cutToBarn(s, a.row, a.n > 0 ? Math.round(a.n) : Infinity);
    ctx.emit({ type: 'patch/cut', row: a.row, n });
    ctx.emit({ type: 'toast', text: fill(LINES.toast.cut, { n }), cls: 'good', icon: 'barn' });
    // the barn lesson completes on its own row; a cut elsewhere just re-aims it at what is still going soft
    const g = s.story.goal;
    if (g?.id === 'barn' && g.target?.id !== a.row && setBarnGoal(s, ctx, true)) return { ok: true, n };
    if (ctx.goalDone('barn') || g?.id !== 'barn') s.patch.barnGoal = 'done';
    return { ok: true, n };
  },
  // Restock a row from the barn (12, or { n }); without a row, the emptiest front row.
  'patch/restock': (s, a, ctx) => {
    if (!live(s) || s.clock.day < D(P.barn.cutFrom)) return fail('nothing to restock yet');
    if (!barnStock(s)) return fail('the barn is empty');
    const r = a.row ?? emptiestRow(s);
    if (r == null || !rowsOf(s)[r]?.open) return fail('no row to restock');
    const n = restockRow(s, r, a.n ?? P.barn.restockN, { variety: a.variety });
    if (!n) return fail('that row is full');
    ctx.emit({ type: 'patch/restock', row: r, n });
    ctx.emit({ type: 'toast', text: fill(LINES.toast.restock, { n, row: r + 1 }), cls: 'good', icon: 'pumpkin' });
    return { ok: true, n, row: r };
  },
  'patch/honey': (s, a, ctx) => {
    const jars = Math.floor(s.patch.honeyReady);
    if (jars < 1) return fail('no honey ready yet');
    s.patch.honeyReady = round3(s.patch.honeyReady - jars);
    s.patch.honeyJars += jars; s.patch.honeyTotal += jars;
    bState(s).honeyLast = s.clock.day;
    ctx.emit({ type: 'patch/honeyCollected', jars });
    ctx.emit({ type: 'toast', text: fill(LINES.toast.honey, { n: jars }), cls: 'good', icon: 'hives' });
    ctx.goalDone('honey');
    return { ok: true, jars };
  },
  'patch/shinyTap': (s, a, ctx) => {
    const sh = s.patch.shinies.find((x) => x.id === a.id && x.state === 'field');
    if (!sh) return fail('it has gone');
    shinyEnd(s, sh.id, 'found');
    shinyCard(s, ctx, sh);
    return { ok: true };
  },
  'patch/volunteer': (s, a, ctx) => {
    const vv = s.patch.volunteer;
    if (!vv || vv.state !== 'ripe') return fail('not ripe yet');
    vv.state = 'harvested';
    ctx.emit({ type: 'patch/volunteer', state: 'harvested', spot: vv.spot });
    ctx.story('volunteerHarvest', 20, { spot: vv.spot, shiny: vv.shiny });
    if (vv.shiny) { const sh = newShiny(s, ctx, { row: null, v: 'classic', state: 'found' }); shinyCard(s, ctx, sh); return { ok: true, shiny: true }; }
    s.patch.barnLots.push({ v: 'classic', n: 1, age: 0, st: 'prime', sa: 0, tr: false });
    barnSummary(s);
    ctx.emit({ type: 'toast', text: fill(LINES.toast.volunteer, { spot: LINES.spots[vv.spot] || vv.spot }), cls: 'good', icon: 'pumpkin' });
    return { ok: true };
  },
  // A bramble row bought in the shop opens at once (the UI dispatches this on 'bought'; newYear also syncs).
  'patch/clear': (s, a, ctx) => {
    const row = rowsOf(s)[a.row];
    if (!row || row.open || !ownsRow(s, a.row)) return fail('nothing to clear');
    Object.assign(row, freshRow(true));
    ctx.emit({ type: 'patch/cleared', row: a.row });
    ctx.emit({ type: 'toast', text: fill(LINES.toast.cleared, { row: a.row + 1 }), cls: 'good', icon: 'patch' });
    return { ok: true };
  },
  // The barn menu from Y4: order trucked-in lots from the Parking Lot Patch (delivered next morning).
  'patch/order': (s, a, ctx) => {
    if (s.clock.year < P.trucked.menuFromYear) return fail(`the Parking Lot Patch opens in year ${P.trucked.menuFromYear}`);
    if (!live(s) || s.clock.day < D(P.barn.cutFrom)) return fail('they only deliver in the fall');
    const lots = clamp(Math.round(a.lots || 1), 1, CAT.parking_lot_offer.maxLots);
    return orderTrucked(s, ctx, lots) ? { ok: true, lots } : fail('not enough cash');
  },
};
function orderTrucked(s, ctx, lots) {
  const C = CAT.parking_lot_offer;
  if (!spend(s, ctx, C.price * lots, 'trucked')) return false;
  s.patch.trucked.push({ day: s.clock.day + P.trucked.deliverDays, n: C.lot * lots });
  s.patch.report.trucked.lots += lots;
  ctx.story('trucked', 6, { lots });
  return true;
}
function emptiestRow(s) {
  let best = null, bf = Infinity;
  rowsOf(s).forEach((row, r) => { if (!row.open) return; const f = fullness(s, r) + r * 0.001; if (f < bf) { bf = f; best = r; } });
  return best;
}

// ------------------------------------------------------------ onboarding beats (§3)
const SY = T.story.y1;
// [B] the watering lesson follows the first sowing: any dry morning from afterSow days after it, Hal's "dry week" at forceAfterSow,
// and never before the first sowing's own beat has been seen (12 s after it: the first row going in is its own moment)
const waterFrom = (s) => (s.patch.firstPlant ?? 0) + SY.patchWater.afterSow;
const waterForced = (s) => (s.patch.firstPlant ?? 0) + SY.patchWater.forceAfterSow;
const sowSeen = (s) => s.patch.b?.sowAt ?? null;
const waterFrom1x = (s) => Math.max(realSeconds(0, waterFrom(s)), sowSeen(s) + T.story.chatterGap1x);
// earlier lessons (patch, Marlene, giant) the barn goal may replace; never an urgent one like a creak
const STALE_GOALS = new Set(['plant', 'plan', 'plan2', 'patchWater', 'bugs', 'honey', 'marlene', 'water', 'kelp', 'measure', 'shade', 'rituals']);
const rowCentre = (r) => ({ x: (ROWS.x0 + ROWS.x1) / 2, z: rowZ(r) });
/**
 * The barn habit that pays (design §4, §13 "Prudence"): cut what would go soft before it can sell, big fruit first. A
 * barn spot holds an $8 Classic or a $2 Mini, and Minis keep 16 days in the field, so while a big row is still to ripen
 * a Mini row may only take half the room left. @returns {{ n: number, sale: number } | null} for row r: how many to cut
 * and the selling day they would miss (null: nothing in row r goes soft before it sells)
 */
export function cutAdvice(s, r) {
  const c = softCuts(s).find((x) => x.row === r);
  if (!c) return null;
  const row = rowsOf(s)[r], v = displayVariety(row), bigLater = rowsOf(s).some((x) => planted(x) && VT[x.variety]?.large && x.stock.green > 0 && x !== row);
  const n = VT[v]?.large || !bigLater ? c.n : Math.min(c.n, Math.floor(barnFree(s) / 2));
  return n > 0 ? { n, sale: nextSaleDay(s.clock.day) } : null;
}
// The barn lesson's target: the row whose softening fruit is worth the most per barn spot (then the most of it).
function barnPick(s) {
  let best = null;
  rowsOf(s).forEach((row, r) => {
    const a = row.open && cutAdvice(s, r);
    if (!a) return;
    const v = displayVariety(row), k = VT[v].price;
    if (!best || k > best.k || (k === best.k && a.n > best.n)) best = { r, v, n: a.n, k };
  });
  return best;
}
function setBarnGoal(s, ctx, quiet = false) {
  const b = barnPick(s);
  if (!b) return false;
  const text = fill(STORY.goals.barn, { n: b.n, Variety: vname(b.v) + (b.n === 1 ? '' : 's'), row: b.r + 1 });
  if (quiet && s.story.goal?.text === text) return true;
  // worth doing until the end of September, or in October until the eve of the weekend it would miss
  const until = grows(s) ? D(P.barn.lessonUntil) : nextSaleDay(s.clock.day) - 1;
  ctx.goal('barn', text, { kind: 'row', id: b.r, ...rowCentre(b.r), zoom: T.ui.zoom.patch }, { quiet, until });
  s.patch.barnGoal = 'set';
  return true;
}
const BEATS = [
  { // #5 [B] Plan October (May 20, Gran): the Planting Table, before the sowing window opens (Jun 1). Pinned: the Next-stop
    // chip has promised "May 20 · Plan October" since April, so the other lessons make way for it.
    id: 'patch.plant', year: 1, order: 5, at: SY.plant, pin: true,
    when: (s) => grows(s) && s.clock.day >= D(SY.plant),
    run(s, ctx) {
      ctx.unlock('patch');
      ctx.say('gran', LINES.plan, { goal: { id: 'plan', text: LINES.goalPlan, target: { kind: 'station', id: 'patch' }, until: D(P.window[1]), lapse: false },
        glide: { x: -1.5, z: 3, zoom: T.ui.zoom.patch } });
    },
  },
  { // #6 [B] watering (Hal): the first dry morning from 5 days after the first sowing, forced at 8 (Hal's "dry week"), so it
    // lands while the first row is young. It may come any morning from then, so moments hold for it (soon) from 12 s before.
    id: 'patch.water', year: 1, order: 6, at: (s) => (s.patch.firstPlant == null ? null : waterForced(s)),
    soon: (s) => grows(s) && s.patch.firstPlant != null && sowSeen(s) != null && s.clock.clock1x + T.story.chatterGap1x > waterFrom1x(s),
    when: (s) => grows(s) && s.patch.firstPlant != null && sowSeen(s) != null && s.clock.day >= waterFrom(s) && s.clock.clock1x >= waterFrom1x(s) - 1e-6
      && plantedRows(s) > 0 && (s.patch.moisture < SY.patchWater.below || s.clock.day >= waterForced(s)),
    run(s, ctx) {
      ctx.unlock('patchWater');
      if (s.patch.moisture >= SY.patchWater.below) s.patch.moisture = round3(SY.patchWater.below - 0.03);   // Hal's dry week
      // on a foggy morning "dry week ahead" would contradict the fog chip: Hal says what fog doesn't do instead
      const line = s.weather.f > 0.6 && !s.weather.heat ? STORY.hal.wateringFog : STORY.hal.watering;
      ctx.say('hal', [line, LINES.hal.water2], { goal: { id: 'patchWater', target: { kind: 'fab', id: 'water' } } });
    },
  },
  { // #9 squash bugs (Jul 20, the first cluster is forced, Gran)
    id: 'patch.bugs', year: 1, order: 9, at: SY.bugs,
    when: (s) => grows(s) && s.clock.day >= D(SY.bugs) && rowsOf(s).some((row) => growing(row)),
    run(s, ctx) {
      ctx.unlock('bugs');
      let r = -1, best = -1;
      rowsOf(s).forEach((row, i) => { if (growing(row) && row.progress > best) { best = row.progress; r = i; } });
      const row = rowsOf(s)[r];
      row.bugs = Math.max(row.bugs, P.bugs.forced);
      repOf(s, row).clusters++;
      ctx.emit({ type: 'patch/bugs', row: r });
      ctx.say('gran', [STORY.gran.bugs, LINES.gran.bugs2], { goal: { id: 'bugs', text: fill(STORY.goals.bugs, { row: r + 1 }), target: { kind: 'row', id: r, ...rowCentre(r), zoom: T.ui.zoom.patch } },
        glide: { ...rowCentre(r), zoom: T.ui.zoom.patch } });
    },
  },
  { // #8b [B] the safety net (Jul 10, Gran, a bubble): an empty row on the last sowing day, one tap (rulings R14). Only on a
    // farm with an empty row. It teaches nothing new (it is a bubble, not a lesson), so it doesn't wait out the 25 s intro
    // gap (gap: false): waiting for it lost the question on about a farm in four (the dawn or the cull had just spoken) and
    // pushed the rest past the last sowing day. (Dated only while a row is empty: a fully planned farm's moments never hold
    // for it.)
    id: 'patch.safety', year: 1, order: 8.5, gap: false, at: (s) => (s.unlocks.patch && !bState(s).safety && emptyRow(s) >= 0 ? D(P.window[1]) : null),
    when: (s) => grows(s) && !!s.unlocks.patch && !bState(s).safety && s.clock.day >= D(P.window[1]) && s.clock.day <= D(P.window[1]) + 2 && emptyRow(s) >= 0,
    run: (s, ctx) => safetyNet(s, ctx),
  },
  // #13 honey (Aug 5, a toast-only lesson) is a moment now (honeyWeek: rulings R2, R4), not a beat
  { // #16 the barn and season prep (Sep 20, Gran then Mayor Pouch): "Cut row N's ripe pumpkins to the barn"
    id: 'patch.barn', year: 1, order: 16, at: SY.barn, pin: true,   // before the season: W1 needs the barn
    when: (s) => grows(s) && s.clock.day >= D(SY.barn),
    run(s, ctx) {
      ctx.unlock('barn');
      s.patch.barnDay = s.clock.day;
      ctx.say('gran', [LINES.gran.barn0, STORY.gran.barn, LINES.gran.barn2], { glide: { x: -9, z: -6, zoom: 0.8 } });
      ctx.say('mayor', [LINES.mayor.store1, LINES.mayor.store2]);
      if (!setBarnGoal(s, ctx)) s.patch.barnGoal = 'waiting';      // nothing would go soft before W1 yet
    },
  },
  { // [B] years 2+, Apr 20: Gran opens the Table with last October in one line (rulings R13). If nothing is planned by Jun 1
    // her usual fills the empty rows (patch dayStart).
    id: 'patch.seedLetter', years: [2, 999], order: 33, at: T.story.y2plus.seedLetter,
    when: (s) => grows(s) && s.clock.day >= D(T.story.y2plus.seedLetter) && s.clock.day < D(TB.y2Until) && !allPlanned(s),
    run(s, ctx) {
      ctx.say('gran', [lastOctLine(s), LINES.letter.plan], { goal: { id: 'plan2', text: LINES.letter.goal, target: { kind: 'station', id: 'patch' },
        until: D(TB.y2Until) - 1, lapse: false }, glide: { x: -1.5, z: 3, zoom: T.ui.zoom.patch } });
    },
  },
  { // Y2: White and Warty seed (Edna), with Edna's fad forecast so the bet is on the table before planting
    // (at: a dated lesson, so the moments queue keeps 12 s clear before it too)
    id: 'patch.y2varieties', year: 2, order: 30, at: 'Apr 2',
    when: (s) => grows(s) && s.clock.day >= D('Apr 2'),
    run(s, ctx) {
      const f = s.patch.fad, lines = [LINES.edna.y2];
      if (f) lines.push(fill(LINES.edna.fad, { VARIETY: vname(f.variety).toUpperCase(), pct: Math.round(f.confidence * 100) }));
      ctx.say('edna', lines);
    },
  },
  { // Y3: Cinderella and Blue (Edna)
    id: 'patch.y3varieties', year: 3, order: 30, at: 'Apr 2',
    when: (s) => grows(s) && s.clock.day >= D('Apr 2'),
    run(s, ctx) {
      const f = s.patch.fad, lines = [LINES.edna.y3];
      if (f) lines.push(fill(LINES.edna.fad, { VARIETY: vname(f.variety).toUpperCase(), pct: Math.round(f.confidence * 100) }));
      ctx.say('edna', lines);
    },
  },
  { // Y2: the Jul 1 fad reveal (Edna): held, flipped or fizzled. Later years get it as news (dayStart).
    id: 'patch.fad', year: 2, order: 31, at: (s) => (s.patch.fad && !s.patch.fad.revealed ? D(T.species.fads.reveal) : null),
    when: (s) => grows(s) && s.clock.day >= D(T.species.fads.reveal) && !!s.patch.fad && !s.patch.fad.revealed,
    run(s, ctx) { revealFad(s, ctx, true); },
  },
  { // Y2+: powdery mildew and milk spray (Old Moss), on the first mildew (forced by Jul 25 in year 2). Its forced day is its
    // `at`, so the moments queue keeps clear before it then; a chance infection earlier can't be seen coming (reported by
    // tests/balance/pacing.test.js as a lesson just after a moment).
    id: 'patch.mildew', years: [2, 999], order: 32, at: (s) => (s.clock.year === P.mildew.fromYear && !s.unlocks.mildew ? D(P.mildew.forceBy) : null),
    when: (s) => grows(s) && s.clock.year >= P.mildew.fromYear && rowsOf(s).some((row) => row.mildew > 0),
    run(s, ctx) {
      ctx.unlock('mildew');
      const r = rowsOf(s).findIndex((row) => row.mildew > 0);
      ctx.say('moss', [LINES.moss.mildew1, LINES.moss.mildew2, LINES.moss.mildew3], {
        goal: { id: 'milk', text: fill(LINES.goals.milk, { row: r + 1 }), target: { kind: 'row', id: r, ...rowCentre(r), zoom: T.ui.zoom.patch } },
        glide: { ...rowCentre(r), zoom: T.ui.zoom.patch } });
    },
  },
];

// ------------------------------------------------------------ bots (design §14)
// balanced: Gran's waves in year 1, then waves fitted to the forecast bar with a diversified mix; waters at M < 0.35,
// squishes every cluster, milks mildew, cuts ripe fruit before it softens, restocks on weekdays, collects honey.
// novice: random dates in the window, waters late (M < 0.25) and 70% of the time, squishes half the clusters.
function botPlan(s, P_) {
  const y = s.clock.year, acts = [];
  let cash = s.cash;
  const afford = (v, day) => (day > s.clock.day || cash >= VT[v].seed ? ((cash -= day > s.clock.day ? 0 : VT[v].seed), true) : false);
  // [B] the Planting Table's players (policy.table): the novice taps a random weekend span and variety, chips fills October's
  // crates greedily, careless puts every row on W1. One row a look, on the day the Table snaps to (targetDay).
  if (P_.table) return tablePlan(s, P_.table, afford);
  // a fixed plan (balance sweeps): [[row, variety, 'Mon D'], ...] in year 1, then the balanced bot's own plan; [B] or every
  // year (everyYear: the Y2-3 sweeps; a variety not yet unlocked is a Classic)
  if (Array.isArray(P_.plan) && (y === 1 || P_.everyYear)) {
    for (const [r, v, date] of P_.plan) {
      const row = rowsOf(s)[r];
      if (row?.open && !planted(row) && !row.plan) acts.push({ type: 'patch/plant', row: r, variety: unlocked(s, v) ? v : 'classic', day: Math.max(s.clock.day, D(date)), early: true });
    }
    return acts;
  }
  // 'gran' plans are Gran's waves in year 1 and Gran's waves fitted to the forecast bar after; 'gransUsual' never adapts
  if (y === 1 || P_.plan === 'gransUsual') return gransPlan(s).length ? [{ type: 'patch/gran' }] : [];
  // later years: a mix by row, and dates fitted so each row's ghost peaks on its target weekend (searched every few days)
  if (s.clock.day % 4) return acts;
  const mix = P_.mix || botMix(s);
  const targets = (P_.targets || ['Oct 4', 'Oct 9', 'Oct 13', 'Oct 17', 'Oct 21', 'Oct 24', 'Oct 11']).map(D);
  rowsOf(s).forEach((row, r) => {
    if (!row.open || planted(row) || row.plan) return;
    const v = mix[r] || 'classic';
    let best = null, bd = Infinity;
    for (let day = Math.max(s.clock.day, D('May 25')); day <= D('Jul 10'); day += 1) {
      const g = ghost(s, v, day);
      if (g.mid == null) continue;
      const dd = Math.abs(g.mid - (v === 'blue' ? D('Oct 6') : targets[r]));
      if (dd < bd) { bd = dd; best = day; }
    }
    if (best != null && afford(v, best)) acts.push({ type: 'patch/plant', row: r, variety: v, day: best, early: true });
  });
  return acts;
}
// [B] One row of a plan made on the Table: random (the novice: Classics three times in four in year 1, any unlocked variety
// after), careless (Classics on W1, every row) or chips (the variety and span that add the most to October, less the seed).
function tablePlan(s, mode, afford) {
  const y = s.clock.year, r = rowsOf(s).findIndex((row) => row.open && !isPlanned(row));
  if (r < 0) return [];
  let v = 'classic', span = [0, 0];
  if (mode === 'random') {
    const vs = y === 1 ? ['classic', 'classic', 'classic', 'mini'] : unlockedVarieties(s);
    v = vs[Math.floor(u01(s.seed, y, r, 'tv') * vs.length)];
    span = SPANS[Math.floor(u01(s.seed, y, r, 'ts') * SPANS.length)];
  } else if (mode === 'chips') ({ v, span } = bestChip(s, r));
  const day = targetDay(s, v, span);
  return afford(v, day) ? [{ type: 'patch/plant', row: r, variety: v, day }] : [];
}
/** The chips player's pick for row r: every variety and span on the Table, the one October's crates gain most from. */
export function bestChip(s, r) {
  let best = null;
  for (const v of y1(s) ? ['classic', 'mini'] : unlockedVarieties(s)) for (const span of SPANS) {
    const proj = ghost(s, v, targetDay(s, v, span)), W = walkOctober(s, { row: r, proj }, crateDemand(s));
    const val = W.val - VT[v].seed;
    if (!best || val > best.val) best = { v, span, val };
  }
  return best;
}
// A diversified field in demand order (Classic, then the "weird ones", then the showpieces), minis second from the front;
// a confident fad gets a row of its own if the mix lacks one.
function botMix(s) {
  const vs = new Set(unlockedVarieties(s)), f = s.patch.fad, n = rowsOf(s).filter((row) => row.open).length;
  const mix = ['classic', 'mini', 'warty', 'white', 'blue', 'cinderella', 'classic'].filter((v) => vs.has(v));
  while (mix.length < P.rows) mix.push(mix.length % 3 ? 'classic' : 'mini');
  if (f && f.confidence >= 0.7 && vs.has(f.variety) && !mix.slice(0, n).includes(f.variety)) mix.splice(2, 0, f.variety);
  return mix;
}
function botCare(s, P_) {
  const acts = [], d = s.clock.day, y = s.clock.year;
  const roll = (k, p) => u01(s.seed, y, d, k) < p;
  // [B] waterAfterSlip (balance only): ignores the ring until the crates first slip, then waters like anyone (rulings: the cliff
  // is visible, and a player who answers the first slip recovers)
  const waits = P_.waterAfterSlip && !(s.patch.shelfLast?.slip || []).some((x) => x >= 0);
  if (grows(s) && s.unlocks.patchWater && plantedRows(s) && !waits && s.patch.moisture < (P_.waterBelow ?? 0.35) && roll('w', P_.reliability ?? 1) && canAfford(s, waterBill(s))) acts.push({ type: 'patch/water' });
  rowsOf(s).forEach((row, r) => {
    if (row.bugs > 0 && !(P_.delegate && hired(s, 'ladybug'))) acts.push(...botBugs(s, P_, r, row));   // [E]
    if (P_.name === 'balanced' && row.mildew >= P.mildew.start && canAfford(s, P.mildew.spray + 50)) acts.push({ type: 'patch/milk', row: r });
  });
  if (honeyPinDue(s)) acts.push({ type: 'patch/honey' });   // [B] the lesson's jars; from year 2, once a week (rulings R4)
  if (isActive(s, 'swarm') && P_.name === 'balanced') acts.push({ type: 'events/tap', id: 'swarm' });
  if (s.patch.volunteer?.state === 'ripe') acts.push({ type: 'patch/volunteer' });
  // a shiny is spotted by whoever walks the rows: the Operator taps it too (Bea keeps the barn, not the delights)
  if (P_.name === 'balanced') for (const sh of s.patch.shinies) if (sh.state === 'field') acts.push({ type: 'patch/shinyTap', id: sh.id });
  if (P_.name === 'balanced' && !(P_.delegate && hired(s, 'bea'))) {   // the Operator leaves the barn to Bea
    // The barn: on days the stand is quiet, cut only the fruit that would go soft before the next selling day (oldest
    // first, so the rest of the row stays on display), and on the eve of a weekend restock the emptiest rows, front rows
    // first, from what the barn holds. Actions are planned up front, so the bot keeps its own count of space and stock.
    let stock = barnStock(s);
    if (d >= D(P.barn.cutFrom) && !isWeekend(d) && (s.unlocks.barn || y > 1)) {
      for (const c of softCuts(s)) { acts.push({ type: 'patch/cut', row: c.row, n: c.n }); stock += c.n; }
    }
    if (s.clock.phase === 'october' && !isWeekend(d) && isWeekend(d + 1)) {
      const order = rowsOf(s).map((row, r) => r).filter((r) => rowsOf(s)[r].open && displayVariety(rowsOf(s)[r]))
        .sort((a, b) => fullness(s, a) - (a < 2 ? 0.25 : 0) - (fullness(s, b) - (b < 2 ? 0.25 : 0)));
      for (const r of order) {
        if (stock <= 0) break;
        if (fullness(s, r) < 0.5) { acts.push({ type: 'patch/restock', row: r }); stock -= P.barn.restockN; }
      }
    }
  }
  return acts;
}
const nextSaleDay = (d) => { for (let t = d + 1; t <= EVE; t++) if (isWeekend(t)) return t; return EVE; };
/** The next selling day after d (a weekend day; the eve of the weigh-off at the latest). */
export const nextSale = nextSaleDay;
/**
 * The barn routine: prime fruit that would go soft before the next selling day, oldest first, as [{ row, n }] that fit
 * in the barn (the shiny stays in the field). The balanced bot cuts these on quiet days; Bea, once hired, does it nightly.
 */
export function softCuts(s, d = s.clock.day) {
  const wait = nextSaleDay(d) - d, out = [];
  let free = barnFree(s);
  rowsOf(s).forEach((row, r) => {
    if (!row.stock.prime || free <= 0) return;
    const k = row.mildew > 0 ? 1 / P.aging.mildewLife : 1;
    let n = 0;
    for (const c of row.fruit) if (c.st === 'prime' && c.age + wait * k >= VT[c.v].prime - 1e-9) n += c.n;
    n = Math.min(n, free, row.stock.prime - (row.shiny ? 1 : 0));
    if (n > 0) { out.push({ row: r, n }); free -= n; }
  });
  return out;
}
// Bea the farmhand (hire) keeps the barn routine for you: every night from Sep 1 she cuts what would go soft before it
// can sell (design §9 automation curve: the chores you can buy back). A player who already does it gains little.
function beaCuts(s, ctx) {
  if (!hired(s, 'bea') || s.clock.day < D(P.barn.cutFrom) || s.clock.day >= EVE) return;
  for (const c of softCuts(s)) { const n = cutToBarn(s, c.row, c.n); if (n) ctx.emit({ type: 'patch/cut', row: c.row, n, by: 'bea' }); }
}

// ============================================================ [B] the Planting Table and the October crates
// (plan §3.8, §3.9; rulings R2, R3, R4, R8, R9, R13, R14). What the player should feel at each step, and what makes it so:
//   May 20, the Table  "I can think": the clock stops while it is open (ui/clock.js, registerPlanning). Gran teaches row 1
//                      (Classics, W1) and row 2 (Minis, your pick), then hands over: "W4's the big one". Dragging a row's
//                      ripe window fills October's crates live; the weekends are magnets (targetDay), so nobody ever asks
//                      "which day should I pick?". Closing: "I made October." (the planned First; Gran's line if it's good)
//   June, sowing days  "my plan is happening": each row goes in on its morning as one beat (a moment, with Grandpa's note
//                      when one is due and the first-row banner), its stake flag pops, the dust puffs, Biscuit runs it.
//   A dry spell        "W1 is slipping, water now!": a slip names the weekend, the cause and the row. It is a threat (the
//                      clock slows), only for something you can fix, and never twice for a weekend in 5 days.
//   All summer         a calm heartbeat: Gran's tally every second Sunday, only when a crate moved, always with a lever
//                      (rulings R9); "Row 1 set 104 Classics. W1's crate is real now." as a toast.
//   Jul 10             an empty row: Gran asks once, one tap (rulings R14). Never a solver: doing nothing leaves it empty.
//   Years 2+, Apr 20   Gran opens the Table with last October in one line (rulings R13); her usual fills what's left on Jun 1.
// State: s.patch.shelfLast (the crates as of this morning: levels, stages, the high-water mark a slip falls from, the next
//   tally), s.patch.sown { [row]: day } (this year's sowing days), row.lost { dry, fog } (growth days lost), row.told
//   (milestones said: 1 flower, 2 set), row.slow (a slow start's days left), row.setDay, s.patch.b = { handover, honey,
//   honeyLast, safety, y2, window, lapse, fogJobs } (the lessons' progress this year).
// Out-events: patch/sowing { rows, x, z, zoom } (the morning's rows go in: dust, flags, Biscuit), patch/crate { i, stage,
//   level, was } (a crate changed), alert shelfSlip { w, cause, row }, plus moments 'sowing', 'tally', 'honeyLesson', toasts.
const levelOf = (met) => SH.levels.filter((x) => met >= x - 1e-9).length;
const CRATE_STAGE = { tilled: 'planned', seeded: 'growing', sprouts: 'growing', vines: 'growing', flowers: 'flowering', green: 'set', ripe: 'ripe', done: 'ripe' };
const freshB = () => ({ handover: false, planned: false, honey: false, honeyLast: null, safety: false, window: false, lapse: false, fogJobs: 0, sowAt: null });
const bState = (s) => (s.patch.b ??= freshB());
const isPlanned = (row) => !!row?.open && (planted(row) || !!row.plan);
const allPlanned = (s) => rowsOf(s).every((row) => !row.open || isPlanned(row));
const y1 = (s) => s.clock.year === 1;

// ------------------------------------------------------------ the Table: from weekends to a sowing day
/** The sowing days the Table offers: from the window's first day still open to its last (just today, once it has shut). */
export function tableWindow(s) {
  const lo = Math.max(s.clock.day, D(P.window[0]));
  return [lo, Math.max(lo, D(P.window[1]))];
}
/** Every span the Table offers: one weekend, or two next to each other ([[0,0], [0,1], [1,1], ...]). */
export const SPANS = weekends().flatMap((w, i, all) => [[i, i], ...(i + 1 < all.length ? [[i, i + 1]] : [])]);
// Variety v sown on each day of the window: its ghost's prime fruit on each weekend (Saturday and Sunday averaged) and its
// median ripe day. Cached per morning: the ghost reads Hal's 3-day forecast, the hives and the compost.
const dayTables = new WeakMap();
function dayTable(s, v) {
  let byYear = dayTables.get(s.weather.days);
  if (!byYear) dayTables.set(s.weather.days, (byYear = new Map()));
  const key = `${s.clock.year}|${s.clock.day}|${v}|${s.patch.hives}|${compost(s)}`;
  let tab = byYear.get(key);
  if (!tab) {
    const [lo, hi] = tableWindow(s), W = weekends();
    tab = [];
    for (let d = lo; d <= hi; d++) {
      const g = ghost(s, v, d);
      tab.push({ d, mid: g.mid, late: g.late, wk: W.map((w) => (stateOn(g, w.sat).p + stateOn(g, w.sun).p) / 2) });
    }
    if (byYear.size > 48) byYear.clear();
    byYear.set(key, tab);
  }
  return tab;
}
/**
 * The best sowing day for variety v to be ripe for weekends span[0]..span[1]: the most prime fruit on the worst of them, the
 * middle of a plateau, within tableWindow (the weekends are magnets: the Table snaps to this day on release).
 */
export function targetDay(s, v, span) {
  const tab = dayTable(s, v), [i, j] = span, tol = TB.plateau;
  let best = -Infinity, a = 0, b = 0;
  tab.forEach((x, k) => {
    let sc = Infinity;
    for (let w = i; w <= j; w++) sc = Math.min(sc, x.wk[w]);
    if (sc > best + tol) { best = sc; a = b = k; } else if (sc >= best - tol && b === k - 1) b = k;
  });
  return tab.length ? tab[Math.floor((a + b) / 2)].d : s.clock.day;
}
/** Can v still be ripe for weekend i? null if so, else 'too late' or 'too early' (the Table greys the chip). */
export function reachOf(s, v, i) {
  const tab = dayTable(s, v), min = Math.max(TB.labelMin, TB.labelShare * expectedSet(s, v));
  if (tab.some((x) => x.wk[i] >= min)) return null;
  return (tab[0]?.mid ?? 999) > weekends()[i].sun ? 'too late' : 'too early';
}
/** The sowing day whose ghost's middle sits nearest `day` (dragging the ripe window: the day follows the finger). */
export function dayForRipe(s, v, day) {
  let best = null, bd = Infinity;
  for (const x of dayTable(s, v)) if (x.mid != null && Math.abs(x.mid - day) < bd) { bd = Math.abs(x.mid - day); best = x.d; }
  return best ?? tableWindow(s)[0];
}
// A projection's weekends: where its prime fruit on the Saturday is at least max(labelMin, labelShare x its set). It reads
// only the row's own projection, so a row's label is the same alone as inside a full plan (the old "covers" bug, pinned).
function targetsOf(proj) {
  if (!proj?.cohorts?.length) return [];
  const set = proj.cohorts.reduce((a, c) => a + c.n, 0), min = Math.max(TB.labelMin, TB.labelShare * set);
  return weekends().filter((w) => stateOn(proj, w.sat).p >= min).map((w) => w.i);
}
/** The weekends a row is ripe for (planted or planned): [0..3]. The stake flag, the row tab and the sowing toast say it. */
export const rowTargets = (s, r) => targetsOf(projectRow(s, r));
/** The weekends variety v sown on `day` would be ripe for. */
export const ghostTargets = (s, v, day) => targetsOf(ghost(s, v, day));
/**
 * What a drag on the Table aims at: of the one- and two-weekend spans (SPANS) inside the window's weekends, the one with the
 * most prime fruit on its Saturdays (a pair when two weekends qualify). A Classic's window can touch three weekends; the
 * magnet then pulls it onto the best two, never onto a thin three-way spread. @returns {number[]|null} [first, last]
 */
export function dragSpan(s, v, day) {
  const g = ghost(s, v, day), ts = targetsOf(g);
  if (!ts.length) return null;
  const on = (i) => stateOn(g, weekends()[i].sat).p;
  let best = null, bv = -1;
  for (const sp of SPANS) {
    if (!ts.includes(sp[0]) || !ts.includes(sp[1])) continue;
    const val = on(sp[0]) + (sp[1] !== sp[0] ? on(sp[1]) : 0);
    if (val > bv) { bv = val; best = sp; }
  }
  return best ? [...best] : null;
}
/** "W1", "W2–3", "W1, W3", or '' for none. */
export function spanText(ts) {
  if (!ts?.length) return '';
  const a = [...ts].sort((x, y) => x - y);
  if (a.every((x, k) => !k || x === a[k - 1] + 1)) return a.length === 1 ? `W${a[0] + 1}` : `W${a[0] + 1}–${a.at(-1) + 1}`;
  return a.map((x) => `W${x + 1}`).join(', ');
}
/** The variety the Table starts a row on: Gran's lesson rows in year 1, a Mini for row 2, Classics elsewhere. */
export function tableDefault(s, r) {
  const ls = y1(s) && TB.lesson[r];
  if (ls) return ls[0];
  return r === 1 ? 'mini' : 'classic';
}
/**
 * Gran's lesson on the Table (year 1): 'row1' (row 1, Classics, W1 pulses), 'row2' (row 2, Minis, no pulse), 'handover'
 * (rows 3 and 4 are yours) or null. She teaches by watching, never by planting.
 */
export function lessonStep(s) {
  if (!y1(s) || !s.unlocks.patch) return null;
  const rows = rowsOf(s);
  if (!isPlanned(rows[0])) return 'row1';
  if (!isPlanned(rows[1])) return 'row2';
  return allPlanned(s) ? null : 'handover';
}
/** Ask Gran (behind Details): one line about the weakest crate and the chip she'd tap. Never plants. */
export function askGran(s) {
  const sh = shelf(s).filter((c) => c.stage !== 'past');
  const weak = sh.slice().sort((a, b) => a.met - b.met || b.i - a.i)[0];
  if (!weak || weak.level >= 2) return { line: LINES.table.askNone, variety: null, span: null };
  const small = weak.needSmall - weak.small > weak.needBig - weak.big;
  return { line: fill(small ? LINES.table.askSmall : LINES.table.askBig, { n: weak.i + 1 }), variety: small ? 'mini' : 'classic', span: [weak.i, weak.i] };
}
/** A plan's gestures on the Table (a DOM-free model, rulings R3): the variety if it isn't the row's default, one drag, Plant. */
export const gesturesFor = (s, r, v) => (v === tableDefault(s, r) ? 0 : 1) + 2;

// ------------------------------------------------------------ the crates
// The crates' wants: projectDemand calibrated against what October really sells (sold plus wants nobody met, tests/balance/
// shelf.test.js): x demandK by kind, and x demandW by weekend (year 1's first weekends are small and W3 big: the Cove learns
// about the farm through October; from year 2 the weekends lean less).
const crateDemand = (s) => ({ ...SH.demandK, w: s.clock.year === 1 ? SH.demandW.y1 : SH.demandW.later });
/**
 * October's crates, one per weekend: { id, i, needBig, needSmall, big, small, met, level (0 empty, 1 thin, 2 good, 3 full),
 * stage, causes, rows }. needBig / needSmall: the weekend's wants (calibrated, SH.demandK); big / small: the fruit the rows
 * and the barn will have ripe for it; rows: the rows that feed it, biggest first (-1 the barn). stage: planned | growing |
 * flowering | set | ripe | barn | empty, or past once the weekend is over (then the numbers are what really sold). causes:
 * what is costing it now [{ cause: bugs | mildew | dry | fog, row, n }]. swap: { row, proj } puts a ghost in a row (the
 * Table's live drag). Pure; D's Coming-up sheet and C's Crier line read it too.
 */
export function shelf(s, swap = null) {
  const W = walkOctober(s, swap, crateDemand(s)), oct = s.patch.report?.oct, rows = rowsOf(s);
  return W.wk.map((w) => {
    const id = `W${w.i + 1}`;
    if (w.past) {
      const o = oct?.[w.i] || freshOct()[0], needBig = o.big + o.missBig, needSmall = o.small + o.missSmall, need = needBig + needSmall;
      const met = need ? (o.big + o.small) / need : 0;
      return { id, i: w.i, needBig, needSmall, big: o.big, small: o.small, met, level: levelOf(met), stage: 'past', causes: [], rows: [] };
    }
    const need = w.needL + w.needM, got = w.gotL + w.gotM, met = need ? got / need : 0;
    const feed = Object.entries(w.by).map(([r, n]) => [+r, n]).filter(([, n]) => n > 0 && n >= SH.feedShare * got).sort((a, b) => b[1] - a[1]).map(([r]) => r);
    const lead = rows[feed[0]];
    return { id, i: w.i, needBig: w.needL, needSmall: w.needM, big: w.gotL, small: w.gotM, met, level: levelOf(met),
      stage: !feed.length ? 'empty' : feed[0] < 0 ? 'barn' : planted(lead) ? CRATE_STAGE[lead.stage] || 'growing' : 'planned',
      causes: standingCauses(rows, feed), rows: feed };
  });
}
function standingCauses(rows, feed) {
  const out = [];
  for (const r of feed) {
    const row = rows[r];
    if (!row || !planted(row)) continue;
    if (row.bugs > 0) out.push({ cause: 'bugs', row: r, n: row.bugs });
    if (row.mildew > 0) out.push({ cause: 'mildew', row: r, n: row.mildew });
    if ((row.lost?.dry || 0) >= SH.slipDry) out.push({ cause: 'dry', row: r, n: row.lost.dry });
    if ((row.lost?.fog || 0) >= 1) out.push({ cause: 'fog', row: r, n: row.lost.fog });
  }
  return out;
}
// What moved a crate since a snapshot of the rows' lost days (at: [[dry, fog] by row]): bugs or mildew on a row that feeds it
// now, else the larger of the dry and fog days its rows lost since (dry needs a whole day: SH.slipDry), else the weather
// (Hal's forecast moved the projection: nothing to fix, nothing to say).
function causeOf(s, rowsFed, at) {
  const rows = rowsOf(s), feed = [...new Set(rowsFed)].filter((r) => r >= 0 && planted(rows[r]));
  // (a cluster that hasn't cost the row any health yet hasn't cost October anything either)
  const hurt = (r) => (at?.[r]?.[2] ?? 1) - rows[r].health >= SH.hurtMin;
  const bug = feed.find((r) => rows[r].bugs > 0 && hurt(r));
  if (bug != null) return { cause: 'bugs', row: bug };
  const mil = feed.find((r) => rows[r].mildew > 0 && hurt(r));
  if (mil != null) return { cause: 'mildew', row: mil };
  const most = (k) => feed.map((r) => [r, (rows[r].lost?.[k] || 0) - (at?.[r]?.[k === 'dry' ? 0 : 1] || 0)]).sort((a, b) => b[1] - a[1])[0] || [feed[0] ?? 0, 0];
  const [rd, dd] = most('dry'), [rf, df] = most('fog');
  if (dd >= SH.slipDry && dd >= df) return { cause: 'dry', row: rd };
  if (df > 0) return { cause: 'fog', row: rf };
  return { cause: 'weather', row: rd };
}
const lostSnap = (s) => rowsOf(s).map((row) => [row.lost?.dry || 0, row.lost?.fog || 0, row.health]);
// Slips are armed in year 1 by Hal's watering lesson: nothing slips before watering has been taught.
const armed = (s) => s.clock.year > 1 || !!s.unlocks.patchWater;

// One morning of the crates, from the first sowing to the end of September: crate changes (progress you can see), slips (a
// threat, only for something you can fix), Gran's tally (only when a level moved, always with a lever) and row milestones.
function crateDay(s, ctx) {
  const pa = s.patch, d = s.clock.day, sh = shelf(s), rows = rowsOf(s);
  const L = (pa.shelfLast ??= { lvl: sh.map((c) => c.level), stage: sh.map((c) => c.stage), hi: sh.map((c) => c.met), feed: sh.map((c) => c.rows),
    at: sh.map(() => lostSnap(s)), slip: sh.map(() => -99), tally: d + SH.tally.everyDays, tLvl: sh.map((c) => c.level), tAt: lostSnap(s),
    tWater: pa.watered, tSlip: false });
  let slipped = false;                                    // (one slip a morning: the most pressing weekend speaks for all)
  for (const c of sh.slice().sort((a, b) => a.met - b.met)) {
    const i = c.i;
    if (c.stage === 'past') continue;
    // a crate's level as the farm reacts to it: up at a threshold, down only once it is clearly below (no flicker)
    if (c.level < L.lvl[i] && c.met > SH.levels[L.lvl[i] - 1] - SH.hyst) c.level = L.lvl[i];
    if (c.stage !== L.stage[i] || c.level !== L.lvl[i]) ctx.emit({ type: 'patch/crate', i, stage: c.stage, level: c.level, was: L.lvl[i] });
    if (armed(s) && !slipped && c.level < L.lvl[i] && L.hi[i] - c.met >= SH.slipMin && d - L.slip[i] >= SH.slipEveryDays && d - Math.max(...L.slip) >= SH.slipGapDays) {
      const why = causeOf(s, [...L.feed[i], ...c.rows], L.at[i]);
      if (SH.slipCauses.includes(why.cause)) {
        const r = why.row, k = Math.max(1, Math.round(rows[r]?.lost?.dry || 0));
        const text = fill(LINES.slip[why.cause], { n: i + 1, r: r + 1, d: k === 1 ? 'a day' : `${k} days` });
        ctx.alert('shelfSlip', { text, cls: 'warn', w: i, cause: why.cause, row: r });
        L.slip[i] = d; L.hi[i] = c.met; L.at[i] = lostSnap(s); L.feed[i] = c.rows; L.tSlip = true; slipped = true;
      }
    }
    if (c.met > L.hi[i]) { L.hi[i] = c.met; L.at[i] = lostSnap(s); L.feed[i] = c.rows; }
    L.lvl[i] = c.level; L.stage[i] = c.stage;
  }
  // Gran's tally: every second Sunday or so from the first sowing, only when a crate's level moved since the last one, with
  // the lever for it
  if (pa.firstPlant == null) { L.tally = d + SH.tally.everyDays; L.tLvl = sh.map((x) => x.level); L.tAt = lostSnap(s); return; }
  if (d >= L.tally && d <= D(SH.tally.until)) {
    L.tally = d + SH.tally.everyDays;
    const moved = sh.filter((c) => c.stage !== 'past' && c.level !== L.tLvl[c.i]).sort((a, b) => (a.level - L.tLvl[a.i]) - (b.level - L.tLvl[b.i]));
    if (moved.length) {
      const c = moved[0], words = sh.map((x) => LINES.level[x.level]);
      const head = fill(LINES.tally.head, { l1: words[0], l2: words[1], l3: words[2], l4: words[3] });
      const lever = tallyLever(s, c, c.level < L.tLvl[c.i], L);
      ctx.moment({ id: `tally:${s.clock.year}:${d}`, kind: 'tally', say: ['gran', [head, lever.text]],
        data: { levels: sh.map((x) => x.level), w: c.i, cause: lever.cause } });
    }
    L.tLvl = sh.map((x) => x.level); L.tAt = lostSnap(s); L.tWater = pa.watered; L.tSlip = false;
  }
  milestones(s, ctx);
}
// The tally's second line: what moved the crate, and what you can do about it (rulings R9: always a lever).
// Returns { text, cause } (the cause rides on the moment's data: the tests check fog is blamed on the fog).
function tallyLever(s, c, down, L) {
  const TL = LINES.tally, n = c.i + 1, rows = rowsOf(s);
  if (down) {
    const empty = rows.findIndex((row) => row.open && !isPlanned(row));
    const why = causeOf(s, [...L.feed[c.i], ...c.rows], L.tAt);
    if (why.cause === 'weather' && empty >= 0 && s.clock.day <= D(P.window[1])) return { text: fill(TL.late, { n, r: empty + 1 }), cause: 'late' };
    const cause = TL[why.cause] ? why.cause : 'fog';
    return { text: fill(TL[cause], { n, r: why.row + 1 }), cause };
  }
  if (L.tSlip && s.patch.watered > L.tWater) return { text: fill(TL.back, { n }), cause: 'back' };
  const set = c.rows.map((r) => [r, rows[r]]).find(([, row]) => row?.set > 0 && row.setDay != null && s.clock.day - row.setDay < SH.tally.everyDays);
  if (set) return { text: fill(TL.set, { n, r: set[0] + 1, k: set[1].set }), cause: 'set' };
  return { text: fill(TL.sun, { n }), cause: 'sun' };
}
// Row milestones (toasts, at most one a morning): in flower; fruit set, with the weekend it fills and the bees' share.
// Year 1 says them all; from year 2 only a set that came in thin.
function milestones(s, ctx) {
  rowsOf(s).some((row, r) => {
    if (!planted(row)) return false;
    const told = row.told | 0, V = vname(row.variety);
    if (!(told & 1) && row.stage === 'flowers') {
      row.told = told | 1;
      if (!y1(s)) return false;
      ctx.moment({ id: `ms:${s.clock.year}:${r}:f`, kind: 'toast', toast: { text: fill(LINES.milestone.flower, { r: r + 1 }), icon: 'patch' } });
      return true;
    }
    if (!(told & 2) && row.set > 0) {
      row.told = told | 2;
      const base = yieldOf(row.variety) * compost(s), thin = row.set < 0.8 * base;
      if (!y1(s) && !thin) return false;
      const w = rowTargets(s, r), M = LINES.milestone, bees = Math.round(row.set - base * row.health);
      const text = thin && !y1(s) ? fill(M.thin, { r: r + 1, n: row.set, Variety: V })
        : fill(w.length ? M.set : M.setNone, { r: r + 1, n: row.set, Variety: V, w: w[0] + 1 }) + (bees >= 1 ? fill(M.bees, { m: bees }) : '');
      ctx.moment({ id: `ms:${s.clock.year}:${r}:s`, kind: 'toast', toast: { text, icon: 'pumpkin', cls: 'good' } });
      return true;
    }
    return false;
  });
}

// ------------------------------------------------------------ sowing days (rulings R2: one moment a morning)
// A row goes in (its scheduled morning, or "Plant now"): one beat with whatever else that morning holds (Grandpa's note, the
// first-row banner) under the merge key sow{day}. Skip stops on it; it waits up to sowingLateDays for its window.
function sowing(s, ctx, r, mine = false) {
  const row = rowsOf(s)[r], d = s.clock.day, merge = `sow${d}`;
  (s.patch.sown ??= {})[r] = d;
  ctx.moment({ id: `sow:${s.clock.year}:${r}`, kind: 'sowing', merge, stop: true, mine, maxWaitDays: SH.sowingLateDays,
    data: { row: r, v: row.variety, ts: rowTargets(s, r), seed: VT[row.variety].seed } });
  ctx.mod('pokes')?.find?.(s, ctx, 'sowing', { merge, mine });
}
const listText = (xs) => (xs.length < 2 ? `${xs[0]}` : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const MOMENTS = {
  sowing: {
    run(s, ctx, m, group) {
      const sows = group.filter((x) => x.kind === 'sowing');
      if (sows[0] !== m) return;                          // the morning's rows are one beat: the first says it for all
      bState(s).sowAt ??= s.clock.clock1x;                // (the watering lesson waits for the year's first)
      const rs = sows.map((x) => x.data.row), seed = sows.reduce((a, x) => a + x.data.seed, 0);
      const ts = [...new Set(sows.flatMap((x) => x.data.ts))];
      const text = rs.length === 1 ? fill(LINES.sown, { r: rs[0] + 1, Variety: vname(m.data.v), targets: spanText(ts) || 'late October', seed })
        : fill(LINES.sownMany, { rs: listText(rs.map((r) => r + 1)), targets: spanText(ts) || 'late October', seed });
      ctx.emit({ type: 'toast', text, cls: 'good', icon: 'patch' });
      ctx.emit({ type: 'patch/sowing', rows: rs, ...rowCentre(rs[0]), zoom: T.ui.zoom.patch });
    },
    // no window came (a busy July): the morning's rows still get a line, as a plain toast with the day they went in
    drop(s, ctx, m) {
      bState(s).sowAt ??= s.clock.clock1x;
      const day = s.patch.sown?.[m.data.row];
      if (day != null) ctx.emit({ type: 'toast', text: fill(LINES.sownLate, { r: m.data.row + 1, Variety: vname(m.data.v), date: label(day), targets: spanText(m.data.ts) || 'late October' }), cls: 'good', icon: 'patch' });
    },
  },
  // the year-1 honey lesson (a toast-only lesson: it waits for a quiet window like any moment, and is never lost)
  honeyLesson: { run: (s, ctx) => honeyLesson(s, ctx), drop: (s, ctx) => honeyLesson(s, ctx) },
};
function honeyLesson(s, ctx) {
  if (s.unlocks.hives) return;
  ctx.unlock('hives');
  bState(s).honeyLast = s.clock.day;
  s.patch.honeyReady = Math.max(s.patch.honeyReady, s.patch.hives * P.hives.cap);
  ctx.emit({ type: 'toast', text: LINES.toast.honeyIntro, cls: 'good', icon: 'hives' });
  ctx.emit({ type: 'patch/focus', x: -4.8, z: -16, zoom: 1.6 });
  ctx.emit({ type: 'sound', name: 'buzz' });
  // (never over a live lesson's goal, a creak's say: the jars' pin teaches it anyway)
  const g = s.story.goal;
  if (!g || STALE_GOALS.has(g.id)) ctx.goal('honey', null, { kind: 'pin', id: 'honey', x: -4.8, z: -16, zoom: 1.6 });
}
/** The honey pin: the lesson's goal; from year 2, at most once a week (rulings R4). Year 1 after the lesson Gran shelves it. */
export function honeyPinDue(s) {
  if (!(s.patch.honeyReady >= 1)) return false;
  if (s.story.goal?.id === 'honey') return true;
  if (s.clock.year === 1) return false;
  const last = s.patch.b?.honeyLast;
  return last == null || s.clock.day - last >= HV.pinEvery;
}
// Honey after its lesson (rulings R4): year 1, Gran shelves the week's jars herself, one toast; years 2+ the pin asks weekly.
function honeyWeek(s, ctx) {
  const b = bState(s), pa = s.patch, d = s.clock.day;
  if (y1(s) && grows(s) && !s.unlocks.hives && !b.honey && d >= D(SY.honey)) {
    b.honey = true;
    ctx.moment({ id: 'honey:lesson', kind: 'lesson', prio: HV.lessonPrio, maxWaitDays: HV.lessonWait, handler: 'honeyLesson' });
  }
  if (y1(s) && s.unlocks.hives) b.honeyLast ??= d;            // (a save from before the weekly shelving: it starts today)
  if (!y1(s) || !s.unlocks.hives || s.story.goal?.id === 'honey' || d - b.honeyLast < HV.shelveEvery) return;
  b.honeyLast = d;
  const jars = Math.floor(pa.honeyReady);
  if (jars < 1) return;
  pa.honeyReady = round3(pa.honeyReady - jars);
  pa.honeyJars += jars; pa.honeyTotal += jars;
  ctx.moment({ id: `honey:${d}`, kind: 'toast', toast: { text: fill(LINES.honey.shelved, { n: jars, s: jars === 1 ? '' : 's' }), icon: 'hives', cls: 'good' } });
}

// ------------------------------------------------------------ the plan is made (patch/plant, patch/gran)
// Gran hands over the chalk once rows 1 and 2 are planned; the goal ends when every open row has a plan, with the planned
// First (Gran's line when every crate is good) or, in year 1, her nag about the barest crate.
function planned(s, ctx, mine) {
  const b = bState(s), g = s.story.goal;
  if (y1(s) && !b.handover && isPlanned(rowsOf(s)[0]) && isPlanned(rowsOf(s)[1])) {
    b.handover = true;
    if (g?.id === 'plan' && !allPlanned(s)) ctx.goal('plan', LINES.goalCrates, g.target, { quiet: true, until: g.until, lapse: false });
  }
  if (!allPlanned(s) || b.planned) return;
  b.planned = true;                                       // (once a year: unplanning a row and planting it again is no news)
  ctx.goalDone('plan'); ctx.goalDone('plan2');
  const sh = shelf(s).filter((c) => c.stage !== 'past'), good = sh.every((c) => c.level >= 2);
  ctx.mod('firsts')?.mark?.(s, ctx, 'planned', { mine, good });
  const bare = sh.slice().sort((a, c) => a.met - c.met)[0];
  if (y1(s) && !good && bare && bare.level <= 1) ctx.moment({ id: `bare:${s.clock.year}`, kind: 'tally', mine, say: ['gran', fill(LINES.table.bare, { n: bare.i + 1 })] });
}

// ------------------------------------------------------------ years 2+: Gran's prompt (rulings R13), her usual on Jun 1
/** Gran's line about last October: the weekend that ran out (the most unmet wants) and the one fruit went soft before. */
export function lastOctLine(s) {
  const o = s.patch.lastReport?.oct, L = LINES.letter;
  if (!o) return L.fine;
  const miss = o.map((x, i) => [i, x.missBig + x.missSmall, x.missBig >= x.missSmall]).sort((a, b) => b[1] - a[1])[0];
  const soft = o.map((x, i) => [i, x.soft]).sort((a, b) => b[1] - a[1])[0];
  const ran = miss[1] >= TB.y2Short, went = soft[1] >= TB.y2Soft, kind = miss[2] ? L.big : L.small;
  if (ran && went) return fill(L.both, { n: miss[0] + 1, kind, k: soft[1], m: soft[0] + 1 });
  if (ran) return fill(L.ranOut, { n: miss[0] + 1, kind });
  if (went) return fill(L.soft, { k: soft[1], n: soft[0] + 1 });
  return L.fine;
}
function plantGrans(s, ctx) {
  for (const p of gransPlan(s)) ACTIONS['patch/plant'](s, { ...p, early: true, gran: true }, ctx);
}
// The last sowing day in year 1: an open row with nothing in it gets one question (rulings R14). Doing nothing leaves it empty.
// A beat (patch.safety), so the quiet-day hurry and the moments see it coming and it keeps clear of the lessons.
const emptyRow = (s) => rowsOf(s).findIndex((row) => row.open && !isPlanned(row));
function safetyNet(s, ctx) {
  const b = bState(s), rows = rowsOf(s), r = emptyRow(s);
  if (r < 0) return;
  b.safety = true;
  const v = rows.some((row) => isPlanned(row) && (row.plan?.variety ?? row.variety) === 'mini') ? 'classic' : 'mini', L = LINES.safety;
  const vars = { r: r + 1, Variety: vname(v), seed: VT[v].seed, targets: spanText(ghostTargets(s, v, s.clock.day)) || 'late October' };
  ctx.emit({ type: 'patch/focus', ...rowCentre(r), zoom: T.ui.zoom.patch });   // (the bubble's tail points at a row you can see)
  ctx.card('emptyRow', { speaker: 'gran', title: fill(L.title, vars), text: fill(L.text, vars), row: r, variety: v, at: { ...rowCentre(r), y: 0.5 },
    choices: [{ id: 'plant', label: fill(L.yes, vars), sub: fill(L.yesSub, vars) }, { id: 'leave', label: L.no, sub: L.noSub }], defaultChoice: 'leave' });
}

// ------------------------------------------------------------ the planting year's mornings (patch dayStart, growing months)
function planMorning(s, ctx) {
  const b = bState(s), d = s.clock.day, g = s.story.goal, rows = rowsOf(s);
  // year 1, Jun 1: the window opens (a low-salience toast naming the next sowing day)
  if (y1(s) && s.unlocks.patch && !b.window && d >= JUN1 && d <= JUN1 + 2) {
    b.window = true;
    const next = rows.map((row, r) => [r, row.plan?.day]).filter(([, x]) => x != null).sort((a, c) => a[1] - c[1])[0];
    // (a toast waits for 12 s clear of the last lesson: the default 3 days lost it whenever a lesson spoke on Jun 1-2. It is
    // news until the first row goes in, or for windowWaitDays if nothing is planned.)
    ctx.moment({ id: 'window', kind: 'toast', maxWaitDays: next ? Math.max(1, next[1] - d - 1) : SH.windowWaitDays,
      toast: { text: next ? fill(LINES.window, { r: next[0] + 1, date: label(next[1]) }) : LINES.windowNone, icon: 'calendar' } });
  }
  // year 1, nothing planned and another lesson's goal came and went: the planting goal comes back (quietly) until Jul 10
  if (y1(s) && s.unlocks.patch && !g && d > JUN1 && d < D(P.window[1]) && !rows.some(isPlanned)) {
    ctx.goal('plan', d >= D(P.plantNudge) ? LINES.goalPlanLate : LINES.goalPlan, { kind: 'station', id: 'patch' }, { quiet: true, until: D(P.window[1]), lapse: false });
  }
  // three weeks into the window with nothing planned, the goal says what's at stake (re-aimed, no chime). (The goal as it
  // stands now: the line above may have just brought it back, so `g` can be null here.)
  const pg = s.story.goal;
  if (pg?.id === 'plan' && d >= D(P.plantNudge) && !rows.some(isPlanned) && pg.text !== LINES.goalPlanLate) ctx.goal('plan', LINES.goalPlanLate, pg.target, { quiet: true, until: pg.until, lapse: false });
  // year 1, the day after the window shut with no row ever planted: Gran says so (the goal let go quietly on its last day)
  if (y1(s) && s.unlocks.patch && !b.lapse && d > D(P.window[1]) && !rows.some(isPlanned)) { b.lapse = true; ctx.moment({ id: 'plan:lapse', kind: 'tally', say: LINES.lapsePlan }); }
  // years 2+: nothing planned by Jun 1, so Gran's usual fills the empty rows (rulings R13)
  if (s.clock.year > 1 && !b.lapse && d >= D(TB.y2Until) && s.story.beats['patch.seedLetter'] !== undefined && !allPlanned(s)) {
    b.lapse = true;
    plantGrans(s, ctx);
    ctx.goalLapse('plan2', false);
    ctx.moment({ id: `plan2:lapse:${s.clock.year}`, kind: 'tally', say: ['gran', LINES.letter.lapse] });
  }
  // the crates watch from the first plan (so the first sowing is a crate's first change: planned -> growing)
  if (s.patch.firstPlant != null || rows.some(isPlanned)) crateDay(s, ctx);
}

// ------------------------------------------------------------ the June fog job (rulings R8; FJ.on decides if it ships)
// A scheduled sowing morning in pea soup: sow anyway (a slow start: FJ.slowDays at FJ.slowMul) or wait a day (and if it is
// still pea soup tomorrow the row goes in anyway, slowly). At most FJ.perYear, never on Gran's lesson rows.
function fogJobDue(s, r) {
  const row = rowsOf(s)[r];
  return FJ.on && grows(s) && s.weather.f >= FJ.f && bState(s).fogJobs < FJ.perYear && !row.plan?.waited && !(y1(s) && TB.lesson[r]);
}
function fogJobCard(s, ctx, r) {
  const row = rowsOf(s)[r], ts = ghostTargets(s, row.plan.variety, s.clock.day), w = (ts[0] ?? 1) + 1;
  bState(s).fogJobs++;
  ctx.card('fogjob', { speaker: 'gran', title: `Pea soup on row ${r + 1}'s morning`, row: r, at: { ...rowCentre(r), y: 0.5 },
    text: `Row ${r + 1}'s due in, and the seed hates a cold bed.`,
    choices: [{ id: 'sow', label: 'Sow anyway', sub: `A slow start: W${w} gets a little less` }, { id: 'wait', label: 'Wait a day', sub: `W${w} slides a little later` }],
    defaultChoice: 'sow' });
}

// ------------------------------------------------------------ the module
function initPatch(s) {
  s.patch = {
    rows: Array.from({ length: P.rows }, (_, r) => freshRow(ownsRow(s, r))),
    moisture: P.moisture.start, wet: false, watered: 0, firstPlant: null,
    barn: {}, barnLots: [], hives: P.hives.start, freeHives: 0, honeyJars: 0, honeyReady: 0, honeyTotal: 0,
    fad: null, nextFad: null, shinies: [], volunteer: null, swarm: null, trucked: [], barnGoal: null, seq: 0,
    hist: {}, report: newReport(s.clock.year), lastReport: null,
    shelfLast: null, sown: {}, b: freshB(),             // [B] the crates as of this morning, this year's sowings, the lessons
  };
}

export default {
  id: 'patch',
  init(s) { initPatch(s); syncHives(s); },
  newYear(s) {
    const pa = s.patch;
    pa.lastReport = pa.report;
    pa.rows = pa.rows.map((_, r) => freshRow(ownsRow(s, r)));
    Object.assign(pa, { moisture: P.moisture.start, wet: false, firstPlant: null, volunteer: null, swarm: null, trucked: [], barnGoal: null, barnDay: null, hist: {},
      report: newReport(s.clock.year), barnLots: [], barn: {}, honeyReady: 0, honeyTotal: 0, watered: 0, shelfLast: null, sown: {}, b: freshB() });
    pa.shinies = [];
    pa.fad = pa.nextFad?.year === s.clock.year ? pa.nextFad : makeFad(s, s.clock.year);
    pa.nextFad = null;
    syncHives(s);
  },
  moments: MOMENTS,
  phase(s, ctx, from, to) {
    if (to === 'october') {
      for (const [r, row] of rowsOf(s).entries()) if (row.bugs > 0) { row.bugs = 0; ctx.emit({ type: 'patch/bugsCleared', row: r }); }
    }
    if (to === 'winter') {
      for (const [r, row] of rowsOf(s).entries()) { const R = s.patch.report.rows[r]; if (R) R.green = row.stock.green; }
      s.patch.nextFad = makeFad(s, s.clock.year + 1);
    }
  },
  dayStart(s, ctx) {
    if (!live(s)) return;
    const pa = s.patch, d = s.clock.day;
    syncHives(s);
    rowsOf(s).forEach((row, r) => { if (!row.open && ownsRow(s, r)) Object.assign(row, freshRow(true)); });
    // scheduled plantings happen in the morning: [B] each one a sowing day (a moment), or in pea soup the June fog job's question
    rowsOf(s).forEach((row, r) => {
      if (!row.plan || row.plan.day > d) return;
      if (fogJobDue(s, r)) { fogJobCard(s, ctx, r); return; }
      const v = row.plan.variety, waited = row.plan.waited;
      row.plan = null;
      if (plantNow(s, ctx, r, v)) { if (waited && s.weather.f >= FJ.f) row.slow = FJ.slowDays; sowing(s, ctx, r); }
      else ctx.emit({ type: 'toast', text: fill(LINES.toast.cantAfford, { row: r + 1 }), cls: 'bad', icon: 'coin' });
    });
    if (grows(s)) planMorning(s, ctx);
    honeyWeek(s, ctx);
    // trucked-in lots arrive at the barn door
    for (const t of pa.trucked.filter((x) => x.day <= d)) {
      pa.barnLots.push({ v: 'classic', n: t.n, age: 2, st: 'prime', sa: 0, tr: true });
      pa.report.trucked.n += t.n;
      ctx.emit({ type: 'patch/trucked', n: t.n });
      ctx.emit({ type: 'toast', text: fill(LINES.toast.trucked, { n: t.n }), cls: 'event', icon: 'barn' });
    }
    pa.trucked = pa.trucked.filter((x) => x.day > d);
    barnSummary(s);
    // the shiny window, the swarm that got away, the volunteer ripening, the fad news
    for (const sh of pa.shinies) if (sh.state === 'field' && d > sh.until) {
      shinyEnd(s, sh.id, 'lost');
      ctx.emit({ type: 'toast', text: fill(LINES.toast.shinyLost, { row: sh.row + 1 }), cls: 'warn' });
    }
    if (pa.swarm && !isActive(s, 'swarm')) { pa.swarm = null; ctx.emit({ type: 'toast', text: LINES.toast.swarmGone, cls: '' }); ctx.emit({ type: 'patch/swarm', state: 'gone' }); }
    if (pa.volunteer?.state === 'growing' && d >= D(CAT.volunteer_vine.ripe)) {
      pa.volunteer.state = 'ripe';
      ctx.emit({ type: 'toast', text: fill(LINES.toast.volunteerRipe, { spot: LINES.spots[pa.volunteer.spot] }), cls: 'event', icon: 'pumpkin' });
    }
    if (s.clock.year >= 3 && pa.fad && !pa.fad.revealed && d >= D(T.species.fads.reveal) && grows(s)) revealFad(s, ctx, false);
    // year 2: mildew is forced by Jul 25 so the lesson always lands
    if (s.clock.year === P.mildew.fromYear && !s.unlocks.mildew && grows(s) && d >= D(P.mildew.forceBy)) {
      let r = -1, k = -1;
      rowsOf(s).forEach((row, i) => { if (planted(row) && row.stage !== 'done' && VT[row.variety].mildew > k) { k = VT[row.variety].mildew; r = i; } });
      if (r >= 0 && !rowsOf(s)[r].mildew) infectMildew(s, ctx, r, rowsOf(s)[r]);
    }
    // the barn lesson's goal waits ("with no new dialogue") for the first fruit that would go soft before it sells, then
    // follows it day by day (the count grows as cohorts ripen); it lapses at the end of September (story.js)
    const cutDay = grows(s) || (s.clock.phase === 'october' && !isWeekend(d));
    if (cutDay && pa.barnGoal === 'waiting' && (!s.story.goal || STALE_GOALS.has(s.story.goal.id))) setBarnGoal(s, ctx);
    else if (cutDay && pa.barnGoal === 'set' && s.story.goal?.id === 'barn' && !setBarnGoal(s, ctx, true)) {
      ctx.goalLapse('barn', ['gran', LINES.gran.barnMissed]);
      pa.barnGoal = 'done';
    }
    // a bug or mildew goal whose row cleared some other way (it ripened, the ladybugs came) lets go
    const g = s.story.goal, gr = g?.target?.kind === 'row' ? rowsOf(s)[g.target.id] : null;
    if (g?.id === 'bugs' && !gr?.bugs) ctx.goalLapse('bugs');
    if (g?.id === 'milk' && !gr?.mildew) ctx.goalLapse('milk', false);
    // the forecast bar's past: what each row really was, day by day from Sep 1
    if (d >= SEP1) rowsOf(s).forEach((row, r) => { if (row.open) (pa.hist[r] ||= [])[d - SEP1] = [row.stock.green, row.stock.prime, row.stock.soft]; });
  },
  dayEnd(s, ctx) {
    if (!live(s)) return;
    beaCuts(s, ctx);
    const rows = rowsOf(s);
    rows.forEach((row, r) => {
      if (planted(row) && row.plantedDay <= s.clock.day) {
        const dry = !frozen(s) && s.patch.moisture < P.moisture.dry && growing(row);
        ageRow(s, row);
        growRow(s, ctx, r, row);
        if (dry) hurt(s, row, P.moisture.dryHealth, 'dry');
        if (grows(s)) bugsDay(s, ctx, r, row);
        mildewDay(s, ctx, r, row);
      } else if (row.fruit.length) ageRow(s, row);
      refresh(s, row);
    });
    moistureDay(s, ctx);
    honeyDay(s, ctx);
    barnDay(s);
  },
  actions: ACTIONS,
  cards: {
    shiny(s, card, choice, ctx) {
      const sh = s.patch.shinies.find((x) => x.id === card.data.shiny);
      if (!sh) return;
      const C = CAT.shiny;
      if (sh.row != null) { take(s, sh.row, sh.v, 1); rowsOf(s)[sh.row].shiny = null; }
      if (choice === 'sell') {
        const amt = Math.round(VT[sh.v].price * C.sellMul);
        sh.state = 'sold'; ctx.money(amt, 'shiny');
        ctx.emit({ type: 'toast', text: fill(LINES.toast.soldShiny, { amt: `$${amt}` }), cls: 'good', icon: 'coin' });
        ctx.emit({ type: 'coins', amount: amt, ...(sh.row != null ? rowCentre(sh.row) : PLACES.stand) });
        ctx.emit({ type: 'sound', name: 'ching', pitch: 1.2 });
      } else if (choice === 'display') {
        sh.state = 'display';
        ctx.emit({ type: 'toast', text: LINES.toast.displayShiny, cls: 'good', icon: 'sparkle' });
      } else {
        sh.state = 'auction'; sh.value = C.kinds[sh.kind];
        ctx.emit({ type: 'toast', text: LINES.toast.auctionShiny, cls: 'good', icon: 'scale' });
      }
      ctx.emit({ type: 'patch/shiny', id: sh.id, row: sh.row, kind: sh.kind, state: sh.state });
    },
    parking_lot_offer(s, card, choice, ctx) {
      const m = /^lots(\d)$/.exec(choice || '');
      if (m) orderTrucked(s, ctx, +m[1]);
    },
    // [B] the empty-row question (rulings R14): one tap sows it this morning; anything else leaves it resting
    emptyRow(s, card, choice, ctx) {
      const { row: r, variety: v } = card.data, row = rowsOf(s)[r];
      if (choice !== 'plant' || !row?.open || isPlanned(row) || !canAfford(s, VT[v].seed)) return;
      if (plantNow(s, ctx, r, v)) sowing(s, ctx, r, true);
    },
    // [B] the June fog job (rulings R8): sow into the cold (a slow start) or wait a day
    fogjob(s, card, choice, ctx) {
      const r = card.data.row, row = rowsOf(s)[r];
      if (!row?.plan) return;
      if (choice === 'wait') { row.plan = { ...row.plan, day: s.clock.day + 1, waited: true }; return; }
      const v = row.plan.variety;
      row.plan = null;
      if (plantNow(s, ctx, r, v)) { row.slow = FJ.slowDays; sowing(s, ctx, r, true); }
    },
  },
  beats: BEATS,
  events: EVENTS,
  goals: { honey: (s) => s.patch.honeyReady >= 1 },
  bot(s, ctx, P_) {
    if (!P_ || P_.name === 'idle' || P_.patch === false || !live(s)) return;   // patch: false leaves the field alone
    if (s.clock.phase === 'october' && isWeekend(s.clock.day) && s.clock.minute % 60) return;   // weekends: look in hourly
    const acts = [];
    // (year 1 from the Table's day, May 20; later years from a week before the window, as before the Table)
    if (s.unlocks.patch && grows(s) && s.clock.day >= (s.clock.year > 1 ? JUN1 - 7 : D(SY.plant))) acts.push(...botPlan(s, P_));
    acts.push(...botCare(s, P_));
    return acts;
  },
  summary(s) {
    const rep = s.patch.report, R = rep.rows.filter(Boolean);
    const sum = (k) => R.reduce((a, x) => a + (x[k] || 0), 0);
    return { patchSet: sum('set'), patchSold: sum('sold') + sum('soldSoft'), patchSoft: sum('soft'), patchRotten: sum('rotten'),
      patchClusters: sum('clusters'), shinies: s.patch.shinies.filter((x) => x.year === s.clock.year).length, honey: s.patch.honeyTotal };
  },
};
