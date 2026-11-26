// The patch slice's UI [slice: patch] (design §4, §12): the Patch / Barn / Hives stations, the Row sheet with the
// ripeness forecast bar (the key UI: weekends sized by their crowds, the weigh-off pin, one bar per row, the ghost bar
// with whiskers for the variety and date being chosen), the Barn and Hives sheets, the "Water" FAB with its moisture
// ring, honey / swarm / shiny / volunteer pins, the shiny card, and the out-event juice (sounds, haptics, floaters,
// glides). The squash bugs' pins and the Row sheet's bug panel are the bug hunt's (track E, ui/hands-bugs.js).
//
// Seam for the season slice: on weekend days your farmer must walk to a row to cut or restock it (design §7). Set
// rowHooks.weekend = (api, row, what) => {...} ('cut' | 'restock') and the Row and Barn sheets route those taps through
// it; without it they dispatch patch/cut and patch/restock directly.
import { el, icon, fmt, bump } from './dom.js';
import { registerSheet, registerStation, registerFab, registerTap, registerPin, registerEvent, registerCard, registerPlanning } from './registry.js';
import { genericCard } from './cards.js';
import { clockStrip } from './banner.js';
import { portraitEl } from './dialog.js';
import { bubbleCard } from './bubble.js';
import { crateRow, fillCrates } from './shelf.js';
import { T } from '../sim/tuning.js';
import { label, dayOf, dowName, isWeekend, weekends, LAST_DAY } from '../sim/calendar.js';
import { rowZ, SWARM_SPOTS, VINE_SPOTS } from '../sim/layout.js';
import { isActive, getActive } from '../sim/events.js';
import { own } from '../sim/util.js';
import * as P from '../sim/patch.js';
import type { State, Action, Card } from '../sim/types.js';
import type { Api, UiEventOf, WeekendHook } from './types.js';
import type { PatchRow } from '../sim/state.js';
import type { Hit } from '../render/types.js';
export const rowHooks: { weekend: WeekendHook | null } = { weekend: null };
const VT = T.varieties, TP = T.patch, B = TP.bugs;
const SEP1 = dayOf('Sep 1'), OCT1 = dayOf('Oct 1');
const NAMES = P.LINES.names;
const nameOf = (v: string | null | undefined) => (v ? String(own(NAMES, v) ?? v) : '');
const COL = { classic: '#d8762c', mini: '#eaa04a', white: '#e8e1cf', warty: '#c8a24c', cinderella: '#c4532a', blue: '#93a7a6' };
const live = (s: State) => s.clock.phase === 'grow' || s.clock.phase === 'october';
const weekendNow = (s: State) => s.clock.phase === 'october' && isWeekend(s.clock.day);
const planted = (row: PatchRow | null | undefined) => !!row && row.open && row.plantedDay != null;
const BUG_SVG = '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><ellipse cx="12" cy="13.5" rx="5.2" ry="6.6" fill="#3a2f28"/><path d="M12 7.2v13" stroke="#6b5a4a" stroke-width="1.2"/><circle cx="12" cy="6" r="2.6" fill="#2a221d"/><path d="M7 10.5L3.5 8.5M7 14H3M7.5 17.5l-3 2.5M17 10.5l3.5-2M17 14h4M16.5 17.5l3 2.5M10.8 4L9.5 2M13.2 4l1.3-2" stroke="#2a221d" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="10" cy="11.5" rx="1.2" ry="2" fill="#c8a24c" opacity=".55"/></svg>';
const dot = (v: string | null | undefined, cls = '') => el('span.vdot', { class: cls || null, style: { background: (v ? own(COL, v) : undefined) || 'var(--line)' } });
const money = (n: number) => fmt.money(n);
const glideRow = (api: Api, r: number, fit = 15) => { const R = api.R?.cam; if (R?.zoomFor) api.glide(-1.5, rowZ(r), R.zoomFor(fit)); };
const glidePatch = (api: Api, s: State) => {
  const open = s.patch.rows.filter((row) => row.open).length, z = (rowZ(0) + rowZ(open - 1)) / 2, R = api.R?.cam;
  if (R?.zoomFor) api.glide(-1.2, z, R.zoomFor(10 + open * 2.2));
};
const afterInset = (fn: FrameRequestCallback) => requestAnimationFrame(() => requestAnimationFrame(fn));

// ------------------------------------------------------------ juice
function plinks(api: Api, n = 3, base = 1) { for (let i = 0; i < n; i++) setTimeout(() => api.sound('plink', { pitch: base + i * 0.18 }), i * 70); }
function floater(api: Api, text: string, x: number, z: number, cls = 'good', y = 1.4) { api.R?.fx?.({ type: 'float', text, x, y, z, cls }); }

// ------------------------------------------------------------ squish: 3 bug buttons, taps within 1.5 s chain a combo
// (the Row sheet's bug panel without a registered one: track E's hunt fills the slot, so these are only the fallback)
const squish = { combo: 0, last: 0 };
function squishTap(api: Api, r: number, btn: HTMLElement) {
  // a squished bug stays a tap target (and ignores the tap): disabling it let a quick second tap fall through to the
  // sheet behind, which iOS read as a double-tap zoom
  if (btn.classList.contains('squished')) return;
  const now = performance.now();
  squish.combo = now - squish.last <= B.chainSeconds * 1000 ? squish.combo + 1 : 1;
  squish.last = now;
  const res = api.dispatch({ type: 'patch/squish', row: r, quiet: true });
  btn.classList.add('squished'); btn.setAttribute('aria-disabled', 'true');
  api.sound('squish', { pitch: 1 + 0.16 * (squish.combo - 1) }); api.haptic(10 + squish.combo * 4);
  floater(api, squish.combo > 1 ? `Squish ×${squish.combo}!` : 'Squish!', P.bugSpot(r), rowZ(r), squish.combo > 2 ? 'good big' : 'good', 1.2);
  if (res.ok && !res.left) { setTimeout(() => api.sound('done'), 120); setTimeout(() => floater(api, 'Bugs gone!', P.bugSpot(r), rowZ(r), 'good big', 1.6), 450); }
}
function bugButtons(api: Api, r: number, onDone?: () => void) {
  const wrap = el('div.squish');
  for (let k = 0; k < B.buttons; k++) wrap.append(el('button.bugbtn', { 'aria-label': `Squish a bug (${k + 1} of ${B.buttons})`, html: BUG_SVG, style: { animationDelay: `${k * 60}ms` },
    onclick: (e) => { e.stopPropagation(); const b = e.currentTarget; if (!(b instanceof HTMLElement)) return; squishTap(api, r, b); if ([...wrap.children].every((x) => x.classList.contains('squished'))) onDone?.(); } }));
  return wrap;
}

// ------------------------------------------------------------ stations, FAB, taps
registerStation({ id: 'patch', label: 'Patch', icon: 'patch', order: 20, key: 'p', sheet: 'row',
  visible: (s: State) => !!s.unlocks.patch && live(s), badge: (s: State) => (s.patch.rows.some((row) => row.bugs > 0) ? '!' : null),
  onTap: (api: Api) => { const s = api.s(); if (s) api.openSheet('row', defaultRow(s)); } });
registerStation({ id: 'barn', label: 'Barn', icon: 'barn', order: 24, key: 'b',
  visible: (s: State) => !!s.unlocks.barn && live(s), badge: (s) => (P.barnStock(s, null, { soft: true }) || null), onTap: (api: Api) => api.openSheet('barn') });
registerStation({ id: 'hives', label: 'Hives', icon: 'hives', order: 30,
  visible: (s: State) => !!s.unlocks.hives && live(s) && !weekendNow(s), badge: (s: State) => (s.patch.honeyReady >= 1 ? Math.floor(s.patch.honeyReady) : null), onTap: (api: Api) => api.openSheet('hives') });

const thirsty = (s: State) => s.patch.moisture < TP.moisture.dry;
// [B] the weekend the last dry slip named, while it is fresh (the slip alert's out-event is remembered here)
let lastSlip: { y: number; d: number; w: number | undefined } | null = null;
const drySlip = (s: State) => (lastSlip && lastSlip.y === s.clock.year && s.clock.day - lastSlip.d <= TP.shelf.slipEveryDays ? lastSlip.w : null);
registerEvent('alert', (ev, api) => { if (ev.id === 'shelfSlip' && ev.cause === 'dry') { const s = api.s(); if (s) lastSlip = { w: ev.w, d: s.clock.day, y: s.clock.year }; } });
registerFab({
  id: 'water', priority: 10, icon: () => 'drop',
  when: (s: State) => s.clock.phase === 'grow' && !!s.unlocks.patchWater && s.patch.wet && s.patch.rows.some((row) => planted(row) && row.stage !== 'done'),
  label: (s) => (thirsty(s) ? 'Thirsty' : 'Water'), ring: (s: State) => s.patch.moisture, cls: (s) => (thirsty(s) ? 'thirsty' : 'water'),
  // [B] a weekend slipping for want of water says which, on the button that saves it
  badge: (s: State) => { const w = thirsty(s) ? drySlip(s) : null; return w != null ? `W${w + 1}` : `$${TP.water.perRow * s.patch.rows.filter((row) => planted(row) && row.stage !== 'done').length}`; },
  onTap: (api: Api) => {
    const s = api.s();
    if (!s) return;
    const before = s.patch.moisture, r = api.dispatch({ type: 'patch/water' });
    if (!r.ok) return;
    plinks(api, 4, 0.8); api.haptic(14);
    floater(api, `+${Math.round((s.patch.moisture - before) * 100)}% water`, -1.5, 2, 'good');
    api.R?.fx?.({ type: 'ripple', x: -1.5, z: 2, color: 0x9cc6d6 });
  },
});

