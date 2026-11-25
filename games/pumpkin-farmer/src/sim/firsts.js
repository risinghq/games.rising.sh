// [D] Firsts: the farm's good news gets a moment (plan §3.7, rulings R0, R2, R12). SHE'S UP, the first row in and its
// sprouts, ALL ROWS IN, SHE TOOK!, MEET {NAME}, the first orange one, and the weight ladder ("She outweighs the dog") each
// get a banner (ui/firsts.js through api.payoff) with the character's line inside it, once per career.
//
// What the player should feel at each step:
//   - SHE'S UP (germination, ~Apr 4): "aww". The seedling is drawn in her pot from now on (render/giant.js).
//   - The first row in: "my plan is happening". On a sowing morning it is one beat with that day's sowing (track B) and
//     Grandpa's note: the shared merge key `sow{day}`. Then SPROUTS!: "it's growing!", as the answer to the first Water on
//     a row that's up (year 1: the row comes up in the shadow of Hal's watering lesson, where a queued moment is let go).
//   - ALL ROWS IN: "October's all in the ground."
//   - SHE TOOK! and MEET {NAME}: the year's two loved moments can't be missed. They answer the player's own card, so they
//     show at once (mine), they are BIG (Skip stops for them), and the sign paints her name stroke by stroke.
//   - The weight ladder: measuring finds good news. A rung fires only on a tape (it reads the tape's estimate, est, never the
//     hidden weight), only the highest rung that tape crossed fires (the ones it skipped are filed silently), and each rung
//     once in a career: P(>= 300) is near certain in year 1, a quarter ton most years, 1,000 lb a rare treat, 1,147 (Grandpa's
//     mark) a career goal (tests/balance/moments.test.js).
// Spacing: a First that answers the player's own tap or card shows at once (mine); any other waits for a quiet window in the
// moments queue (12 s clear of lessons and other moments) for up to T.firsts.waitDays, and past that it is filed silently.
//
// State: s.firsts = { career: { [id]: { y, d } }, year: { [id]: d } } (year resets every Apr 1); stamps in s.story.stamps.
// Exports: mark(s, ctx, id, vars) (the seam: track B marks 'planned', track C 'moved'), tape(s, ctx, { mine, est }) (track C's
//   Sunday tape and the Vine Crawl fire the ladder through it), FIRSTS (the table), firstText(s, id, vars).
// Out-events: { type: 'first', id, big, mine, title, sub, speaker, line, stamp, glide, at } when one shows (Skip stops on a
//   BIG one: game.js stopsSkip); { type: 'firstFiled', id } when one was filed without a banner.
import { T } from './tuning.js';
import { stamp, line } from './story.js';
import { WEIGHOFF } from './calendar.js';
import { PLACES, ROWS, rowZ } from './layout.js';
import { lerp } from './util.js';

const TF = T.firsts;
const GIANT = { x: PLACES.giant.x + 0.3, z: PLACES.giant.z + 0.4, zoom: 1.6 };
const rowAt = (r) => ({ x: (ROWS.x0 + ROWS.x1) / 2, z: rowZ(r ?? 0), zoom: T.ui.zoom.patch });
const VARIETY = { classic: 'Classic', mini: 'Mini', white: 'White', warty: 'Warty', cinderella: 'Cinderella', blue: 'Blue' };

