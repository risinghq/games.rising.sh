// [D] Every tap answers (plan §3.4), and Grandpa's six notes from his old biscuit tin (plan §3.5 as cut by rulings R0, R15).
//
// What the player should feel at each step:
//   - Apr 1, the first poke: "the world answers me". The hives say why the bees stay in ("Nobody's home. Too damp out for
//     bees."), and once Hal has named the fog, they say it with her name. The lighthouse goes BWAAAMP; three blasts in five
//     seconds startle whoever is visiting (track A's after hook on world/poke reads res.burst).
//   - A locked thing: "not yet, but I know when". The rows before Gran plans October, the barn before September and the stand
//     before opening day each name the stop that opens them, with its date and a countdown from the Road (road(s)).
//   - Biscuit: a roll, a show-off, and on the third poke of a day a fetch; Biscuit digs in the bramble about once a week.
//   - Grandpa's notes: a voice from the family, each a few days before the thing it's about. They come with the dog's dig
//     (track A), on sowing days (with that day's sowing beat: the merge key `sow{day}`), in a bottle in the otter's kelp
//     (track A, or the kelp pin), from a fetch or a dig in the bramble, or, failing all those, on the porch by their date.
// Honesty: pokes and finds never draw from a stream (keyed hashes only), never pay, and never name a system the farm hasn't
// met (each line is checked against story.mentions / needsMet when it is picked).
//
// State: s.pokes = { counts: { [target]: { d, n } }, noticed: {}, finds: [], notes: [{ n, y, d, via, read }], pile: [n] (notes
//   waiting on the porch), digNext } (noticed and finds stay empty in Wave 1: the wider finds pool is Wave 2, rulings R1).
// Actions: world/poke { id, row?, burst? } -> { ok, text, fx, burst?, note? }; pokes/read -> reads the oldest note on the porch.
// Exports: find(s, ctx, source, { merge, mine }) (the seam: track A's dig and bottle, track B's sowing days), notesDue(s),
//   LINES, TARGETS.
// Out-events: { type: 'note', n, via, mine } when a note is read; { type: 'notePorch', n } when one is left on the porch.
import { T } from './tuning.js';
import { fresh, line, road, needsMet, mentions } from './story.js';
import { dayOf, isWeekend } from './calendar.js';
import { makeRng } from './rng.js';
import { hash32, own } from './util.js';
import { lockSuffix, type RoadStop } from './road-lines.js';
import { isActive } from './events.js';
import type { SimModule, State, ActionOf, Ctx, FreshEntry } from './types.js';

const TP = T.pokes;
const fail = (reason: string) => ({ ok: false, reason });

export const LINES = {
  // Grandpa's notes, in his hand (speaker 'grandpa': a note, never a face). Note 3 says what fog does to bees and never what
  // to do about it (rulings R5: the dawn card's only hint is "Count the bees").
  notes: [
    "If you're reading this, Biscuit found my biscuit tin. Good dog. Talk to her every morning. —G",
    'Rows drink before they droop. Water early. Dry days cost you October. —G',
    'A foggy dawn, the bees sleep in. So did I. Your Gran never once let me. —G',
    "Squash bugs come late July. Squish 'em young. Your Gran says paws. She's right. —G",
    "Late August she'll creak. Ease off the water and she heals. Or don't. I never did. —G",
    "'87. Vance Sr. won with 1,612. I came fourth. Never been prouder. Don't tell Vance. —G",
  ],
  // how each note got to you (a toast with the note); the dig's own words are track A's
  carrier: {
    dig: null,
    sowing: 'Biscuit ran the new row with a note from the biscuit tin in his mouth. Not a biscuit.',
    bottle: "There's a bottle in the kelp. It's Grandpa's handwriting.",
    fetch: 'Biscuit fetched a note from the biscuit tin instead of a stick. Good dog.',
    bramble: 'Biscuit dug in the bramble and came up with another of Grandpa\'s notes.',
    porch: 'Biscuit left a note from the biscuit tin by the stand. He looks very pleased with himself.',
    // note 1 on the porch: the tin itself still has to turn up (rulings R15: BISCUITS (NOT THE DOG), never "Grandpa's tin")
    porch1: 'Biscuit dug up an old tin marked BISCUITS (NOT THE DOG). Inside: a note from Grandpa.',
  },
};