// [B] a locked row or barn answers as a poke (track D writes the answer, with the day it opens); until D lands, a plain toast
function lockedPoke(api: Api, id: string, hit: Hit, fallback: string) {
  const r = api.dispatch({ type: 'world/poke', id, row: typeof hit.id === 'number' ? hit.id : null, quiet: true });
  if (r.ok && typeof r.text === 'string') api.captionAt?.({ x: hit.x ?? 0, y: 0.6, z: hit.z ?? 0 }, r.text);
  else if (!r.ok) api.toast(fallback, '');
}
registerTap('row', (hit, api) => {
  const s = api.s();
  if (!s) return;
  if (!s.unlocks.patch) { lockedPoke(api, 'row', hit, `Good dirt. Gran plans October on ${label(dayOf(T.story.y1.plant))}.`); return; }
  api.openSheet('row', hit.id);                       // (a row with bugs shows its squish buttons in the sheet)
});
registerTap('barn', (hit, api) => { if (api.s()?.unlocks.barn) api.openSheet('barn'); else lockedPoke(api, 'barn', hit, 'Gran will show you the barn in September.'); });
registerTap('hives', (_hit, api) => {
  const s = api.s();
  if (!s) return;
  if (s.patch.honeyReady >= 1 && (s.unlocks.hives || s.clock.year > 1)) collectHoney(api);
  else if (s.unlocks.hives) api.openSheet('hives');
});
function collectHoney(api: Api) {
  const r = api.dispatch({ type: 'patch/honey' });
  if (!r.ok) return;
  const jars = typeof r.jars === 'number' ? r.jars : 0;
  plinks(api, Math.min(6, jars), 1.1); api.haptic(12);
  floater(api, `+${jars} jar${jars > 1 ? 's' : ''}`, -4.8, -16.2, 'good big', 1.8);
}

// ------------------------------------------------------------ pins (at most 12 on screen)
// (the bug pins are the hunt's: ui/hands-bugs.js)
for (let r = 0; r < TP.rows; r++) {
  registerPin({ id: `mildew-${r}`, icon: 'drop', label: `Mildew on row ${r + 1}: milk spray`,
    when: (s: State) => s.clock.phase === 'grow' && !!s.unlocks.mildew && (s.patch.rows[r]?.mildew ?? 0) >= TP.mildew.start && !((s.patch.rows[r]?.bugs ?? 0) > 0),
    pos: () => ({ x: P.bugSpot(r) + 2.4, y: 0.7, z: rowZ(r) }), onTap: (api: Api) => api.openSheet('row', r) });
}
// [B] the jar pin: the lesson's, then (years 2+) at most once a week; in year 1 Gran shelves the week's jars herself (R4)
registerPin({ id: 'honey', icon: 'hives', label: 'Collect honey', urgent: (s: State) => s.story.goal?.id === 'honey',
  when: (s: State) => live(s) && (s.unlocks.hives || s.clock.year > 1) && P.honeyPinDue(s), pos: () => ({ x: -4.8, y: 1.7, z: -16.2 }), onTap: collectHoney });
registerPin({ id: 'swarm', icon: 'hives', label: 'Catch the swarm!', urgent: () => true,
  when: (s) => isActive(s, 'swarm'),
  pos: (s) => { const a = getActive(s, 'swarm'), sp = own(SWARM_SPOTS, a?.data?.spot ?? ''); return { x: a?.x ?? 0, y: (sp?.y ?? 1) + 0.6, z: a?.z ?? 0 }; },
  onTap: (api: Api) => { if (api.dispatch({ type: 'events/tap', id: 'swarm' }).ok) { plinks(api, 5, 1.2); api.haptic(20); } } });
for (let k = 0; k < 3; k++) {
  registerPin({ id: `shiny-${k}`, icon: 'sparkle', label: 'A shiny pumpkin! Tap it', urgent: () => true,
    when: (s) => !!fieldShiny(s, k), pos: (s) => { const r = fieldShiny(s, k)?.row ?? 0; return { x: P.bugSpot(r) - 2, y: 0.9, z: rowZ(r) }; },
    onTap: (api: Api) => { const sh = fieldShiny(api.s(), k); if (sh) { api.sound('ching', { pitch: 1.5 }); api.haptic(16); api.dispatch({ type: 'patch/shinyTap', id: sh.id }); } } });
}
const fieldShiny = (s: State | null, k: number) => s?.patch.shinies.filter((x) => x.state === 'field' && x.row != null)[k];
registerPin({ id: 'volunteer', icon: 'pumpkin', label: 'Harvest the volunteer pumpkin',
  when: (s: State) => s.patch.volunteer?.state === 'ripe' && live(s),
  pos: (s: State) => { const sp = own(VINE_SPOTS, s.patch.volunteer?.spot ?? '') ?? { x: 0, y: 0, z: 0 }; return { x: sp.x, y: sp.y + 0.8, z: sp.z }; },
  onTap: (api: Api) => { if (api.dispatch({ type: 'patch/volunteer' }).ok) { plinks(api, 3, 1); api.haptic(14); } } });

// ------------------------------------------------------------ out-events
registerEvent('patch/focus', (ev, api) => { if (!api.settings.reduceMotion) api.glide(ev.x, ev.z, api.R?.cam?.zoomFor?.(12) ?? ev.zoom); });
registerEvent('patch/watered', (ev, api) => { if (ev.auto) api.toast('The irrigation timer watered the patch.', '', 'drop'); });
// several rows scheduled at once (Gran's plan) say so in one pill, not four
let planned: UiEventOf<'patch/planted'>[] = [];
registerEvent('patch/planted', (ev, api) => {
  if (!ev.scheduled) { api.sound('pop'); api.haptic(10); return; }
  if (!planned.length) setTimeout(() => {
    const p = planned; planned = [];
    const days = p.map((x) => x.day ?? 0).sort((a, b) => a - b), first = p[0];
    api.toast(p.length === 1 && first ? `Row ${first.row + 1}: ${nameOf(first.variety)} goes in on ${label(first.day ?? 0)}.`
      : `${p.length} rows planned, ${label(days[0] ?? 0)} to ${label(days.at(-1) ?? 0)}. Seed is paid each morning one goes in.`, '', 'calendar');
  }, 0);
  planned.push(ev);
  api.sound('tick');
});
// [B] a sowing day: the camera goes to the row (not over an open sheet: that was the player's own Plant)
registerEvent('patch/sowing', (ev, api) => {
  if (!api.currentSheet() && !api.settings.reduceMotion) api.glide(ev.x, ev.z, api.R?.cam?.zoomFor?.(15) ?? ev.zoom);
  plinks(api, 3, 1.05); api.haptic(10);
});
// [B] a crate filled to its rim while the Patch station is out of sight: the station button bounces
registerEvent('patch/crate', (ev, api) => { if (ev.level === 3 && ev.was < 3 && api.currentSheet() !== 'row') bump(document.querySelector<HTMLElement>('[data-target="station:patch"]'), 'squash'); });
// [B] the two bubbles: Gran's empty-row question (rulings R14) and the June fog job (rulings R8), anchored on the row
const rowAnchor = (_s: State, card: Card) => card.data?.at ?? null;
registerCard('emptyRow', bubbleCard({ anchor: rowAnchor }));
registerCard('fogjob', bubbleCard({ anchor: rowAnchor }));
registerEvent('patch/ripe', (ev, api) => { if (ev.first) { api.sound('ching', { pitch: ev.weekend ? 1.35 : 1.1 }); if (ev.weekend) api.haptic(25); } });
registerEvent('patch/cut', (ev, api) => { api.sound('thunk'); floater(api, `${ev.n} → barn`, -1.5, rowZ(ev.row)); });
registerEvent('patch/restock', (ev, api) => { plinks(api, 5, 1); floater(api, `+${ev.n}`, -1.5, rowZ(ev.row)); });
registerEvent('patch/honey', (_ev, api) => { api.sound('plink', { pitch: 1.4 }); });
registerEvent('patch/swarm', (ev, api) => { if (ev.state === 'landed') api.sound('buzz'); });
registerEvent('patch/shiny', (ev, api) => { if (ev.state === 'field') api.sound('ching', { pitch: 1.7 }); });
registerEvent('patch/cleared', (ev, api) => { api.sound('pop'); plinks(api, 4, 0.9); glideRow(api, ev.row); });
registerEvent('patch/trucked', (_ev, api) => api.sound('thunk'));
// a bramble row bought in the winter shop clears at once, so you see it happen
registerEvent('bought', (ev, api) => { const m = /^row(\d)$/.exec(ev.item || ''); if (m && m[1]) api.dispatch({ type: 'patch/clear', row: +m[1] - 1, quiet: true }); });

