// Saves: the state is plain JSON (RNG streams included), so a save resumes exactly where it left off.
// Bump SAVE_VERSION when the shape changes and add a migration from the previous version.
import { hash32, round3 } from './util.js';
import { label, dayOf, realSeconds } from './calendar.js';
import { T, findSpecies } from './tuning.js';
import type { State } from './types.js';

export const SAVE_VERSION = 5;
export const SAVE_KEY = 'qsc.save.v1';          // the app's one localStorage slot (photos live in qsc.photo.<year>)

// MIGRATIONS[v] upgrades a v save to v + 1 in place.
const MIGRATIONS: Record<number, (s: State) => void> = {
  // v2: weekend days run 6 ticks a second and walkers move speed / ticksPerSecond a tick (design §2, §7 motion): a
  // family saved mid-weekend keeps its old stride unless it is rescaled; the hay-fort and near-the-giant fields are new
  1(s: State) {
    for (const f of s.season?.families || []) {
      f.spd = round3((T.season.walk * (findSpecies(f.species)?.walk ?? 1)) / T.calendar.weekend.ticksPerSecond);
      f.fort ??= 0; f.near ??= false;
    }
  },
  // v3 (motion round 2): every car is a sim object on a one-way road (sim/traffic.js). A family saved riding in on the old
  // drawn-only car steps out at the drop-off; one saved on its way out (or riding home) was as good as gone: it goes, and
  // its parking space with it.
  2(s: State) {
    const se = s.season;
    if (!se) return;
    se.cars ??= []; se.carSeq ??= 0; se.fogSeq ??= 0;
    const P = se.parking;
    se.families = (se.families || []).filter((f) => {
      f.kerb ??= false;
      const car: unknown = f.car;                   // v2 marked a family riding in with car 'in'
      if (f.state === 'car' && car === 'in') {
        Object.assign(f, { state: 'in', car: null, x: -0.6, z: -3.3, path: [[-0.6, -2]], pi: 0, target: { x: -0.6, z: -2 } });
        return true;
      }
      if (f.state !== 'out' && f.state !== 'car') return true;
      if (f.state === 'out' && P) { if (f.park === 'beach') P.beach = Math.max(0, P.beach - 1); else if (f.park === 'lot') P.main = Math.max(0, P.main - 1); }
      se.queue = (se.queue || []).filter((id) => id !== f.id);
      return false;
    });
    if (P) P.used = P.main + P.beach;
  },
  // v4 (the growing year, plan §7.2): every new field from every track, defaulted here so a track that fills it never needs a
  // bump of its own. A mid-year save must not replay a lesson whose date the new calendar moved behind it: the re-cut
  // beats' replacements are marked fired once their date has passed (giant.water and giant.measure keep their own marks).
  3(s: State) {
    const st = s.story;
    st.moments ??= []; st.receipts ??= []; st.receiptDay ??= null; st.said ??= {}; st.stamps ??= {}; st.alerts ??= {};
    s.clock.hands = null; s.clock.skipTo ??= null;
    if (s.events) { s.events.lastDelight1x ??= -1e9; s.events.delights ??= []; s.events.slots ??= {}; }
    s.mischief ??= { pin: null, visit: null, met: {}, coats: [], clips: [], skunkedUntil: 0, iou: 0, look: null, porch: null,
      pamela: { visit: null, goatDays: {}, escapes: 0, fullUntil: 0, shawl: false } };   // [A] look, porch: track A's two late fields
    s.pokes ??= { counts: {}, noticed: {}, finds: [], notes: [], pile: [], digNext: 0 };
    s.firsts ??= { career: {}, year: {} };
    if (s.patch) {
      s.patch.shelfLast ??= null; s.patch.sown ??= {};
      for (const r of s.patch.rows || []) { r.lost ??= { dry: 0, fog: 0 }; r.shieldUntil ??= 0; }
    }
    if (s.giant) { s.giant.moving ??= null; s.giant.notebook ??= { choices: [] }; s.giant.notebook.choices ??= []; }
    s.crawl ??= { year: 0, step: null, guesses: [], pick: null, review: null, ribbons: [], gags: [] };
    const y = s.clock.year, mid = s.clock.phase !== 'newgame';
    for (const [id, date, year, behind] of REDATED) {
      if (st.beats[id] !== undefined || !mid || y < year) continue;
      // past: the year it belongs to is over (a year-1 lesson in a later year), or this year's season is
      const past = (year === 1 && y > 1) || s.clock.phase !== 'grow';
      if (past || behind(s)) st.beats[id] = realSeconds(0, dayOf(date));
    }
    if (mid) fileBehind(s);
  },
  // v5: the Giant's receipt lines leave fresh()'s memory for their own list
  4(s: State) {
    const said: Record<string, unknown> = s.story.said, old = said['giant.receipts'];
    s.story.heard = Array.isArray(old) ? old.filter(isHeard) : [];
    delete said['giant.receipts'];
  },
};
const isHeard = (x: unknown): x is [string, number] => Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'number';
// [D] The Firsts and Grandpa's notes a mid-year v3 save is already past are filed, never caught up: no SHE'S UP in July, no
// pile of old notes by the stand. A First is behind once what it celebrates has happened; a note once its day or its carrier
// (a sowing) has (they come in order). Later years and the season after the growing months have them all behind.
function fileBehind(s: State) {
  const y = s.clock.year, d = s.clock.day, over = y > 1 || s.clock.phase !== 'grow', g = s.giant, rows = s.patch?.rows || [];
  const C = s.firsts.career, file = (id: string, behind: boolean) => { if ((over || behind) && !C[id]) C[id] = { y, d }; };
  const open = rows.filter((r) => r.open), sown = open.filter((r) => r.plantedDay != null);
  file('up', g?.germDay != null && d >= g.germDay);
  file('rowIn', sown.length > 0);
  file('sprouts', sown.some((r) => !['seeded', 'tilled'].includes(r.stage)));
  file('allIn', open.length >= 2 && sown.length === open.length && !open.some((r) => r.plan));
  file('took', g?.setDay != null);
  file('named', !!g?.name);
  file('ripe', rows.some((r) => r.ripeDay != null && r.ripeDay <= d));
  const best = Math.max(g?.est || 0, ...(g?.history || []).flatMap((h) => (h.measures || []).map((m) => m.est || 0)));
  for (const [lb, id] of T.firsts.ladder) if (best >= lb && !C[id]) C[id] = { y, d };
  const P = s.pokes;
  for (const [i, N] of T.pokes.notes.entries()) {
    if (P.notes.some((x) => x.n === i + 1)) continue;
    if (!(over || d >= dayOf(N.by) || (N.rows && sown.length >= N.rows))) break;
    P.notes.push({ n: i + 1, y, d, via: 'save', read: d });
  }
}
// Beats the growing-year plan adds in place of v3 lessons, or on dates a v3 save may already be past:
// [id, date, the first year it runs, behind(s): it is behind this grow-phase save]. A replacement is behind the save once
// what it replaces has happened, not merely once its new date has: a v3 save from May 3 has yet to move her (v3 moved her
// on May 6, with the water lesson), so it still gets Moving Day; one from Aug 2 whose tape lesson the intro gap held to
// Aug 3 still gets the Vine Crawl (and with it the tape). Nothing replays, and nothing is lost.
const REDATED: [id: string, date: string, year: number, behind: (s: State) => boolean][] = [
  ['giant.moving', 'May 1', 1, (s: State) => s.giant?.transplantDay != null],
  ['crawl.crawl', 'Aug 1', 1, (s: State) => s.story.beats['giant.measure'] !== undefined],
  // a years-2+ prompt: behind the save once this year's date has passed
  ['patch.seedLetter', 'Apr 20', 2, (s: State) => s.clock.day > dayOf(T.story.y2plus.seedLetter)],
];