// ------------------------------------------------------------ what each thing says
// A target is a list of entries { when?(s, x), lines, lock?, act?(s, ctx, x) }: the first whose when() holds answers. x is
// { n (pokes of it today), burst, row, f, pct }. lock names the Road stop that opens it (its date and countdown are added).
// act may take over the answer (Biscuit's fetch, a dig) and returns { text?, note? } or null to keep the line.
interface PokeX { n: number; burst: number; row: number; f: number; pct: number }
type PokeWhen = (s: State, x: PokeX) => boolean;
interface PokeFind { text: string; note: number }
interface PokeEntry {
  when?: PokeWhen; lines: readonly FreshEntry[]; lock?: LockId; burst?: boolean;
  act?: (s: State, ctx: Ctx) => PokeFind | null;
}
const met = (flag: string) => (s: State) => !!s.unlocks[flag];
const not = (fn: PokeWhen): PokeWhen => (s, x) => !fn(s, x);
const and = (...fns: PokeWhen[]): PokeWhen => (s, x) => fns.every((f) => f(s, x));
const foggy = (s: State) => s.weather.f >= 0.6;
const peaSoup = (s: State) => s.weather.f >= 0.82;
const growing = (s: State) => s.clock.phase === 'grow' || s.clock.phase === 'october';
const offSeason = (s: State) => ['halloween', 'winter'].includes(s.clock.phase);
const STAGE: Record<string, string> = { tilled: 'tilled and waiting', seeded: 'seeded. Shh', sprouts: 'sprouts, and very proud of them', vines: 'vines everywhere',
  flowers: 'in flower', green: 'green fruit, getting bigger', ripe: 'ripe', done: 'picked clean' };