// ------------------------------------------------------------ the shiny card
const SHINY_ART = {
  sphere: '<circle cx="50" cy="56" r="30" fill="#e0843a"/><path d="M50 26c-2-6 1-11 6-13" stroke="#6e6a3e" stroke-width="5" fill="none" stroke-linecap="round"/>',
  heart: '<path d="M50 86C20 66 16 46 30 36c9-6 16-2 20 6 4-8 11-12 20-6 14 10 10 30-20 50z" fill="#e0843a"/><path d="M50 40c-1-8 2-14 8-16" stroke="#6e6a3e" stroke-width="5" fill="none" stroke-linecap="round"/>',
  smiley: '<ellipse cx="50" cy="58" rx="33" ry="27" fill="#e0843a"/><path d="M34 62q16 14 32 0" stroke="#8a4a1e" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M50 31c-1-7 2-12 7-14" stroke="#6e6a3e" stroke-width="5" fill="none" stroke-linecap="round"/>',
  twins: '<ellipse cx="36" cy="60" rx="22" ry="20" fill="#e0843a"/><ellipse cx="64" cy="60" rx="22" ry="20" fill="#d8762c"/><path d="M50 40c-1-7 2-12 7-14" stroke="#6e6a3e" stroke-width="5" fill="none" stroke-linecap="round"/>',
  beak: '<ellipse cx="44" cy="58" rx="26" ry="24" fill="#e0843a"/><path d="M62 50l30 10-30 10z" fill="#e5c66b"/><path d="M44 34c-1-7 2-12 7-14" stroke="#6e6a3e" stroke-width="5" fill="none" stroke-linecap="round"/>',
  weighmaster: '<ellipse cx="50" cy="58" rx="33" ry="27" fill="#e0843a"/><circle cx="39" cy="52" r="3" fill="#3a2f28"/><circle cx="61" cy="52" r="3" fill="#3a2f28"/><path d="M38 68h24" stroke="#3a2f28" stroke-width="4" stroke-linecap="round"/><path d="M50 31c-1-7 2-12 7-14" stroke="#6e6a3e" stroke-width="5" fill="none" stroke-linecap="round"/>',
};
registerCard('shiny', {
  build(box, s, card, api) {
    const art = card.kind === 'shiny' && typeof card.data === 'object' && 'kind' in card.data && typeof card.data.kind === 'string' ? own(SHINY_ART, card.data.kind) || SHINY_ART.sphere : SHINY_ART.sphere;
    box.classList.add('shiny-card');
    box.append(el('div.shiny-art', { html: `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="glow">${art}</g><path class="tw" d="M82 18l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#fff3c4"/><path class="tw b" d="M16 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff3c4"/></svg>` }));
    genericCard(box, s, card, api);
  },
});

// ------------------------------------------------------------ [B] the Row sheet: the Planting Table, and a row's status
// While a row has nothing in the ground (May 20 to the end of the window) the Row sheet is the Planting Table (plan §3.8,
// rulings R3): the clock stops (registerPlanning), October's four crates sit on top, and you drag the row's ripe window
// along a Sep-Oct strip. The weekends are magnets: on release the sowing day snaps to the best one for the weekends the
// window covers (P.targetDay), so you never pick a day. Weekend chips under the strip are the tap-only way; Classic / Mini
// is a toggle; the details (the old ripeness lanes, nudges, Ask Gran) sit behind "Details"; Plant is a sticky foot.
// Gran teaches rows 1 and 2 in year 1 from a chalk line at the top, then hands over. Once a row is in, the sheet is its
// status (with the crates kept small on top): the bug panel slot (registerRowPanel), the barn and restock buttons.
const ui: { row: number; variety: string; day: number | null; span: [number, number] | null; details: boolean; ask: ReturnType<typeof P.askGran> | null;
  sig: string; open: boolean; mode: boolean | null; lastDay: number; drag: number | null; raf: number;
  bugged: Record<number, boolean>; bugsGone: Record<number, number>; bugBoxH: number; nodes: Record<string, HTMLElement> | null } =
  { row: 0, variety: 'classic', day: null, span: null, details: false, ask: null, sig: '', open: false, mode: null,
  lastDay: -1, drag: null, raf: 0, bugged: {}, bugsGone: {}, bugBoxH: 0, nodes: null };
// [B] a panel slot track E fills with the bug hunt's entry (rulings R18): registerRowPanel('bugs', (api, s, r, row) => node)
const ROW_PANELS = new Map<string, (api: Api, s: State, r: number, row: PatchRow) => HTMLElement>();
export function registerRowPanel(id: string, fn: (api: Api, s: State, r: number, row: PatchRow) => HTMLElement) { ROW_PANELS.set(id, fn); }

function defaultRow(s: State) {
  const g = s.story.goal?.target;
  if (g?.kind === 'row' && typeof g.id === 'number' && s.patch.rows[g.id]?.open) return g.id;
  const rows = s.patch.rows;
  const bug = rows.findIndex((row) => row.bugs > 0);
  if (bug >= 0) return bug;
  const step = P.lessonStep(s);
  if (step === 'row1') return 0;
  if (step === 'row2') return 1;
  if (s.clock.phase === 'grow' && s.clock.day < SEP1) { const free = rows.findIndex((row) => row.open && !planted(row) && !row.plan); if (free >= 0) return free; }
  const ripe = rows.findIndex((row) => row.stock.prime > 0);
  return ripe >= 0 ? ripe : 0;
}
const stageWord = { bramble: 'Bramble', tilled: 'Tilled', seeded: 'Seeded', sprouts: 'Sprouts', vines: 'Vines', flowers: 'Flowers', green: 'Green fruit', ripe: 'Ripe', done: 'Done' };
// the Table: a row with nothing in the ground yet, in the planting part of the year
const tableMode = (s: State) => { const row = s.patch.rows[ui.row]; return s.clock.phase === 'grow' && !!s.unlocks.patch && !!row?.open && !planted(row) && s.clock.day < SEP1; };
registerPlanning('row', (s) => tableMode(s));   // (only asked while the Row sheet is the open one)
export const tableOpenFor = (s: State, r: number) => { ui.row = r; return tableMode(s); };   // (tests: is row r's sheet the Table?)

registerSheet('row', {
  eyebrow: (s) => (tableMode(s) ? 'The Planting Table' : ui.row === 0 ? 'The patch · front of the store' : ui.row < 2 ? 'The patch · up front' : 'The patch'),
  // (on the Table just "Row 2": its plan shows in the tab, the crates and the foot, and the head keeps room for Details)
  title: (s: State) => { const row = s.patch.rows[ui.row], v = P.displayVariety(row); return `Row ${ui.row + 1}${tableMode(s) ? '' : !row?.open ? ' · bramble' : v ? ` · ${nameOf(v)}` : row.plan ? ` · ${nameOf(row.plan.variety)} planned` : ''}`; },
  build(body, s: State, arg, api: Api) {
    ui.row = typeof arg === 'number' && Number.isInteger(arg) && s.patch.rows[arg] ? arg : defaultRow(s);
    ui.open = true; ui.sig = ''; ui.mode = null; ui.details = false; ui.ask = null;
    resetPick(s);
    body.classList.add('rowsheet');
    body.append(el('div.tb-top'), el('div.rowtabs', { role: 'tablist' }), el('div.tb-crates'), el('div.tb-main'), el('div.rowpanel'), el('div.rowfoot'));
    this.update?.(body, s, arg, api);
    afterInset(() => glidePatch(api, s));
  },
  update(body, s: State, _arg, api: Api) {
    if (s.clock.day !== ui.lastDay) { ui.lastDay = s.clock.day; if (ui.day != null && ui.day < s.clock.day) ui.day = s.clock.day; }
    const row = s.patch.rows[ui.row], table = tableMode(s);
    if (!row) return;
    if (table !== ui.mode) {
      ui.mode = table;
      // the Table is a tall sheet (the clock is stopped and the camera only needs the patch); a row's status is the usual one
      const sheet = body.closest('#sheet');
      if (sheet instanceof HTMLElement) { sheet.classList.toggle('table', table); sheet.style.setProperty('--table-vh', `${TP.table.maxVh}vh`); }
      afterInset(() => api.reinset?.());
    }
    if (row.bugs > 0) ui.bugged[ui.row] = true;
    else if (ui.bugged[ui.row]) {
      // when a row's bugs clear, its panel keeps a "Bugs gone!" box in their place for a moment: otherwise everything
      // below jumps up, and the next quick tap lands on "Pull it up and replant"
      ui.bugged[ui.row] = false; ui.bugsGone[ui.row] = performance.now() + 2200;
      const bugBox = body.querySelector('.rowpanel .alertbox.bugs');
      ui.bugBoxH = bugBox instanceof HTMLElement ? bugBox.offsetHeight : 0;
    }
    const gone = performance.now() < (ui.bugsGone[ui.row] || 0);
    const sig = [ui.row, table, s.clock.day, s.clock.phase, s.cash >= 200 ? 'rich' : Math.round(s.cash), JSON.stringify(row.stock), row.stage, row.bugs, gone, row.mildew,
      row.plan?.variety, row.plan?.day, ui.variety, ui.day, ui.span?.join(), ui.details, ui.ask?.line, P.barnStock(s), P.barnFree(s), s.story.goal?.text,
      s.patch.rows.map((x) => `${x.open}${x.plantedDay}${x.plan?.day}${x.plan?.variety}${x.bugs > 0}${x.shiny ? 1 : 0}`).join(''), Math.round(row.progress)].join('|');
    if (sig === ui.sig) return;
    ui.sig = sig;
    headMore(body, s, api);
    top(body.querySelector<HTMLElement>('.tb-top'), s, api);
    tabs(body.querySelector<HTMLElement>('.rowtabs'), s, api);
    cratesView(body.querySelector<HTMLElement>('.tb-crates'), s, api);
    main(body.querySelector<HTMLElement>('.tb-main'), s, api);
    panel(body.querySelector<HTMLElement>('.rowpanel'), s, api);
    foot(body.querySelector<HTMLElement>('.rowfoot'), s, api);
  },
  onClose() { ui.open = false; ui.drag = null; document.querySelector('#sheet')?.classList.remove('table'); },
});
// What the Table starts a row on: its plan if it has one (to change it), else the row's default variety and no day yet
// (there is never a default date: Plant waits for a weekend).
function resetPick(s: State) {
  const row = s.patch.rows[ui.row];
  const td = P.tableDefault(s, ui.row);
  ui.variety = row?.plan?.variety || (row && P.displayVariety(row)) || (typeof td === 'string' ? td : 'classic');
  ui.day = row?.plan?.day ?? null;
  ui.span = ui.day != null ? spanOf(P.ghostTargets(s, ui.variety, ui.day)) : null;
}
const spanOf = (ts: number[]): [number, number] | null => (ts.length ? [Math.min(...ts), Math.max(...ts)] : null);
function select(s: State, r: number, api: Api) { ui.row = r; ui.ask = null; resetPick(s); ui.sig = ''; api.haptic(6); api.sound('tick'); bump(document.querySelector<HTMLElement>('#sheet h2'), 'squash'); }