// The table. title: <= 16 characters at 28 px (rulings R12: the joke goes in the sub); line: the character's, inside the
// banner (<= 110 characters, in their voice). stampOnly: recorded with no banner. big: Skip stops for it.
export const FIRSTS = {
  up: { mine: true, stamp: 'patch', at: 'pot', title: "SHE'S UP", sub: "Grandpa's seed has two leaves.",
    speaker: 'gran', line: 'Two leaves. Already showing off. She gets that from your grandpa.' },
  moved: { stampOnly: true },                    // track C's Moving Day: the hoop house is the moment
  planned: { mine: true, stamp: 'calendar', at: 'patch', title: 'OCTOBER PLANNED', sub: 'Every row has a weekend to fill.',
    speaker: 'gran', line: "Well. Grandpa never planned that tidy. Don't tell him I said so.", lineIf: 'good' },
  rowIn: { stamp: 'patch', at: 'row', title: 'FIRST ROW IN', sub: 'Row {r} is sown with {Variety}s.',
    speaker: 'gran', line: "First row's in. Don't stare at it, sweet pea. It gets shy." },
  sprouts: { stamp: 'patch', at: 'row', title: 'SPROUTS!', sub: 'Row {r} is up and green.',
    speaker: 'gran', line: 'Green! Your grandpa counted them out loud. Every year. Every one.' },
  allIn: { stamp: 'patch', at: 'patch', title: 'ALL ROWS IN', sub: "October's in the ground.",
    speaker: 'gran', line: "All in. Now we wait, sweet pea. Waiting's the hard part. Ask me how I know." },
  took: { mine: true, big: true, stamp: 'giant', at: 'giant', title: 'SHE TOOK!', sub: 'Day one. {n} days to the weigh-off.',
    speaker: 'moss', line: 'She took. She took! I knew she would... I knew... zzz.' },
  named: { mine: true, big: true, stamp: 'giant', at: 'sign', title: 'MEET {NAME}', sub: "Her name's on the sign now.",
    speaker: 'gran', line: '{name}. Suits her. Your grandpa named his after the Queen. Then the other Queen.' },
  ripe: { stamp: 'pumpkin', at: 'row', title: 'FIRST ORANGE ONE', sub: 'Row {r} is turning.',
    speaker: 'gran', line: "First orange one. Don't pick it. Fine. Pick it a little." },
  // the weight ladder (T.firsts.ladder): fired by a tape, the highest rung it crossed
  lb60: { stamp: 'scale', at: 'giant', title: '60 POUNDS', sub: 'She outweighs the dog.',
    speaker: 'gran', line: "She outweighs the dog. Don't tell the dog." },
  lb100: { big: true, stamp: 'scale', at: 'giant', title: 'CENTURY!', sub: '100 lb on the tape.',
    speaker: 'edna', line: "CENTURY FOR {NAME}. ROOKIE 'NOT SURPRISED'. Correction: rookie very surprised." },
  lb300: { stamp: 'scale', at: 'giant', title: '300 POUNDS', sub: "Heavier than Gran's piano.",
    speaker: 'gran', line: 'Heavier than my piano. The piano had it coming.' },
  lb500: { big: true, stamp: 'scale', at: 'giant', title: 'A QUARTER TON', sub: '500 lb on the tape.',
    speaker: 'hal', line: "A quarter ton out at {farm}! That's a lot of pie, Cove! Awooo!" },
  lb750: { stamp: 'scale', at: 'giant', title: '750 POUNDS', sub: "Heavier than the Mayor's statue.",
    speaker: 'mayor', line: 'Heavier than my statue! The statue is small. Still! A proclamation is officially coming.' },
  lb1000: { big: true, stamp: 'scale', at: 'giant', title: 'ONE THOUSAND', sub: '1,000 lb on the tape.',
    speaker: 'moss', line: "A thousand... I've seen four. Five now. Six if you count the dream... zzz." },
  lb1147: { big: true, stamp: 'star', at: 'giant', title: "GRANDPA'S MARK", sub: "1,147 lb. His best, matched.",
    speaker: 'gran', line: "Eleven forty-seven. Your grandpa would be unbearable about this. I'm allowed to be." },
};