export const TARGETS: Record<string, PokeEntry[]> = {
  hives: [
    // (insects are animals, not people: the bees hum, they don't sign notes)
    { when: offSeason, lines: ['Wrapped up for winter. A low hum inside: the bees are huddled up warm.'] },
    { when: (s) => !!s.weather.heat, lines: ['Bzzz. Even the bees are fanning themselves.', 'A hot buzz. The bees are doing the wing thing to keep cool.'] },
    { when: and(foggy, not(met('marlene'))), lines: ["Nobody's home. Too damp out for bees.", 'The hives are quiet. The bees are having a lie-in.',
      'A sleepy buzz from inside. Not today, thank you.', "Quiet hives. The bees don't fly in this murk."] },
    { when: foggy, lines: ["Nobody's home. Marlene's in, so the bees are too.", "Quiet hives. Marlene's at {pct}%. The bees won't fly in that.",
      'A sleepy buzz from inside. The bees are waiting Marlene out.', "The bees are in. Marlene's sulking, and so are they."] },
    { when: not(met('marlene')), lines: ['Bzzz. The bees are out and very busy.', 'Bzzz. A bee looked at you. You looked at the bee.',
      'Bzzz. Clear morning, busy bees. They keep a tight schedule.', "A bee lands on your sleeve, checks you're not a flower, leaves."] },
    { lines: ["Bzzz. The bees are out: Marlene's at {pct}%.", "Bzzz. Marlene's thin today, so the bees are working.",
      'Bzzz. Clear morning, busy bees. They keep a tight schedule.', "A bee lands on your sleeve, checks you're not a flower, leaves."] },
  ],
  lighthouse: [
    { when: (_s, x) => x.burst >= TP.burst.n, burst: true, lines: ['BWAAAMP, BWAAAMP, BWAAAMP. Somewhere, a skunk is very startled.',
      'Three blasts. The whole Cove looks up. A gull files a complaint.'] },
    { when: and(peaSoup, met('marlene')), lines: ['BWAAAMP. Out in the pea soup, something barks back.', 'BWAAAMP. Marlene swallows it whole and asks for seconds.'] },
    { lines: ['BWAAAMP.', 'BWAAAMP. A gull takes it personally.', 'BWAAAMP. The lighthouse says hello. Loudly.', 'BWAAAMP. Biscuit howls along. Badly.'] },
  ],
  scarecrow: [
    { when: (s: State) => isActive(s, 'swarm'), lines: ["He's wearing the swarm like a hat. He's thrilled."] },
    { lines: ['He guards the patch. From what, nobody knows.', "His hat spins. He'd like you to know he did that himself.",
      "He's stood there since '79. He is not tired. He is never tired.", "A crow sits on his arm. They're friends. It's complicated."] },
  ],
  boat: [
    { when: and(peaSoup, met('marlene')), lines: ["Toot? The boat can't see a thing either."] },
    { lines: ['Toot toot.', 'TOOT. Someone on the dock waves. It might be a gull.', 'Toot toot. The boat bobs politely.', 'Toot. A gull toots back. Show-off.',
      { t: "The boat toots back. Hal's cousin is out early.", when: met('marlene') }] },
  ],
  biscuit: [
    { when: (s, x) => x.n === TP.fetchOn && growing(s), act: fetch, lines: ['Biscuit fetched a stick. The best stick. He would like you to know that.',
      'Biscuit fetched Gran\'s slipper. Gran would like a word.', 'Biscuit fetched a pine cone and sneezed at it.', 'Biscuit fetched the same stick as yesterday. Loyal.'] },
    { when: (_s, x) => x.n === 2, lines: ['Biscuit rolls over twice. Show-off.'] },
    { when: (_s, x) => x.n > TP.fetchOn, lines: ['Biscuit is having the best day of his life.', 'Biscuit would like this to go on forever.', 'Biscuit flops over, done in. Happy.'] },
    { lines: ['Biscuit rolls over. Belly up, tail going.', 'Biscuit sneezes, delighted with himself.', 'Biscuit brings you nothing and is very proud of it.'] },
  ],
  farmer: [
    { lines: ['You. Mud on the knees. Very farmer.', 'You check your pockets: seed, string, half a biscuit.', 'You stretch. Something clicks. Farming!',
      'You wave at Biscuit. Biscuit waves back with his whole body.'] },
  ],
  // an open row before Gran's plan opens the patch (the Row sheet takes over after that)
  rowLocked: [
    { when: (s) => !!s.weather.rain, lock: 'plan', lines: ["Mud. Excellent mud. Gran's got plans for it."] },
    { lock: 'plan', lines: ["Good dirt. Gran's got plans for it.", 'Good dirt. Gran says it needs a rest. The dirt agrees.',
      'Good dirt. Biscuit dug a hole in it, then filled it in. Guilty.', 'Good dirt. It smells like spring and worms.'] },
  ],
  row: [{ lines: [{ t: 'Row {r}: {stage}.', when: met('patch') }, 'Good dirt.'] }],
  bramble: [
    { when: (s: State) => s.clock.phase === 'grow' && s.clock.day >= (s.pokes.digNext ?? 0), act: dig, lines: ['Biscuit dug in the bramble. He found... dirt. He\'s proud of it anyway.',
      'Biscuit dug in the bramble and found a very old boot. Just the one.', 'Biscuit dug in the bramble and came out wearing most of it.'] },
    { lines: ['Bramble. Gran says Grandpa buried things in there.', 'Bramble. It\'s winning. Gran says it always wins in the end.',
      'Bramble. Biscuit has opinions about the bramble.', 'Bramble. Something in there is humming. Probably bees. Probably.'] },
  ],
  barn: [
    { when: met('barn'), lines: ['Empty, echoey, and full of good intentions.'] },
    { when: and(peaSoup, met('marlene')), lock: 'barn', lines: ['The owls in the loft say hoo. Quietly. Marlene likes them.'] },
    { lock: 'barn', lines: ['Empty till September. Two owls rent the loft. Very quiet tenants.', "Empty and echoey. It smells of last year's hay.",
      'The door squeaks. The owls in the loft pretend not to hear.', 'Empty till September. Biscuit checks it daily, in case.'] },
  ],
  stand: [
    { when: offSeason, lines: ['Closed for the winter. Gran left a note: GONE CARVING.'] },
    { when: (s: State) => s.clock.phase === 'grow', lock: 'open', lines: ["Gran's stand. She polishes the till every morning anyway.",
      "Gran's stand. The bell's polished. The sign says CLOSED, nicely.", "Gran's stand. The wagon's been washed twice. Nobody asked.",
      "Gran's stand. The price board says ???. Gran likes a mystery."] },
    { when: (s: State) => s.clock.phase === 'october' && !isWeekend(s.clock.day), lines: ["Closed till Saturday. Gran's counting pumpkins in her sleep.",
      'Closed till Saturday. Gran is rehearsing her "Hello, welcome!".'] },
    { lines: ["Gran's stand. Open for business, and Gran means business."] },
  ],
  lot: [
    { lines: ["The car park. In October it's all cars. Right now it's all puddles.", 'The car park. A gull is parked in space one. Badly.',
      'The car park. Somebody painted the lines wonky. Gran says it was Grandpa.', 'The car park. Empty, apart from optimism.'] },
  ],
  scale: [
    { lines: ["The Q.S.C. Official Scale. It's waiting for October. It's very patient.", 'The scale says 0. Biscuit stood on it once and was devastated.'] },
  ],
  giant: [{ lines: ["Grandpa's corner. It's very quiet out of season."] }],
  corn: [
    { lines: ["Corn. Very tall. In October it's a maze. Right now it's just rude.", "The corn whispers. It's mostly gossip.",
      'Something rustled in the corn. Probably a possum. Possibly two.', 'Corn. Taller than you. Taller than Gran. Taller than the Mayor, who minds.'] },
  ],
  dock: [
    { lines: ['The Mayor\'s dock. He waits here on big days. Today is a medium day.', "The dock groans. It's not a complaint. It's a dock.",
      'A gull is guarding the dock. Nobody hired him.', 'The dock. The Mayor says it has a view. The view is mostly gulls.'] },
  ],
  sea: [
    { when: (s: State) => isActive(s, 'whale'), lines: ['Somebody big is out there. Showing off.'] },
    { when: (s: State) => isActive(s, 'kelp'), lines: ["There's kelp on the beach. The sea's been tidying."] },
    { when: and(peaSoup, met('marlene')), lines: ["The sea's in there somewhere. Marlene's sitting on it."] },
    { lines: ['Cold. Lovely. Cold.', 'The sea says shhh. It says it all day.', 'A wave comes in, looks around, goes back out.',
      'Somewhere out there, a seal is napping. Probably.'] },
  ],
  cottage: [
    { when: not(met('marlene')), lines: ["The keeper's cottage. The kettle's always on. Nobody knows whose kettle.",
      "The keeper's cottage. A radio's playing up there. Very loudly.", "The keeper's cottage. Somebody up there howls at sunrise.", "The keeper's cottage. The mat says GO AWAY, very politely."] },
    { lines: ["Hal's cottage. He reads Marlene off his kitchen window every morning.", "Hal's cottage. The radio mast doubles as a washing line.",
      "Hal's cottage. You can hear him practising his Awooo.", "Hal's cottage. The mat says GO AWAY, very politely."] },
  ],
  sign: [
    { when: (s: State) => !!s.giant?.name, lines: ['{name}. The sign is very proud of it.', '{name}. Biscuit sits by the sign like he painted it.',
      '{name}, says the sign. The sign is optimistic.', '{name}. Biscuit tried to lick the paint. The paint won.'] },
    { lines: ["Grandpa's corner, says the sign. It's saving room for her name.", "A sign with nothing much to say yet. It's waiting for a name.",
      'The sign. Grandpa painted the first one. Gran painted over it. Twice.', 'A sign on a post. It has been practising looking proud.'] },
  ],
};
// zone ids that aren't their target's name
const ALIAS: Record<string, string> = { weighmaster: 'scale' };