// ---- the top: the "clock stopped" slate, and Gran's chalk (her lesson, Ask Gran, or last October in years 2+)
function coachLine(s: State) {
  if (ui.ask) return ui.ask.line;
  const step = P.lessonStep(s), T_ = P.LINES.table;
  if (step === 'row1') return ui.row === 0 && ui.span?.[0] === 0 ? T_.row1b : T_.row1;
  if (step === 'row2') return T_.row2;
  if (step === 'handover') return T_.handover;
  if (s.clock.year > 1 && s.patch.rows.some((row) => row.open && !planted(row) && !row.plan)) return P.lastOctLine(s);
  return null;
}
function top(n: HTMLElement | null, s: State, api: Api) {
  if (!n) return;
  n.innerHTML = '';
  if (!tableMode(s)) return;
  n.append(clockStrip(P.LINES.table.clock));
  const line = coachLine(s);
  if (line) n.append(el('div.tb-coach', {}, portraitEl(api, 'gran', s, 'small'), el('span', { text: line })));
}
// ---- row tabs: each says the weekends its row is ripe for (its own projection: the same alone as in a full plan)
function tabs(n: HTMLElement | null, s: State, api: Api) {
  if (!n) return;
  n.innerHTML = '';
  s.patch.rows.forEach((row, r) => {
    const v = P.displayVariety(row) || row.plan?.variety, ts = row.open && (planted(row) || row.plan) ? P.spanText(P.rowTargets(s, r)) : '';
    const b = el('button.rowtab', { class: [r === ui.row ? 'on' : '', !row.open ? 'locked' : '', row.bugs > 0 ? 'bugs' : ''].join(' ') || null, role: 'tab', 'aria-selected': r === ui.row ? 'true' : 'false',
      'aria-label': `Row ${r + 1}${row.open ? (ts ? `, ripe for ${ts}` : '') : ' (bramble)'}`, onclick: () => select(s, r, api) },
    el('span.rt-n', {}, row.open ? (v ? dot(v, row.plan && !planted(row) ? 'ring' : '') : el('span.vdot.soil')) : el('span', { html: icon('lock', 's') }), el('b', { text: r + 1 })),
    row.open ? el('small.rt-w', { text: ts || '·' }) : null);
    n.append(b);
  });
}
// ---- October's crates (live with the row's ripe window while choosing)
let crateNode: HTMLElement|null = null;
const swapFor = (s: State) => (tableMode(s) && ui.day != null ? { row: ui.row, proj: P.ghost(s, ui.variety, ui.day) } : null);
const selCrate = (s: State, sh: P.Crate[]) => {
  const ts = ui.span ? [ui.span[0]] : P.rowTargets(s, ui.row);
  return ts.length ? ts[0] ?? -1 : sh.slice().sort((a, b) => a.met - b.met)[0]?.i ?? -1;
};
// [B] years 2+ on the Table: last October's share of each weekend's wants that sold, big and small (rulings R13: a faint ghost)
function lastOct(s: State) {
  const o = s.patch.lastReport?.oct;
  if (s.clock.year < 2 || !o || !tableMode(s)) return null;
  return o.map((x): [number | null, number | null] => [x.big + x.missBig ? x.big / (x.big + x.missBig) : null, x.small + x.missSmall ? x.small / (x.small + x.missSmall) : null]);
}
function cratesView(n: HTMLElement | null, s: State, api: Api) {
  if (!n) return;
  n.innerHTML = '';
  if (!s.unlocks.patch || !live(s)) { crateNode = null; return; }
  const sh = P.shelf(s, swapFor(s));
  crateNode = crateRow(sh, { sel: selCrate(s, sh), compact: !tableMode(s), pulse: pulseCrates(s), last: lastOct(s) });
  crateNode.addEventListener('plunk', () => { api.sound('thunk', { pitch: 1.4 }); api.haptic(8); });
  n.append(crateNode);
}
const pulseCrates = (s: State) => (P.lessonStep(s) === 'row1' && ui.row === 0 && ui.span?.[0] !== 0 ? [0] : ui.ask?.span ? [ui.ask.span[0]] : []);
// the crates and the strip follow a drag every frame (no rebuild)
function liveCrates(s: State | null) {
  if (!crateNode || !s) return;
  const sh = P.shelf(s, swapFor(s));
  const opts: object = { sel: selCrate(s, sh), pulse: pulseCrates(s), last: lastOct(s) };
  fillCrates(crateNode, sh, opts);
}