// The banner's words for a First, filled from the farm now (the name on the sign, the farm's name).
export function firstText(s, id, vars = {}) {
  const f = FIRSTS[id];
  if (!f || f.stampOnly) return null;
  const v = { ...vars, Variety: VARIETY[vars.variety] || 'Classic' };
  let title = line(s, f.title, v), sub = f.sub ? line(s, f.sub, v) : null;
  // MEET {NAME}: when that won't fit a phone (rulings R12), the name alone is the title, or for a very long one the sub
  if (title.length > T.ui.banner.titleMax) {
    const name = line(s, '{NAME}', v);
    [title, sub] = name.length <= T.ui.banner.titleMax ? [name, "Meet her. Her name's on the sign now."] : ['MEET HER', line(s, "{name}. Her name's on the sign now.", v)];
  }
  const say = f.lineIf && !vars[f.lineIf] ? null : line(s, f.line, v);
  return { title, sub, speaker: say ? f.speaker : null, line: say };
}
function glideOf(f, vars) {
  if (f.at === 'giant') return GIANT;
  if (f.at === 'pot') return { x: PLACES.giant.x, z: PLACES.giant.z, zoom: 2.8 };   // close enough to see two leaves
  // her and her name, close enough to read the sign as it paints (a phone at 2.8 shows a smudge)
  if (f.at === 'sign') return { x: lerp(PLACES.giant.x, PLACES.sign.x, 0.7), z: lerp(PLACES.giant.z, PLACES.sign.z, 0.7), zoom: 3.6 };
  if (f.at === 'row') return rowAt(vars.r != null ? vars.r - 1 : 0);
  if (f.at === 'patch') return { x: -1.5, z: 3, zoom: T.ui.zoom.patch };
  return null;
}

// Mark a first. Returns true the first time in the career (it is recorded at once, shown when its moment comes).
// vars: { mine?, merge?, silent? (record and stamp, no banner), ...template fields }. Plain JSON only: a waiting moment lives
// in the save.
export function mark(s, ctx, id, vars = {}) {
  const F = s.firsts, y = s.clock.year, d = s.clock.day;
  if (F.year[id] === undefined) F.year[id] = d;
  if (F.career[id]) return false;
  F.career[id] = { y, d };
  stamp(s, ctx, id);
  const f = FIRSTS[id];
  if (!f || f.stampOnly || vars.silent) return true;
  const { mine = !!f.mine, merge = null, silent, ...rest } = vars;
  ctx.moment({ id: `first:${id}`, kind: 'first', handler: 'first', mine, merge, maxWaitDays: TF.waitDays, stop: !!f.big,
    data: { first: id, mine, vars: rest } });
  return true;
}

// A tape (the player's Measure, track C's Sunday tape or the Vine Crawl): the highest ladder rung the estimate has crossed
// fires; the rungs it skipped are filed silently. Reads the tape's estimate only. Returns the rung's id, or null.
export function tape(s, ctx, { mine = false, est = s.giant?.est } = {}) {
  if (!(est > 0)) return null;
  const crossed = TF.ladder.filter(([lb, id]) => est >= lb && !s.firsts.career[id]).map(([, id]) => id);
  if (!crossed.length) return null;
  const top = crossed.at(-1);
  for (const id of crossed.slice(0, -1)) mark(s, ctx, id, { silent: true });
  mark(s, ctx, top, { mine, lb: Math.round(est) });
  return top;
}