// Which table answers a tap on this thing now: a row may be bramble, locked or the patch's own.
function targetOf(s: State, id: string, a: ActionOf<'world/poke'>) {
  if (id !== 'row') return own(ALIAS, id) || id;
  const row = s.patch?.rows?.[(a.row ?? 0) | 0];
  if (!row?.open) return 'bramble';
  return s.unlocks.patch ? 'row' : 'rowLocked';
}
// The Road stop that opens a locked thing.
const LOCKS = {
  plan: (st: RoadStop) => ['patch.plant', 'patch.table', 'patch.seedLetter'].includes(st.id),
  barn: (st: RoadStop) => st.id === 'patch.barn',
  open: (st: RoadStop) => st.kind === 'weekend',
};
type LockId = keyof typeof LOCKS;
function stopFor(s: State, ctx: Ctx, lock: LockId) {
  const d = s.clock.day;
  return road(s, ctx).find((st) => !st.done && st.day != null && st.day >= d && LOCKS[lock](st)) || null;
}
// Every line is checked against what the farm has met (needs lint, plan §2.1): its index stays put so fresh() remembers it.
const gate = (lines: readonly FreshEntry[]): FreshEntry[] => lines.map((l) => {
  const o: { t: string; when?: (s: State) => boolean } = typeof l === 'string' ? { t: l } : l, need = mentions(o.t);
  return { t: o.t, when: (s: State) => (!o.when || o.when(s)) && needsMet(s, need) };
});
const GATED = new WeakMap<PokeEntry, FreshEntry[]>();
const gated = (e: PokeEntry) => { let g = GATED.get(e); if (!g) GATED.set(e, (g = gate(e.lines))); return g; };