// ---- the middle of the Table: the variety toggle, the strip, the weekend chips, and the details when asked for
function main(n: HTMLElement | null, s: State, api: Api) {
  if (!n) return;
  n.innerHTML = '';
  if (!tableMode(s)) return;
  n.append(varieties(s, api), strip(s, api), chips(s, api));
  const det = el('div.tb-details', { hidden: !ui.details });
  n.append(det);
  if (ui.details) details(det, s, api);
}
// "Details" (the ripeness lanes, nudges, Ask Gran) sits in the sheet's head, next to the close button: on a phone the
// sticky Plant foot would cover it at the bottom of the Table. Opening it scrolls the details into view.
function headMore(body: HTMLElement, s: State, api: Api) {
  const head = body.closest('#sheet')?.querySelector('.sheet-head');
  if (!head) return;
  let b = head.querySelector('.tb-headmore');
  if (!tableMode(s)) { b?.remove(); return; }
  if (!b) {
    b = el('button.btn.ghost.small.tb-headmore', { onclick: () => {
      ui.details = !ui.details; ui.sig = ''; api.sound('tick');
      if (ui.details) requestAnimationFrame(() => body.querySelector('.tb-details')?.scrollIntoView({ block: 'start', behavior: api.settings?.reduceMotion ? 'auto' : 'smooth' }));
    } });
    head.insertBefore(b, head.lastElementChild);
  }
  b.textContent = ui.details ? 'Hide details' : 'Details';
  b.setAttribute('aria-expanded', ui.details ? 'true' : 'false');
}
// The strip: Sep 1 - Oct 31, the four weekends, the other rows' windows faint, and this row's ripe window: drag it. The
// window's soft glow is its give-or-take (no "±" anywhere: rulings R11).
const STRIP = { h: 54, top: 14, from: SEP1, to: LAST_DAY };
function strip(s: State, api: Api) {
  const wrap = el('div.tb-strip');
  const draw = () => {
    const W = Math.max(280, wrap.clientWidth || 358), x0 = 4, x1 = W - 4, span = STRIP.to - STRIP.from + 1, dx = (x1 - x0) / span;
    const X = (d: number) => x0 + (Math.max(STRIP.from, Math.min(STRIP.to + 1, d)) - STRIP.from) * dx, H = STRIP.h, base = H - 12;
    const out: string[] = [], g = ui.day != null ? P.ghost(s, ui.variety, ui.day) : null;
    weekends().forEach((w, i) => {
      const on = ui.span && i >= ui.span[0] && i <= ui.span[1], pulse = P.lessonStep(s) === 'row1' && ui.row === 0 && i === 0 && !on;
      out.push(`<rect class="sw ${on ? 'on' : ''} ${pulse ? 'pulse' : ''}" x="${X(w.sat) - 1}" y="${STRIP.top - 4}" width="${2 * dx + 2}" height="${base - STRIP.top + 6}" rx="3"/>`);
      out.push(`<text class="swl ${on ? 'on' : ''}" x="${X(w.sat) + dx}" y="${STRIP.top - 6}">W${i + 1}</text>`);
    });
    // the other rows' windows: thin lines, so the weekends you've already covered show
    s.patch.rows.forEach((row, r) => {
      if (r === ui.row || !row.open || !(planted(row) || row.plan)) return;
      const pr = P.projectRow(s, r);
      if (pr?.mid == null) return;
      out.push(`<rect class="sother" x="${X(pr.ripeFrom)}" y="${base + 2}" width="${Math.max(2, X(pr.primeTo) - X(pr.ripeFrom))}" height="3" rx="1.5" fill="${own(COL, P.displayVariety(row) || row.plan?.variety || '') ?? '#d8762c'}"/>`);
    });
    out.push(`<line class="saxis" x1="${x0}" x2="${x1}" y1="${base}" y2="${base}"/>`);
    const marks: [number, string][] = [[SEP1, 'Sep'], [OCT1, 'Oct'], [dayOf(T.calendar.weighoff), 'Weigh-off']];
    for (const [d, t] of marks) out.push(`<text class="sax" x="${X(d) + (t === 'Sep' ? 0 : dx / 2)}" y="${H - 1}" text-anchor="${t === 'Sep' ? 'start' : 'middle'}">${t}</text>`);
    if (g && g.mid != null) {
      let path = `M${X(STRIP.from)} ${base}`;
      const peak = Math.max(1, ...Array.from({ length: span }, (_, k) => P.stateOn(g, STRIP.from + k).p));
      for (let k = 0; k < span; k++) { const y = base - (base - STRIP.top - 4) * (P.stateOn(g, STRIP.from + k).p / peak); path += `L${X(STRIP.from + k)} ${y}L${X(STRIP.from + k + 1)} ${y}`; }
      path += `L${X(STRIP.to + 1)} ${base}Z`;
      const blur = Math.max(1, g.whisker * dx * 0.5).toFixed(1);
      out.push(`<path class="sglow" d="${path}" fill="${own(COL, ui.variety) ?? '#d8762c'}" style="filter: blur(${blur}px)"/>`, `<path class="sripe" d="${path}" fill="${own(COL, ui.variety) ?? '#d8762c'}"/>`);
      const m = X(g.mid) + dx / 2;
      out.push(`<g class="shandle"><circle cx="${m}" cy="${base}" r="9"/><path d="M${m - 4} ${base}l-3 0M${m + 4} ${base}l3 0" /></g>`);
    } else out.push(`<text class="shint" x="${x0 + 6}" y="${STRIP.top + 10}">Drag here to place</text><text class="shint" x="${x0 + 6}" y="${STRIP.top + 25}">the ripe window</text>`);
    wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="When row ${ui.row + 1} would be ripe, September to October">${out.join('')}</svg>`;
    return { dayAt: (px: number) => STRIP.from + (px - x0) / dx };
  };
  let geo: { dayAt: (px: number) => number } | null = null;
  requestAnimationFrame(() => { geo = draw(); });
  geo = draw();
  // drag: the row's ripe window follows the finger (the sowing day whose middle sits under it); on release the weekends it
  // covers pull it onto the best day for them (the magnets)
  const at = (e: { clientX: number }) => { const r = wrap.getBoundingClientRect(), svg = wrap.querySelector('svg'), vw = svg instanceof SVGSVGElement && svg.viewBox.baseVal.width ? svg.viewBox.baseVal.width : r.width; return geo?.dayAt((e.clientX - r.left) * (vw / r.width)) ?? STRIP.from; };
  const move = (e: PointerEvent) => {
    const day = P.dayForRipe(s, ui.variety, at(e));
    if (day === ui.day) return;
    ui.day = day; ui.span = P.dragSpan(s, ui.variety, day); ui.ask = null;
    api.haptic(4); api.sound('tick', { pitch: 1.2 });
    cancelAnimationFrame(ui.raf);
    ui.raf = requestAnimationFrame(() => { geo = draw(); liveCrates(api.s()); });
  };
  wrap.addEventListener('pointerdown', (e) => { ui.drag = e.pointerId; try { wrap.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ } move(e); });
  wrap.addEventListener('pointermove', (e) => { if (ui.drag === e.pointerId) move(e); });
  const end = (e: PointerEvent) => {
    if (ui.drag !== e.pointerId) return;
    ui.drag = null;
    if (ui.span) { ui.day = P.targetDay(s, ui.variety, ui.span); api.sound('pop'); api.haptic(10); }
    ui.sig = '';
  };
  wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
  return wrap;
}
// Weekend chips: tap one to target it, an adjacent one to grow the span to two, another to start again there, an end of a
// span to shrink it. A weekend this variety can't reach any more is greyed with why.
function chips(s: State, api: Api) {
  const box = el('div.tb-chips', { role: 'group', 'aria-label': 'Ripe for' });
  weekends().forEach((w, i) => {
    const why = P.reachOf(s, ui.variety, i), on = ui.span && i >= ui.span[0] && i <= ui.span[1];
    const pulse = P.lessonStep(s) === 'row1' && ui.row === 0 && i === 0 && !on || (ui.ask?.span?.[0] === i && !on);
    box.append(el('button.tb-chip', { class: [on ? 'on' : '', pulse ? 'pulse' : ''].join(' ') || null, disabled: !!why, 'aria-pressed': on ? 'true' : 'false', data: { target: `wk:${i}` },
      onclick: () => tapWeekend(s, api, i) }, el('b', { text: `W${i + 1}` }), el('small', { text: why || label(w.sat) })));
  });
  return box;
}
function tapWeekend(s: State, api: Api, i: number) {
  const sp = ui.span;
  if (sp && sp[0] === sp[1] && Math.abs(i - sp[0]) === 1) ui.span = [Math.min(i, sp[0]), Math.max(i, sp[0])];
  else if (sp && sp[0] !== sp[1] && (i === sp[0] || i === sp[1])) ui.span = i === sp[0] ? [sp[1], sp[1]] : [sp[0], sp[0]];
  else ui.span = [i, i];
  ui.day = P.targetDay(s, ui.variety, ui.span); ui.ask = null; ui.sig = '';
  api.haptic(8); api.sound('tick');
}
// Classic / Mini (and the later years' varieties): what a row gives, in the words of the crates
const VSUB = (v: string) => { const t = own(VT, v); return t ? `${t.fruit} ${t.large ? 'big' : 'small'}, keeps ${t.prime} days` : ''; };
function varieties(s: State, api: Api) {
  const box = el('div.tb-vars', { role: 'radiogroup', 'aria-label': 'Variety' });
  for (const v of P.unlockedVarieties(s)) {
    box.append(el('button.tb-var', { class: ui.variety === v ? 'on' : null, role: 'radio', 'aria-checked': ui.variety === v ? 'true' : 'false',
      onclick: () => { ui.variety = v; if (ui.span) ui.day = P.targetDay(s, v, ui.span); ui.sig = ''; api.haptic(6); api.sound('tick'); } },
    el('span.tv-n', {}, dot(v), el('b', { text: nameOf(v) }), el('i', { text: `$${own(VT, v)?.seed ?? ''}` })), el('small', { text: VSUB(v) })));
  }
  return box;
}
// Details: the old ripeness lanes (every row), the nudges, Ask Gran, and in years 2+ Gran's usual
function details(n: HTMLElement, s: State, api: Api) {
  const lanes = el('div.fbar-wrap');
  n.append(lanes);
  requestAnimationFrame(() => bar(lanes, s, api));
  const lo = P.tableWindow(s)[0], hi = P.tableWindow(s)[1], step = TP.table.nudgeDays;
  const nudge = (k: number) => el('button.btn.small', { disabled: ui.day == null || (k < 0 ? ui.day <= lo : ui.day >= hi),
    onclick: () => { ui.day = Math.min(hi, Math.max(lo, (ui.day ?? lo) + k * step)); ui.span = spanOf(P.ghostTargets(s, ui.variety, ui.day)); ui.sig = ''; api.sound('tick'); } },
  el('span', { text: k < 0 ? `◂ ${step} days` : `${step} days ▸` }));
  const acts = el('div.acts.tb-acts', {}, nudge(-1), nudge(1),
    el('button.btn.small.tb-ask', { onclick: () => { const cur = api.s(); if (!cur) return; ui.ask = P.askGran(cur); if (ui.ask.variety) ui.variety = ui.ask.variety; ui.sig = ''; api.sound('pop'); } }, el('span', { text: 'Ask Gran' })));
  if (s.clock.year > 1 && P.gransPlan(s).length) acts.append(el('button.btn.small', { 'data-target': 'patch:gran',
    onclick: () => { if (api.dispatch({ type: 'patch/gran' }).ok) { plinks(api, 4, 0.9); api.haptic(14); ui.sig = ''; } } }, el('span', { text: "Gran's usual" })));
  n.append(acts);
}

// ---- the ripeness lanes (Details): every row's fruit through Sep and Oct, with this row's choice as a dashed lane
function bar(wrap: HTMLElement, s: State, _api: Api) {
  const barOpts: object = { row: ui.row, variety: ui.day != null ? ui.variety : null, day: ui.day ?? s.clock.day };
  const data = P.forecastBar(s, barOpts);
  const W = Math.max(280, wrap.clientWidth - 12 || 340), x0 = 26, x1 = W - 4, from = data.from, span = data.to - from + 1, dx = (x1 - x0) / span;
  const X = (d: number) => x0 + (Math.max(from, Math.min(data.to + 1, d)) - from) * dx;
  const open = data.rows.filter((r) => !r.closed);
  const LH = 14, GAP = 3, HEAD = 19, top0 = HEAD + 3, ghostY = top0 + open.length * (LH + GAP) + 1, H = ghostY + (data.ghost ? LH + 3 : 0) + 14;
  const out: string[] = [];
  data.weekends.forEach((w, i) => {
    out.push(`<rect class="wkband" x="${X(w.sat)}" y="${HEAD}" width="${2 * dx}" height="${H - HEAD - 13}"/>`);
    out.push(`<text class="wkl" x="${X(w.sat) + dx}" y="${HEAD - 2}">W${i + 1}</text>`);
  });
  const wo = X(data.weighoff) + dx / 2;
  out.push(`<line class="wo" x1="${wo}" x2="${wo}" y1="${HEAD - 14}" y2="${H - 12}"/>`);
  if (data.today >= from && data.today <= data.to) {
    const tx = X(data.today) + dx / 2;
    out.push(`<line class="today" x1="${tx}" x2="${tx}" y1="${HEAD - 4}" y2="${H - 12}"/><circle class="todayc" cx="${tx}" cy="${HEAD - 5}" r="3"/>`);
  }
  open.forEach((r, i) => {
    const y = top0 + i * (LH + GAP), sel = r.row === ui.row;
    out.push(`<rect class="lane ${sel ? 'sel' : ''}${r.planned ? ' planned' : ''}" x="${x0}" y="${y}" width="${x1 - x0}" height="${LH}" rx="4"/>`);
    out.push(`<g class="rowlab ${sel ? 'sel' : ''} ${r.v ? '' : 'empty'}"><circle cx="11" cy="${y + LH / 2}" r="8.5" fill="${r.v ? own(COL, r.v) ?? '#e3d6c2' : '#e3d6c2'}"/><text x="11" y="${y + LH / 2 + 3.5}">${r.row + 1}</text></g>`);
    out.push(rowShape(r, data, X, dx, y, LH, r.planned));
  });
  if (data.ghost) {
    const g = data.ghost, y = ghostY;
    out.push(`<rect class="lane ghostlane" x="${x0}" y="${y}" width="${x1 - x0}" height="${LH}" rx="4"/>`);
    out.push(`<circle class="ghostdot" cx="11" cy="${y + LH / 2}" r="7" stroke="${own(COL, g.v ?? '') ?? '#d8762c'}"/>`);
    out.push(rowShape({ row: -1, proj: g, hist: [], v: g.v }, data, X, dx, y, LH, true));
  }
  const ticks: [number, string, string][] = [[from, 'Sep 1', ''], [dayOf('Sep 15'), '15', ''], [OCT1, 'Oct 1', ''], [dayOf('Oct 15'), '15', ''], [data.weighoff, 'Weigh-off', 'woax']];
  for (const [d, t, cls] of ticks) {
    out.push(`<line class="tick" x1="${X(d) + dx / 2}" x2="${X(d) + dx / 2}" y1="${H - 12}" y2="${H - 9}"/><text class="axl ${cls}" x="${X(d) + dx / 2}" y="${H - 1}">${t}</text>`);
  }
  wrap.innerHTML = `<svg class="fbar" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Ripeness of every row, September to October">${out.join('')}</svg>` + legend(s, data);
}
// a row's lane: green while growing, an orange swell while prime, brown while soft, give-or-take whiskers on the middle day
type BarData = ReturnType<typeof P.forecastBar>;
type BarRow = BarData['rows'][number] | { row: number; v: string | null; proj: NonNullable<BarData['ghost']>; hist: number[] };
function rowShape(r: BarRow, data: BarData, X: (d: number) => number, dx: number, y: number, LH: number, ghost: boolean | undefined) {
  const pr = 'proj' in r ? r.proj ?? null : null, hist = 'hist' in r ? r.hist : [];
  const from = data.from, to = data.to, today = data.today;
  if (!pr && !hist?.length) return '';
  const days: { g: number; p: number; s: number }[] = [];
  for (let d = from; d <= to; d++) {
    const h = d < today ? hist?.[d - from] : null;
    days.push(Array.isArray(h) ? { g: h[0] ?? 0, p: h[1] ?? 0, s: h[2] ?? 0 } : P.stateOn(pr, d));
  }
  const peak = Math.max(1, ...days.map((o) => o.p + o.s)), mid = y + LH / 2, base = y + LH - 1, hh = LH - 2;
  let gPath = '', pPath = `M${X(from)} ${base}`, sPath = `M${X(from)} ${base}`;
  days.forEach((o, i) => {
    const x = X(from + i), xn = x + dx, tot = o.g + o.p + o.s || 1;
    if (o.g > 0 && o.g / tot > 0.25) gPath += `M${x} ${mid}H${xn}`;
    const yp = base - hh * (o.p / peak), ys = base - hh * ((o.p + o.s) / peak);
    pPath += `L${x} ${yp}L${xn} ${yp}`; sPath += `L${x} ${ys}L${xn} ${ys}`;
  });
  pPath += `L${X(to + 1)} ${base}Z`; sPath += `L${X(to + 1)} ${base}Z`;
  const k = ghost ? ' ghost' : '';
  let svg = `<path class="g${k}" d="${gPath}"/><path class="s${k}" d="${sPath}"/><path class="p${k}" d="${pPath}"/>`;
  if (pr?.mid != null && pr.whisker > 0.4 && pr.mid <= to + 1) {
    const a = X(pr.mid - pr.whisker) + dx / 2, b = X(pr.mid + pr.whisker) + dx / 2, m = X(pr.mid) + dx / 2;
    svg += `<path class="wh" d="M${a} ${mid}H${b}M${a} ${mid - 3.5}V${mid + 3.5}M${b} ${mid - 3.5}V${mid + 3.5}"/><circle class="whm" cx="${m}" cy="${mid}" r="2.4"/>`;
  }
  if (pr && pr.late && (pr.mid == null || pr.mid > to - 4)) svg += `<text class="late" x="${X(to) - 2}" y="${mid + 3.5}">won't make it</text>`;
  else if (pr?.mid != null && pr.mid < from) svg += `<text class="early" x="${X(from) + 3}" y="${mid + 3.5}">◂ ripe ${label(pr.mid)}</text>`;
  return svg;
}
// The lanes' legend: the row's own weekends (never the whole plan's: the old "covers" bug) and its ripe day, give or take.
function legend(s: State, data: BarData) {
  const g = data.ghost, pr = data.rows.find((r) => r.row === ui.row && 'proj' in r && r.proj)?.proj, row = s.patch.rows[ui.row];
  const give = (w: number) => (w > 0.4 ? `, give or take ${Math.max(1, Math.round(w))} days` : '');
  let note;
  if (g) note = g.mid == null || g.late ? "Sown then, it <b class=\"bad\">won't be ripe in time</b>" : `Ripe ~<b>${label(g.mid)}</b>${give(g.whisker)} · for <b>${P.spanText(P.ghostTargets(s, g.v ?? ui.variety, ui.day ?? undefined)) || 'no weekend'}</b>`;
  else if (row?.stage === 'done') note = `Row ${ui.row + 1} is done for the year.`;
  else if (pr?.mid != null) note = `Row ${ui.row + 1}: ripe ~<b>${label(pr.mid)}</b>${give(pr.whisker)} · for <b>${P.spanText(P.rowTargets(s, ui.row)) || 'no weekend'}</b>`;
  else note = 'Every row, September to October.';
  return `<div class="fbar-legend"><span class="k g"></span>growing<span class="k p"></span>prime<span class="k s"></span>soft<span class="note">${note}</span></div>`;
}

// ---- the panel under the Table (a row's status), and the sticky foot with the one main action
function panel(n: HTMLElement | null, s: State, api: Api) {
  if (!n) return;
  n.innerHTML = '';
  if (tableMode(s)) return;
  const row = s.patch.rows[ui.row];
  if (!row || !row.open) { n.append(brambleNote(s)); return; }
  n.append(...statusPanel(s, api, row));
}
function brambleNote(s: State) {
  const it = own(T.shop, `row${ui.row + 1}`);
  return el('div.empty-note', { html: `${icon('lock')}<span>Overgrown with bramble. Clear it in the winter shop: <b>${money(it?.price ?? 0)}</b>${(it?.from ?? 0) > s.clock.year + 1 ? `, from year ${it?.from}` : ''}.</span>` });
}
function foot(n: HTMLElement | null, s: State, api: Api) {
  if (!n) return;
  n.innerHTML = '';
  if (!tableMode(s)) { const acts = storeActs(s, api); n.hidden = !acts.length; n.append(...acts); return; }
  n.hidden = false;
  const row = s.patch.rows[ui.row], sp = own(VT, ui.variety), r = ui.row + 1, now = ui.day === s.clock.day;
  const same = row?.plan && row.plan.day === ui.day && row.plan.variety === ui.variety;
  const lesson = P.lessonStep(s) === 'row1' && ui.row === 0 && ui.span?.[0] === 0;
  if (ui.day == null) {
    n.append(el('button.btn.primary.plant', { disabled: true }, el('span', { text: 'Pick a weekend' }), el('span.sub', { text: `Drag row ${r}'s ripe window, or tap a weekend` })));
  } else if (same) {
    // planned as shown: Done closes the Table (the clock runs again); clearing the plan is the small, separate button
    n.append(el('button.btn.small.tb-clear', { 'aria-label': `Clear row ${r}'s plan`, onclick: () => { api.dispatch({ type: 'patch/unplan', row: ui.row }); ui.day = null; ui.span = null; ui.sig = ''; api.sound('tick'); } },
      el('span', { text: 'Clear' })),
    el('button.btn.sage.plant', { onclick: () => api.closeSheet() }, el('span', { text: 'Done' }), el('span.sub', { text: `Row ${r} goes in on ${label(ui.day ?? 0)}` })));
  } else {
    n.append(el('button.btn.primary.plant', { class: lesson ? 'pulse' : null, 'data-target': 'patch:plant', disabled: (sp?.unlock ?? 0) > s.clock.year, onclick: () => plant(api, ui.row, ui.variety, ui.day) },
      el('span', { text: now ? `Plant row ${r} now` : row?.plan ? `Move row ${r} to ${label(ui.day ?? 0)}` : `Plant row ${r} on ${label(ui.day ?? 0)}` }),
      el('span.sub', { text: now ? `${nameOf(ui.variety)} · ${money(sp?.seed ?? 0)} seed` : `${nameOf(ui.variety)} · ${money(sp?.seed ?? 0)} that morning` })));
  }
}
// harvest and the store (from Sep 1): cut the row's ripe fruit to the barn, restock it from the barn. The barn habit that
// pays is on the button (design §13 "Prudence"): cut what would go soft before the next selling day, keep the rest on show.
const saleWord = (d: number) => `${dowName(d)} ${label(d)}`;
function storeActs(s: State, api: Api) {
  const row = s.patch.rows[ui.row], acts: HTMLElement[] = [];
  if (!row?.open || s.clock.day < SEP1 || !(s.unlocks.barn || s.clock.year > 1) || !live(s)) return acts;
  const k = row.stock, free = P.barnFree(s), n = Math.min(free, k.prime - (row.shiny ? 1 : 0)), bs = P.barnStock(s), adv = P.cutAdvice(s, ui.row);
  if (k.prime && !free) acts.push(el('button.btn.plant', { disabled: true }, el('span', { html: `${icon('barn', 's')} Barn full` }), el('span.sub', { text: `${P.barnCap(s)} is all it holds` })));
  else if (k.prime && adv && !weekendNow(s)) {
    acts.push(el('button.btn.primary.plant', { 'data-target': `row:${ui.row}`, onclick: () => storeAct(api, ui.row, 'cut', adv.n) },
      el('span', { html: `${icon('barn', 's')} Cut ${adv.n} going soft` }), el('span.sub', { text: `Or they rot before ${saleWord(adv.sale)}` })));
    if (adv.n < n) acts.push(el('button.btn.plant', { onclick: () => storeAct(api, ui.row, 'cut') }, el('span', { text: `Cut all ${n}` }), el('span.sub', { text: `Barn has room for ${free}` })));
  } else if (k.prime) {
    // nothing here goes soft before it sells: cutting is allowed, but the field is the store
    const keep = weekendNow(s) ? `Barn has room for ${free}` : `They'll keep on show till ${saleWord(P.nextSale(s.clock.day))}`;
    acts.push(el(weekendNow(s) ? 'button.btn.primary.plant' : 'button.btn.plant', { 'data-target': `row:${ui.row}`, disabled: n <= 0, onclick: () => storeAct(api, ui.row, 'cut') },
      el('span', { html: `${icon('barn', 's')} Cut ${Math.max(0, n)} → barn` }), el('span.sub', { text: keep })));
  }
  if (bs && s.clock.day >= OCT1) acts.push(el('button.btn.plant', { disabled: P.fullness(s, ui.row) >= 1, onclick: () => storeAct(api, ui.row, 'restock') },
    el('span', { html: `${icon('pumpkin', 's')} Restock ${Math.min(bs, TP.barn.restockN)}` }), el('span.sub', { text: `${bs} in the barn` })));
  return acts;
}
async function plant(api: Api, r: number, v: string, day: number | null) {
  const had = api.s()?.patch.rows[r]?.plan;
  if (had) api.dispatch({ type: 'patch/unplan', row: r, quiet: true });
  let res = api.dispatch({ type: 'patch/plant', row: r, variety: v, day, quiet: true });
  if (res.reason === 'early') res = api.dispatch({ type: 'patch/plant', row: r, variety: v, day, early: true, quiet: true });
  if (res.reason === 'replant') {
    if (!(await api.confirm(typeof res.confirm === 'string' ? res.confirm : '', { yes: 'Replant', no: 'Keep it', title: 'Gran says' }))) return;
    res = api.dispatch({ type: 'patch/plant', row: r, variety: v, day, early: true, replant: true, quiet: true });
  }
  if (!res.ok) {
    if (had) api.dispatch({ type: 'patch/plant', row: r, variety: had.variety, day: had.day, early: true, quiet: true });
    const why = res.reason ?? 'failed';
    api.toast(why.slice(0, 1).toUpperCase() + why.slice(1), 'bad'); api.sound('thunk'); return;
  }
  api.haptic(12); plinks(api, 3, 1);
  // move on to the next empty row, so planning a whole field is drag, Plant, drag, Plant
  const s = api.s();
  if (!s) return;
  const next = s.patch.rows.findIndex((row, i) => i !== r && row.open && !planted(row) && !row.plan);
  if (next >= 0 && s.clock.phase === 'grow') setTimeout(() => { const cur = api.s(); if (cur) select(cur, next, api); }, 450);
  ui.sig = '';
}
function meter(frac: number, cls = '') { return el('span.meter2', { class: cls || null }, el('i', { style: { width: `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%` } })); }
function statusPanel(s: State, api: Api, row: PatchRow) {
  const out: HTMLElement[] = [], pr = P.projectRow(s, ui.row), d = s.clock.day;
  const lines: string[] = [];
  if (planted(row)) {
    const st = own(stageWord, row.stage) || row.stage;
    let eta = '';
    if (pr?.mid != null && row.stage !== 'ripe' && row.stage !== 'done') eta = pr.late ? ' · <span class="warn">won\'t make it by Oct 25</span>' : ` · ripe ~<b>${label(pr.mid)}</b> for <b>${P.spanText(P.rowTargets(s, ui.row)) || 'late October'}</b>`;
    lines.push(`${icon('patch', 's')}<span><b>${st}</b>${row.stage === 'flowers' ? ' · bees visiting' : ''}${eta}</span>`);
    if (row.stage === 'ripe' && row.ripeDay != null) lines[0] = `${icon('patch', 's')}<span><b>Ripe</b> since ${label(row.ripeDay)}${pr?.cohorts?.some((c) => c.ripe > d) ? ' · more to come' : ''}</span>`;
    if (row.set) lines.push(`${icon('pumpkin', 's')}<span><b>${row.set}</b> fruit set${row.sprayed ? ' · no bee bonus (sprayed)' : row.beeFrac > 0 ? ` · bees +${Math.round(TP.bees.perHive * s.patch.hives * row.beeFrac * 100)}%` : ''}</span>`);
  }
  const k = row.stock;
  if (k.prime || k.soft || (k.green && row.set)) lines.push(`${icon('pumpkin', 's')}<span>Prime <b>${k.prime}</b> · green ${k.green} · soft ${k.soft}${k.rotten ? ` · <span class="warn">${k.rotten} rotting</span>` : ''}</span>`);
  const alerts: HTMLElement[] = [], bugSlot = ROW_PANELS.get('bugs');
  // the bug panel: track E's hunt fills this slot (registerRowPanel), else the three squish buttons and Spray
  const custom = row.bugs > 0 && bugSlot ? bugSlot(api, s, ui.row, row) : null;
  if (custom) alerts.push(custom);
  else if (row.bugs > 0) {
    alerts.push(el('div.alertbox.bugs', {}, el('div', { html: `<b>Squash bugs!</b> ${row.bugs >= 0.5 ? 'A big cluster.' : 'Squish them fast for a combo.'}` }),
      bugButtons(api, ui.row), el('button.btn.small', { onclick: () => doAct(api, { type: 'patch/spray', row: ui.row }) }, el('span', { text: `Spray · $${B.spray}` }), el('span.sub', { text: row.set ? 'Blocks bugs 14 days' : 'Voids this row\'s bee bonus' }))));
  }
  else if (performance.now() < (ui.bugsGone[ui.row] || 0)) alerts.push(el('div.alertbox.cleared', { html: '<b>Bugs gone!</b> Quick paws.', style: { minHeight: `${ui.bugBoxH || 0}px` } }));
  if (row.mildew > 0) {
    alerts.push(el('div.alertbox.mildew', {}, el('div', { html: `<b>Powdery mildew.</b> White dust; fruit goes soft sooner.` }),
      el('button.btn.small', { 'data-target': `row:${ui.row}`, onclick: () => doAct(api, { type: 'patch/milk', row: ui.row }) }, el('span', { text: `Milk spray · $${TP.mildew.spray}` }), el('span.sub', { text: 'Cures most of it; 10 days' }))));
  }
  out.push(...alerts, el('div.status', {}, lines.map((h) => el('div.st-line', { html: h }))));
  if (planted(row) && row.stage !== 'done') out.push(el('div.meters', {}, el('span.ml', { text: 'Health' }), meter(row.health, row.health < 0.8 ? 'warn' : 'good'),
    el('span.ml', { text: 'Water' }), meter(s.patch.moisture, s.patch.moisture < TP.moisture.dry ? 'bad' : '')));
  if (d >= OCT1 || k.prime) out.push(el('div.meters', {}, el('span.ml', { text: 'Fullness' }), meter(P.fullness(s, ui.row), P.fullness(s, ui.row) >= TP.fullness.good ? 'good' : P.fullness(s, ui.row) < TP.fullness.bad ? 'bad' : ''),
    el('span.mv', { text: `${Math.round(P.fullness(s, ui.row) * 100)}%` })));
  if (planted(row) && s.clock.phase === 'grow' && d < dayOf('Aug 1')) out.push(el('button.btn.ghost.small.replant', { onclick: () => { ui.sig = ''; resetPick(s); replantFlow(api, s); } }, el('span', { text: 'Pull it up and replant…' })));
  return out;
}
async function replantFlow(api: Api, s: State) {
  if (!(await api.confirm(P.LINES.gran.replant, { yes: 'Pull it up', no: 'Keep it', title: 'Gran says' }))) return;
  api.dispatch({ type: 'patch/plant', row: ui.row, variety: ui.variety, day: s.clock.day, early: true, replant: true });
  ui.sig = '';
}
function doAct(api: Api, a: Action) {
  const r = api.dispatch(a);
  if (r.ok) { api.sound(a.type === 'patch/milk' ? 'plink' : 'pop'); api.haptic(10); ui.sig = ''; }
  return r;
}
function storeAct(api: Api, r: number | null, what: string, n?: number) {
  const s = api.s();
  if (s && weekendNow(s) && rowHooks.weekend) { rowHooks.weekend(api, r ?? undefined, what); return; }
  const extra = n !== undefined && n > 0 ? { n } : {};
  if (what === 'cut' && r != null) doAct(api, { type: 'patch/cut', row: r, ...extra });
  else doAct(api, { type: 'patch/restock', row: r ?? undefined, ...extra });
}

// ------------------------------------------------------------ the Barn sheet
registerSheet('barn', {
  eyebrow: () => 'Cut fruit keeps about 3x longer here', title: (s) => `Barn · ${P.barnStock(s, null, { soft: true })}/${P.barnCap(s)}`,
  build(body, s, arg, api: Api) { this._sig = null; body.classList.add('barnsheet'); this.update?.(body, s, arg, api); afterInset(() => api.R?.cam?.frame?.('barn')); },
  update(body, s: State, _arg, api: Api) {
    const sig = `${s.clock.day}|${JSON.stringify(s.patch.barnLots)}|${s.patch.rows.map((r) => r.stock.prime).join(',')}|${s.cash >= 200}|${s.story.goal?.id}`;
    if (sig === this._sig) return;
    this._sig = sig;
    body.innerHTML = '';
    const cap = P.barnCap(s), total = P.barnStock(s, null, { soft: true });
    body.append(el('div.section', {}, el('div.meters', {}, el('span.ml', { text: 'Space' }), meter(total / cap, total >= cap ? 'bad' : ''), el('span.mv', { text: `${total}/${cap}` }))));
    // In October the barn is for restocking: the button sits above the fold (and pulses for Gran's W2 lesson) instead of
    // under the list of rows to cut, where a phone-height sheet hides it.
    const restock = P.barnStock(s) && s.clock.day >= SEP1 ? el('div.acts', {}, el('button.btn.primary.block', { class: s.story.goal?.id === 'restock' ? 'pulse' : null, data: { control: 'restock' }, onclick: () => storeAct(api, null, 'restock') }, el('span', { html: `${icon('pumpkin', 's')}Restock the emptiest row` }), el('span.sub', { text: `${TP.barn.restockN} from the barn` }))) : null;
    if (restock && s.clock.phase === 'october') body.append(restock);
    const lots = s.patch.barnLots.slice().sort((a, b) => b.age - a.age);
    body.append(el('div.section', {}, el('div.eyebrow', { text: 'In the barn' }), lots.length ? lots.map((l) => {
      const left = l.st === 'prime' ? Math.max(0, Math.round(((own(VT, l.v)?.prime ?? 0) - l.age) / TP.aging.barn)) : 0;
      return el('div.row-item', {}, dot(l.v), el('div.grow', {}, el('div.title', { text: `${l.n} ${nameOf(l.v)}${l.tr ? ' · trucked in' : ''}` }),
        el('div.desc', { html: l.st === 'prime' ? `Prime for about ${left} more days` : '<span class="warn">Gone soft: half price</span>' })));
    }) : el('div.empty-note', { html: `${icon('barn')}<span>Empty. Cut ripe rows to the barn before they go soft.</span>` })));
    // rows to cut, and the restock button
    // the rows going soft come first and their Cut takes just those; the rest can wait on show
    const rows = s.patch.rows.map((row, r): [PatchRow, number, ReturnType<typeof P.cutAdvice>] => [row, r, weekendNow(s) ? null : P.cutAdvice(s, r)])
      .filter(([row]) => row.stock.prime > 0).sort((a, b) => (b[2] ? 1 : 0) - (a[2] ? 1 : 0));
    if (rows.length && s.clock.day >= SEP1) body.append(el('div.section', {}, el('div.eyebrow', { text: 'Ripe in the field' }), rows.map(([row, r, adv]) => el('div.row-item', {}, dot(P.displayVariety(row)),
      el('div.grow', {}, el('div.title', { text: `Row ${r + 1} · ${row.stock.prime} prime` }),
        el('div.desc', { html: adv ? `<span class="warn">${adv.n} go soft before ${saleWord(adv.sale)}</span>` : `${Math.round(P.fullness(s, r) * 100)}% full · keeps on show` })),
      el(adv ? 'button.btn.small.primary' : 'button.btn.small', { 'data-target': `row:${r}`, disabled: !P.barnFree(s), onclick: () => storeAct(api, r, 'cut', adv?.n) }, el('span', { text: adv ? `Cut ${adv.n}` : 'Cut' }))))));
    if (restock && s.clock.phase !== 'october') body.append(restock);
    if (s.clock.year >= TP.trucked.menuFromYear && s.clock.day >= SEP1) body.append(el('div.section', {}, el('div.eyebrow', { text: 'The Parking Lot Patch' }),
      el('div.row-item', {}, el('div.grow', {}, el('div.title', { text: `40 Classics · ${money(T.events.cat.parking_lot_offer.price)}` }), el('div.desc', { text: "In the barn tomorrow. Folks might notice they're from the valley." })),
        el('button.btn.small', { onclick: () => doAct(api, { type: 'patch/order', lots: 1 }) }, el('span', { text: 'Order' })))));
  },
});

// ------------------------------------------------------------ the Hives sheet
registerSheet('hives', {
  eyebrow: () => 'They look after themselves', title: (s: State) => `Hives · ${s.patch.hives}`,
  build(body, s, arg, api: Api) { this._sig = null; body.classList.add('hivesheet'); this.update?.(body, s, arg, api); afterInset(() => api.R?.cam?.frame?.('hives')); },
  update(body, s: State, _arg, api: Api) {
    const sig = `${s.clock.day}|${Math.floor(s.patch.honeyReady)}|${s.patch.honeyJars}|${s.patch.hives}|${s.weather.f}`;
    if (sig === this._sig) return;
    this._sig = sig;
    body.innerHTML = '';
    const ready = Math.floor(s.patch.honeyReady), out = s.weather.f < TP.bees.f;
    body.append(el('div.today', {}, el('div.glyph', { html: icon('hives') }), el('div', {},
      el('div.big', { html: `${ready} <small>jar${ready === 1 ? '' : 's'} ready</small>` }),
      el('div.muted', { text: out ? `Bees are out: Marlene's at ${Math.round(s.weather.f * 100)}%.` : `Bees are home: too foggy (${Math.round(s.weather.f * 100)}%). They fly under 60%.` }))));
    body.append(el('div.acts', {}, el('button.btn.primary.block', { disabled: ready < 1, onclick: () => collectHoney(api) }, el('span', { html: `${icon('hives', 's')}Collect honey` }), el('span.sub', { text: `${s.patch.honeyJars} on the stand shelf, $${TP.hives.honeyPrice} each in October` }))));
    const rows = s.patch.rows.map((row, r): [PatchRow, number] => [row, r]).filter(([row]) => planted(row) && (row.beeDays || row.set));
    body.append(el('div.section', {}, el('div.eyebrow', { text: 'Bee bonus by row' }), rows.length ? rows.map(([row, r]) => {
      const frac = row.sprayed ? 0 : row.set ? row.beeFrac : row.beeDays ? row.beeGood / row.beeDays : 0;
      return el('div.row-item', {}, dot(row.variety), el('div.grow', {}, el('div.title', { text: `Row ${r + 1} · +${Math.round(TP.bees.perHive * s.patch.hives * frac * 100)}% fruit` }),
        el('div.desc', { text: row.sprayed ? 'Sprayed: the bees stay away' : row.set ? `Bees came on ${Math.round(frac * 100)}% of its flowering days` : `Flowering now: ${row.beeGood} good bee days of ${row.beeDays}` })));
    }) : el('div.empty-note', { html: `${icon('sun')}<span>Rows flower about six weeks after planting. Bees work them on days under 60% fog.</span>` })));
  },
});