// ------------------------------------------------------------ what the farm did since this morning
const grows = (s) => s.clock.phase === 'grow';
// rows that went in today (a scheduled row lands in patch.dayStart; "plant now" lands in its action)
function rowsIn(s, ctx, mine) {
  const d = s.clock.day, rows = s.patch?.rows || [], C = s.firsts.career;
  const today = rows.map((r, i) => [r, i]).filter(([r]) => r.open && r.plantedDay === d);
  if (!today.length) return;
  const merge = `sow${d}`;
  if (!C.rowIn) { const [r, i] = today[0]; mark(s, ctx, 'rowIn', { mine, merge, r: i + 1, variety: r.variety }); }
  const open = rows.filter((r) => r.open);
  if (!C.allIn && open.length >= 2 && open.every((r) => r.plantedDay != null && !r.plan)) mark(s, ctx, 'allIn', { mine, merge });
}
// A First that happened a while ago (a save from before this build, a long close-up) is filed without a banner: good news
// is only news on the day.
const fresh = (s, day) => day != null && s.clock.day - day <= TF.waitDays;
function morning(s, ctx) {
  const C = s.firsts.career, g = s.giant, d = s.clock.day;
  if (!C.up && g && g.germDay != null && d >= g.germDay && !['tin', 'started'].includes(g.stage)) mark(s, ctx, 'up', { mine: true, silent: !fresh(s, g.germDay) });
  rowsIn(s, ctx, false);
  const rows = s.patch?.rows || [];
  if (!C.sprouts) {
    const i = rows.findIndex((r) => r.open && r.plantedDay != null && r.stage !== 'seeded' && r.stage !== 'tilled');
    // In year 1 the first row comes up just as Hal's watering lesson does (it is keyed to the first sowing), and a moment
    // queued then is let go in the lesson's shadow. So SPROUTS! is the answer to the player's first Water while a row is
    // in sprouts (the after hook below: the rows perk up, and they're green); a row that grows past sprouts unwatered
    // files it quietly.
    const forWater = i >= 0 && s.clock.year === 1 && rows[i].stage === 'sprouts';
    if (i >= 0 && !forWater) mark(s, ctx, 'sprouts', { merge: `sow${d}`, r: i + 1, silent: rows[i].stage !== 'sprouts' });
  }
  if (!C.ripe) {
    const i = rows.findIndex((r) => r.open && r.ripeDay != null && r.ripeDay <= d);
    if (i >= 0) mark(s, ctx, 'ripe', { r: i + 1, variety: rows[i].variety, silent: !fresh(s, rows[i].ripeDay) });
  }
  // the giant's set or naming by some other way than the player's card. A set that comes on its own (the flower took on
  // the morning after the player's last failed dawn) is still the payoff of those dawns, and BIG: at once, never filed.
  if (!C.took && g?.setDay != null) mark(s, ctx, 'took', { mine: fresh(s, g.setDay), n: Math.max(0, WEIGHOFF - d), silent: !fresh(s, g.setDay) });
  if (!C.named && g?.name && g.stage === 'fruit') mark(s, ctx, 'named', { mine: false, silent: !fresh(s, g.cullDay ?? d) });
}

export default {
  id: 'firsts',
  init(s) { s.firsts = { career: {}, year: {} }; },
  newYear(s) { s.firsts.year = {}; },
  dayStart(s, ctx) { if (grows(s)) morning(s, ctx); },
  after: {
    // SHE TOOK! and MEET {NAME} answer the player's own card: at once, BIG
    'card/answer': (s, a, res, ctx) => {
      const g = s.giant, C = s.firsts.career, d = s.clock.day;
      if (!g) return;
      if (!C.took && g.setDay === d) mark(s, ctx, 'took', { mine: true, n: Math.max(0, WEIGHOFF - d) });
      if (!C.named && g.name && g.stage === 'fruit') mark(s, ctx, 'named', { mine: true });
    },
    // the player's own tape: the ladder answers at once
    'giant/measure': (s, a, res, ctx) => { tape(s, ctx, { mine: true, est: (a.plot === 2 ? s.giant.plot2 : s.giant)?.est }); },
    // "Plant now" (not scheduled): the row is in, right now
    'patch/plant': (s, a, res, ctx) => { if (grows(s)) rowsIn(s, ctx, true); },
    // the first Water on a row that's just up: SPROUTS! answers it (the rows perk up, and they're green)
    'patch/water': (s, a, res, ctx) => {
      if (!grows(s) || s.firsts.career.sprouts) return;
      const i = (s.patch?.rows || []).findIndex((r) => r.open && r.plantedDay != null && r.stage === 'sprouts');
      if (i >= 0) mark(s, ctx, 'sprouts', { mine: true, r: i + 1 });
    },
  },
  moments: {
    first: {
      run(s, ctx, m) {
        const { first: id, vars = {} } = m.data || {}, f = FIRSTS[id], t = firstText(s, id, vars);
        if (!t) return;
        ctx.emit({ type: 'first', id, big: !!f.big, mine: !!m.data.mine, ...t, stamp: f.stamp || 'star', glide: glideOf(f, vars), at: f.at, row: vars.r ?? null });
      },
      drop(s, ctx, m) { ctx.emit({ type: 'firstFiled', id: m.data?.first }); },
    },
  },
};