function poke(s: State, ctx: Ctx, a: ActionOf<'world/poke'>) {
  const id = String(a.id ?? ''), key = targetOf(s, id, a), table = own(TARGETS, key);
  if (!table) return fail('nothing to poke there');
  const P = s.pokes, d = s.clock.day, prev = P.counts[key], c = prev?.d === d ? prev : { d, n: 0 };
  P.counts[key] = c;
  c.n++;
  const f = s.weather?.f ?? 0.5, row = (a.row ?? 0) | 0;
  const x: PokeX = { n: c.n, burst: (a.burst ?? 0) | 0, row, f, pct: Math.round(f * 100) };
  const k = table.findIndex((e) => !e.when || e.when(s, x));
  const e = table[k < 0 ? table.length - 1 : k];
  if (!e) return fail('nothing to poke there');
  // keyed dice: a poke never moves a stream (the same seed, day, thing and count always says the same)
  const rng = makeRng(hash32(s.seed, s.clock.year, d, 'poke', key, c.n));
  const stage = s.patch?.rows?.[row]?.stage;
  const vars = { pct: x.pct, r: row + 1, stage: (stage && own(STAGE, stage)) || 'good dirt' };
  const pick = fresh(s, rng, `poke:${key}:${k}`, gated(e));
  let text = pick != null ? line(s, pick, vars) : '';
  const out = e.act?.(s, ctx) || null;
  if (out?.text) text = out.text;
  const first = e.lines[0];
  if (!text && first !== undefined) text = line(s, typeof first === 'string' ? first : first.t, vars);
  if (e.lock) text += lockSuffix(stopFor(s, ctx, e.lock), d);
  return { ok: true, id: key, text, fx: e.burst ? 'burst' : out?.note ? 'note' : null, burst: !!e.burst, note: out?.note ?? null };
}

// Biscuit's third poke of the day: a fetch. A note when one is due by fetch (note 6), else a stick (the line).
function fetch(s: State, ctx: Ctx): PokeFind | null {
  const note = find(s, ctx, 'fetch', { mine: true });
  return note ? { text: LINES.carrier.fetch, note: note.n } : null;
}
// Biscuit digs in the bramble about once a week: a note when one is due by a dig, else whatever he finds (the line).
function dig(s: State, ctx: Ctx): PokeFind | null {
  s.pokes.digNext = s.clock.day + TP.digEvery;
  const note = find(s, ctx, 'bramble', { mine: true });
  return note ? { text: LINES.carrier.bramble, note: note.n } : null;
}

// ------------------------------------------------------------ Grandpa's notes
const NOTE_BY = TP.notes.map((n) => dayOf(n.by));
const sown = (s: State) => (s.patch?.rows || []).filter((r) => r.open && r.plantedDay != null).length;
const foundN = (s: State, n: number) => s.pokes.notes.some((x) => x.n === n);
// The next note to find (they come in order) and whether this source may carry it today.
function nextNote(s: State, source: string) {
  const i = TP.notes.findIndex((_, k) => !foundN(s, k + 1));
  if (i < 0) return -1;
  const N = TP.notes[i];
  if (!N) return -1;
  if (source !== 'porch' && !N.via.includes(source)) return -1;
  if (N.from && s.clock.day < dayOf(N.from)) return -1;
  if (N.rows && source !== 'porch' && sown(s) < N.rows) return -1;
  return i;
}
// A find for this source ('dig' | 'sowing' | 'fetch' | 'bramble' | 'pouch' | 'bottle' | 'porch'), or null. In Wave 1 the
// only finds are Grandpa's six notes, in year 1, one a day, in order. The note's moment is queued here: { merge } makes it
// one beat with the caller's own moment that day (a sowing day: `sow{day}`), { mine } shows it at once (it answers the
// player's own tap: the dig's ✦, a fetch). Returns { n, line, via } so the caller can mention it, never say it again.
export function find(s: State, ctx: Ctx, source: string, { merge = null, mine = false }: { merge?: string | null; mine?: boolean } = {}) {
  const P = s.pokes, d = s.clock.day, y = s.clock.year;
  if (y !== 1 || s.clock.phase !== 'grow' || P.notes.some((x) => x.y === y && x.d === d)) return null;
  const i = nextNote(s, source);
  if (i < 0) return null;
  const n = i + 1, said = LINES.notes[i];
  if (said === undefined) return null;
  P.notes.push({ n, y, d, via: source, read: null });
  const toast = source === 'porch' && n === 1 ? LINES.carrier.porch1 : own(LINES.carrier, source) ?? null;
  // a porch note waits a little for a quiet moment, then sits on the porch until it's read (pokes/read)
  const wait = source === 'porch' ? TP.porchWait : T.moments.maxWaitDays;
  ctx.moment({ id: `note:${n}`, kind: 'note', handler: 'note', mine, merge, maxWaitDays: wait,
    say: ['grandpa', said], toast: toast ? { text: toast, icon: 'scrapbook' } : null, data: { n, via: source, mine } });
  return { n, line: said, via: source };
}
// Which notes are still to come, and by when (tests, the debug overlay).
export const notesDue = (s: State) => TP.notes.map((_N, i) => ({ n: i + 1, by: NOTE_BY[i], found: foundN(s, i + 1) }));