// The state is plain JSON. A hands-on close-up is a moment on screen, not a place in the year: it is always saved closed.
export function serialize(s: State) {
  const h = s.clock?.hands;
  if (!h) return JSON.stringify(s);
  s.clock.hands = null;
  try { return JSON.stringify(s); } finally { s.clock.hands = h; }
}
export function deserialize(str: string) {
  const s = typeof str === 'string' ? JSON.parse(str) : str;
  if (!s || typeof s !== 'object' || !s.clock || !s.meta) throw new Error('save: not a Quarter Sun Cove save');
  return migrate(s);
}
export function migrate(s: State) {
  if (s.v > SAVE_VERSION) throw new Error(`save: version ${s.v} is newer than this game (${SAVE_VERSION})`);
  while (s.v < SAVE_VERSION) {
    const up = MIGRATIONS[s.v];
    if (!up) throw new Error(`save: no migration from version ${s.v}`);
    up(s);
    s.v++;
  }
  return s;
}
// A short fingerprint of the whole state (determinism tests, the debug overlay).
export const hashState = (s: State) => hash32(serialize(s)).toString(16).padStart(8, '0');

// What the title screen's Continue button shows.
export function summary(s: State) {
  const when = s.clock.phase === 'winter' ? 'Winter' : s.clock.phase === 'newgame' ? 'New farm' : label(s.clock.day);
  return { farm: s.meta.farmName, surname: s.meta.surname, species: s.meta.species, year: s.clock.year, when, cash: s.cash };
}