function morning(s: State, ctx: Ctx) {
  if (s.clock.year !== 1 || s.clock.phase !== 'grow') return;
  const d = s.clock.day;
  // a sowing morning carries the next note (track B's sowing moment carries it too: find() gives it once)
  if ((s.patch?.rows || []).some((r) => r.open && r.plantedDay === d)) find(s, ctx, 'sowing', { merge: `sow${d}` });
  // failing every carrier, Biscuit leaves it by the stand on its morning
  const i = TP.notes.findIndex((_, k) => !foundN(s, k + 1));
  const by = NOTE_BY[i];
  if (by !== undefined && d >= by) find(s, ctx, 'porch');
}

export default {
  id: 'pokes',
  init(s: State) { s.pokes = { counts: {}, noticed: {}, finds: [], notes: [], pile: [], digNext: 0 }; },
  newYear(s: State) { s.pokes.counts = {}; s.pokes.digNext = 0; },
  dayStart(s, ctx) { morning(s, ctx); },
  actions: {
    'world/poke': (s, a, ctx) => poke(s, ctx, a),
    // a note left by the stand: read it now (it answers the player's own tap)
    'pokes/read': (s, _a, ctx) => {
      const P = s.pokes, n = P.pile[0], said = n == null ? undefined : LINES.notes[n - 1];
      if (n == null || said === undefined) return fail('nothing on the porch');
      P.pile = P.pile.slice(1);
      // how it got there, since its own moment never showed: for note 1 that's the first the player hears of the tin
      const toast = { text: n === 1 ? LINES.carrier.porch1 : LINES.carrier.porch, icon: 'scrapbook' };
      ctx.moment({ id: `note:${n}:read`, kind: 'note', handler: 'note', mine: true, say: ['grandpa', said], toast, data: { n, via: 'porch', mine: true } });
      return { ok: true, n };
    },
  },
  after: {
    // the scripted kelp's pin (year 1, Aug 18) until track A's otter brings it: a bottle in the kelp
    'events/tap': (s, a, _res, ctx) => { if (a.id === 'kelp') find(s, ctx, 'bottle', { mine: true }); },
    // "Plant now": the row is in, and a note may ride it
    'patch/plant': (s, a, _res, ctx) => { if (s.patch?.rows?.[a.row]?.plantedDay === s.clock.day) find(s, ctx, 'sowing', { mine: true }); },
  },
  moments: {
    note: {
      run(s, ctx, m) {
        const n = m.data.n;
        if (!n) return;
        const x = s.pokes.notes.find((k) => k.n === n && k.read == null);
        if (x) x.read = s.clock.day;
        ctx.emit({ type: 'note', n, via: m.data.via, mine: m.data.mine });
      },
      // no quiet moment came for it: it waits on the porch (by the stand) until it's read, never lost
      drop(s, ctx, m) {
        const n = m.data.n;
        if (!n) return;
        if (!s.pokes.pile.includes(n)) s.pokes.pile = [...s.pokes.pile, n];
        ctx.emit({ type: 'notePorch', n });
      },
    },
  },
} satisfies SimModule;
