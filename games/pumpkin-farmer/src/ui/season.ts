// The season slice's UI [slice: season] (design §7, §12): the RING UP thumb button (queue badge, Rush ×n) and "Back to
// the stand" when your farmer is away; the weekend station bar (Stand · Giant · Patch · Barn · Lot: tapping a station
// sends your farmer sprinting there and opens its sheet); the Stand and Route 46 (Lot) sheets; [?] want bubbles with a
// Fetch-from-barn / Try ___ chooser; pins for stray wagons, the lost joey, Pamela, the runaway pumpkin and friends; the
// morning card (Y2+: price board, shuttle, radio) and the evening card; the receipt that stamps in on every RING UP; and
// the sounds and haptics that make a busy Saturday feel like one.
import { REG, registerSheet, registerStation, registerFab, registerTap, registerEvent, registerCard } from './registry.js';
import { $, el, icon, fmt } from './dom.js';
import { genericCard } from './cards.js';
import { portraitEl } from './dialog.js';
import { rowHooks } from './patch.js';
import { T } from '../sim/tuning.js';
import { rowZ } from '../sim/layout.js';
import { getActive, isActive } from '../sim/events.js';
import { LINES, SPECIES } from '../sim/story.js';
import { clockLabel, dowName, weekendIndex } from '../sim/calendar.js';
import { chip } from '../sim/weather.js';
import * as P from '../sim/patch.js';
import { own } from '../sim/util.js';
import { weekendNow, atStand, queueReady, roadMeter, haulRow } from '../sim/season.js';
import type { State } from '../sim/types.js';
import type { Api, PinDef, WeekendHook } from './types.js';
import type { Hit } from '../render/types.js';
import type { Family } from '../sim/state.js';

declare global {
  interface Window { webkitAudioContext?: typeof AudioContext }
}

const S = T.season, VT = T.varieties, L = LINES.season, NAMES = P.LINES.names;
const COL: Record<string, string> = { classic: '#d8762c', mini: '#eaa04a', white: '#e8e1cf', warty: '#c8a24c', cinderella: '#c4532a', blue: '#93a7a6' };
const dot = (v: string | undefined) => el('span.vdot', { style: { background: COL[v ?? ''] || 'var(--line)' } });
const money = (n: number) => fmt.money(n);
const met = (s: State) => !!(s.unlocks.ringup || s.clock.year > 1);                 // the stand's weekend verbs are live
const unlocked = (s: State, flag: string) => !!(own(s.unlocks, flag) || s.clock.year > 1);
const rushOn = (s: State) => s.season.you.rush >= 2 && s.clock.minute - s.season.you.last <= S.rush.window;
const afterInset = (fn: FrameRequestCallback) => requestAnimationFrame(() => requestAnimationFrame(fn));
const go = (api: Api, to: string, row?: number) => api.dispatch({ type: 'season/go', to, row, quiet: true });

// ------------------------------------------------------------ little sounds of our own (Hal's howl, the till's drawer)
let ac: AudioContext | null = null;
function sfx(api: Api, kind: string, pitch = 1) {
  if (!api.settings.sound) return;
  try {
    const AC: typeof AudioContext | undefined = globalThis.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    ac ||= new AC();
    if (ac.state === 'suspended') void ac.resume();
    const t0 = ac.currentTime, g = ac.createGain(), o = ac.createOscillator();
    g.connect(ac.destination); o.connect(g);
    if (kind === 'howl') {                         // "Awooo": a rising, wavering sine
      o.type = 'sine'; o.frequency.setValueAtTime(330 * pitch, t0); o.frequency.exponentialRampToValueAtTime(620 * pitch, t0 + 0.35);
      o.frequency.exponentialRampToValueAtTime(480 * pitch, t0 + 1.0);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 6; lg.gain.value = 14; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t0); lfo.stop(t0 + 1.1);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.05);
    } else if (kind === 'drawer') {                // the cash drawer slides out under the ching
      o.type = 'triangle'; o.frequency.setValueAtTime(220, t0); o.frequency.exponentialRampToValueAtTime(110, t0 + 0.09);
      g.gain.setValueAtTime(0.08, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    } else if (kind === 'honk') {
      o.type = 'square'; o.frequency.setValueAtTime(392, t0);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    }
    o.start(t0); o.stop(t0 + 1.2);
  } catch { /* audio is best effort */ }
}

// ------------------------------------------------------------ RING UP: the thumb button
function ringUp(api: Api) {
  const r = api.dispatch({ type: 'season/ringUp', quiet: true });
  api.markTouched();
  if (!r.ok) { api.toast(`${(r.reason ?? 'no')[0]?.toUpperCase() ?? ''}${(r.reason ?? '').slice(1)}`, ''); api.sound('tick'); return; }
  if (r.buffered) { api.haptic(6); api.sound('tick'); }
}
registerFab({
  id: 'ringup', priority: 20, icon: () => 'coin',
  when: (s) => weekendNow(s) && met(s) && atStand(s),
  label: (s: State) => (rushOn(s) ? `Rush ×${s.season.you.rush}` : 'Ring up'),
  badge: (s: State) => s.season.queue.length || null,
  cls: (s) => (rushOn(s) ? 'season-rush' : queueReady(s) ? 'season-ready' : ''),
  onTap: ringUp,
});
registerFab({
  id: 'standback', priority: 19, icon: () => 'back',
  when: (s) => weekendNow(s) && met(s) && !atStand(s),
  label: (s: State) => (s.season.farmer.tasks.some((t) => t.k === 'go' && t.to === 'stand') ? 'On way' : 'To stand'),
  badge: (s: State) => s.season.queue.length || null,
  cls: (s: State) => `sage${s.season.queue.length >= 3 ? ' season-urgent' : ''}`,
  onTap: (api) => { if (go(api, 'stand').ok) api.haptic(10); },
});

// ------------------------------------------------------------ the receipt that stamps in on every RING UP
function receipt(api: Api, ev: { id: number; rush: number; amount: number; tips: number }) {
  const s = api.s(), f = s?.season.families.find((x) => x.id === ev.id);
  const items: Record<string, number> = {};
  for (const c of f?.cart || []) { const k = `${c.v}${c.soft ? ' (soft)' : ''}`; items[k] = (items[k] || 0) + 1; }
  const box = el('div.season-receipt', { 'aria-hidden': 'true' },
    el('div.rhead', { text: f ? `${own(SPECIES, f.species)?.one ?? f.species} family` : 'Sold' }),
    ...Object.entries(items).map(([k, n], i) => el('div.ritem', { style: { animationDelay: `${60 + i * 70}ms` } }, dot(k.split(' ')[0]), el('span', { text: `${own(NAMES, k.split(' ')[0] ?? '') || k}${k.includes('soft') ? ' (soft)' : ''}${n > 1 ? ` ×${n}` : ''}` }))),
    ev.rush >= 2 ? el('div.rrush', { text: `Rush ×${ev.rush} · tip ${money(ev.tips)}` }) : null,
    el('div.rtotal', {}, el('span', { text: 'Total' }), el('b', { text: money(ev.amount) })));
  $('#game-ui')?.append(box);
  const old = [...document.querySelectorAll('.season-receipt')];
  old.slice(0, -3).forEach((n) => n.remove());
  old.forEach((n, i) => { if (n instanceof HTMLElement) n.style.setProperty('--stack', String(old.length - 1 - i)); });
  setTimeout(() => { box.classList.add('out'); setTimeout(() => box.remove(), 350); }, 1300);
}

// ------------------------------------------------------------ stations (design §12: Stand · Patch · Barn · Giant · Lot)
registerStation({ id: 'stand', label: 'Stand', icon: 'stand', order: 5, key: 't', sheet: 'stand',
  visible: (s) => weekendNow(s) && met(s), badge: (s: State) => (s.season.queue.length || null),
  onTap: (api: Api) => { go(api, 'stand'); api.openSheet('stand'); } });
registerStation({ id: 'lot', label: 'Lot', icon: 'lot', order: 40, key: 'l', sheet: 'lot',
  visible: (s) => weekendNow(s) && unlocked(s, 'route46'), badge: (s: State) => (s.season.road.q >= S.road.amber ? s.season.road.q : null),
  onTap: (api: Api) => { go(api, 'lot'); api.openSheet('lot'); } });
// On weekends the other slices' stations and taps send your farmer too (they still open their own sheets).
function weekendWrap(kind: string, id: string, dest: (s: State | null, hit?: Hit) => [to: string, row?: number]) {
  const defs = kind === 'station' ? REG.stations : null;
  const def = defs ? defs.find((d) => d.id === id) : null;
  if (kind === 'station' && def) {
    const orig = def.onTap;
    def.onTap = (api: Api) => { const s = api.s(); if (s && weekendNow(s) && met(s)) go(api, ...dest(s)); orig(api); };
  }
  if (kind === 'tap') {
    const orig = REG.taps.get(id);
    registerTap(id, (hit, api: Api, e) => { const s = api.s(); if (s && weekendNow(s) && met(s)) go(api, ...dest(s, hit)); orig?.(hit, api, e); });
  }
}
weekendWrap('station', 'patch', () => ['patch']);
weekendWrap('station', 'barn', () => ['barn']);
weekendWrap('station', 'giant', () => ['giant']);
weekendWrap('tap', 'row', (_s, hit) => ['row', typeof hit?.id === 'number' ? hit.id : undefined]);
weekendWrap('tap', 'barn', () => ['barn']);
weekendWrap('tap', 'giant', () => ['giant']);
registerTap('stand', (_hit, api) => { const s = api.s(); if (s && weekendNow(s) && met(s)) { go(api, 'stand'); api.openSheet('stand'); } });
registerTap('lot', (_hit, api) => { const s = api.s(); if (s && weekendNow(s) && unlocked(s, 'route46')) { go(api, 'lot'); api.openSheet('lot'); } });
// the Row and Barn sheets' Cut / Restock buttons: on weekends your farmer has to walk there (design §7)
let haul: { t: number } | null = null;                               // a restock the player ordered: the camera shows it land (design §13 "Restock")
const weekendHooks: { weekend: WeekendHook | null } = rowHooks;
weekendHooks.weekend = (api, row, what) => {
  const r = what === 'cut'
    ? api.dispatch({ type: 'season/cut', row: typeof row === 'number' ? row : -1, quiet: true })
    : api.dispatch({ type: 'season/restock', ...(typeof row === 'number' ? { row } : {}), quiet: true });
  if (!r.ok) { api.toast(`${(r.reason ?? 'no')[0]?.toUpperCase() ?? ''}${(r.reason ?? '').slice(1)}`, 'bad'); api.sound('thunk'); return; }
  api.haptic(10); api.sound('pop');
  api.toast(what === 'cut' ? 'On it: cutting ripe fruit to the barn.' : 'On it: loading 12 at the barn.', '', what === 'cut' ? 'barn' : 'pumpkin');
  // the order is given: the sheet steps aside so you can watch the wagon go
  if (what === 'restock') { haul = { t: performance.now() }; if (api.currentSheet() === 'barn' || api.currentSheet() === 'row') api.closeSheet(); }
};
// frame the barn door and the row's end together as the wagon is loaded, so the fruit pop into the row on screen (unless
// you've moved the camera since)
const BARN_DOOR = { x: -14, z: -11.2 }, ROW_END = -6;
function frameHaul(api: Api, row: number | null | undefined) {
  const cam = api.R?.cam;
  if (!haul || row == null || !cam?.zoomFor || (cam.touchedAt ?? 0) > haul.t) return;
  const z = rowZ(row);
  api.glide((BARN_DOOR.x + ROW_END) / 2, (BARN_DOOR.z + z) / 2, cam.zoomFor(Math.max(14, Math.hypot(ROW_END - BARN_DOOR.x, z - BARN_DOOR.z) + 4)), 800);
}
// the foghorn three times in five seconds: coyote pups howl back, skunks startle
{
  const orig = REG.taps.get('toy'), taps: number[] = [];
  registerTap('toy', (hit, api: Api, e) => {
    orig?.(hit, api, e);
    if (hit.id !== 'lighthouse') return;
    const now = performance.now();
    taps.push(now);
    while (taps.length && now - (taps[0] ?? 0) > T.events.cat.skunk_startle.foghornSeconds * 1000) taps.shift();
    if (taps.length >= T.events.cat.skunk_startle.foghornTaps) { taps.length = 0; api.dispatch({ type: 'season/foghorn', quiet: true }); }
  });
}

// ------------------------------------------------------------ world taps on the crowd and its troubles
registerTap('family', (hit, api: Api) => openAsk(api, typeof hit.id === 'number' ? hit.id : null));
registerTap('wagon', (hit, api: Api) => { if (api.dispatch({ type: 'season/stray', id: String(hit.id), quiet: true }).ok) { api.haptic(10); api.sound('pop'); } });
registerTap('goat', (_hit, api: Api) => chase(api, 'goat'));
registerTap('joey', (_hit, api: Api) => chase(api, 'lost_joey'));
registerTap('runaway', (_hit, api: Api) => catchRunaway(api));
function chase(api: Api, id: string) {
  const r = api.dispatch({ type: 'season/chase', id, quiet: true });
  if (r.ok) { api.haptic(12); api.sound('pop'); } else api.toast(`${(r.reason ?? 'no')[0]?.toUpperCase() ?? ''}${(r.reason ?? '').slice(1)}`, '');
}
function catchRunaway(api: Api) {
  if (api.dispatch({ type: 'events/tap', id: 'runaway_pumpkin' }).ok) { api.sound('bark'); api.haptic(16); }
}

// ------------------------------------------------------------ pins (our own SVGs: wagon, goat, joey, [?])
const SVG = {
  wagon: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 9.5h13l-1.2 5.5H4.7z"/><path d="M16.5 10.5l4-3"/><circle cx="7" cy="17.8" r="1.8"/><circle cx="13.5" cy="17.8" r="1.8"/></svg>',
  goat: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5c-1.5-1-3-1-4 0M16 5c1.5-1 3-1 4 0"/><path d="M7 7.5c0-1.5 2.2-3 5-3s5 1.5 5 3v4.5c0 3-2.2 6-5 6s-5-3-5-6z"/><path d="M10 18.5l.5 2.5h3l.5-2.5"/><circle cx="9.7" cy="10.3" r="0.9" fill="currentColor"/><circle cx="14.3" cy="10.3" r="0.9" fill="currentColor"/></svg>',
  joey: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="2.6"/><circle cx="17" cy="7" r="2.6"/><path d="M5.5 12c0-3 3-5 6.5-5s6.5 2 6.5 5-2.5 7-6.5 8C8 19 5.5 15 5.5 12z"/><circle cx="9.6" cy="12" r="0.9" fill="currentColor"/><circle cx="14.4" cy="12" r="0.9" fill="currentColor"/><path d="M11 15.5h2"/></svg>',
  ask: (v: string | number | undefined) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8.6 8.4a3.4 3.4 0 1 1 4.8 3.1c-.9.4-1.4 1.2-1.4 2.1v.6"/><path d="M12 18.2v.3"/></svg><span class="season-askdot" style="background:${COL[String(v ?? '')] || 'var(--line)'}"></span>`,
};
const answering = (s: State, f: Family) => s.season.farmer.tasks.some((t) => t.fam === f.id && (t.k === 'fetch' || t.k === 'try'));
const askers = (s: State) => (unlocked(s, 'wants') ? s.season.families.filter((f) => f.state === 'want' && f.bubble?.kind === 'want' && !answering(s, f)) : []);
const famPos = (f: Family, y = 2.3): { x: number; y: number; z: number } | null => (f ? { x: f.x, y, z: f.z } : null);
const pinDefs: PinDef[] = [];
const PLACES_GIANT = { x: -12.4, z: 9 };
const pin = (def: PinDef) => { pinDefs.push(def); REG.pins.push(def); };
for (let k = 0; k < 5; k++) {
  pin({ id: `want-${k}`, icon: '', svg: (s: State) => SVG.ask(askers(s)[k]?.bubble?.v ?? undefined), label: `They can't find what they want (${k + 1})`, urgent: () => true,
    when: (s: State) => weekendNow(s) && !!askers(s)[k], pos: (s: State) => { const f = askers(s)[k]; return f ? famPos(f) : null; }, onTap: (api: Api) => { const s = api.s(); const f = s ? askers(s)[k] : undefined; if (f) openAsk(api, f.id); } });
}
for (let k = 0; k < 3; k++) {
  pin({ id: `stray-${k}`, icon: '', svg: () => SVG.wagon, label: `Fetch the stray wagon (${k + 1})`, urgent: (s: State) => s.season.wagons.free === 0,
    when: (s: State) => weekendNow(s) && unlocked(s, 'wagons') && !!s.season.wagons.strays[k], pos: (s: State) => { const w = s.season.wagons.strays[k]; return w ? { x: w.x, y: 0.9, z: w.z } : null; },
    onTap: (api: Api) => { const w = api.s()?.season.wagons.strays[k]; if (w && api.dispatch({ type: 'season/stray', id: w.id ?? '', quiet: true }).ok) { api.haptic(10); api.sound('pop'); } } });
}
const joeyPin = (s: State) => { const a = getActive(s, 'lost_joey'); return a && typeof a.data?.bark === 'number' && s.clock.minute >= a.data.bark ? a : null; };
pin({ id: 'lost_joey', icon: '', svg: () => SVG.joey, label: 'Find the joey!', urgent: () => true,
  when: (s: State) => weekendNow(s) && !!joeyPin(s), pos: (s: State) => { const a = joeyPin(s); return a && a.x != null && a.z != null ? { x: a.x, y: 1.1, z: a.z } : null; }, onTap: (api: Api) => chase(api, 'lost_joey') });
pin({ id: 'goat', icon: '', svg: () => SVG.goat, label: 'Shoo Pamela (she dodges)', urgent: () => true,
  when: (s: State) => weekendNow(s) && !!s.season.goat, pos: (s: State) => (s.season.goat ? { x: s.season.goat.x, y: 1.4, z: s.season.goat.z } : null), onTap: (api: Api) => chase(api, 'goat') });
pin({ id: 'runaway', icon: 'pumpkin', label: 'Runaway pumpkin! Tap: Biscuit fetches it', urgent: () => true,
  when: (s: State) => weekendNow(s) && !!s.season.runaway, pos: (s: State) => (s.season.runaway ? { x: s.season.runaway.x, y: 0.9, z: -3.9 } : null), onTap: catchRunaway });
pin({ id: 'toddler', icon: 'giant', label: "A toddler wants a photo with your giant: run over and pose", urgent: () => true,
  when: (s: State) => weekendNow(s) && isActive(s, 'toddler_giant'), pos: () => ({ x: PLACES_GIANT.x, y: 2.4, z: PLACES_GIANT.z }), onTap: (api: Api) => chase(api, 'toddler_giant') });
pin({ id: 'proposal', icon: 'sparkle', label: 'A proposal in the patch: give them the row', urgent: () => true,
  when: (s: State) => weekendNow(s) && isActive(s, 'proposal'), pos: (s: State) => { const a = getActive(s, 'proposal'); return a && a.x != null && a.z != null ? { x: a.x, y: 1.8, z: a.z } : null; }, onTap: (api: Api) => chase(api, 'proposal') });
pin({ id: 'dez', icon: 'stand', label: "Dez is 'on break' in the hay fort: fetch him",
  when: (s: State) => weekendNow(s) && isActive(s, 'dez_wanders'), pos: () => ({ x: -8.2, y: 1.9, z: -11.6 }), onTap: (api: Api) => chase(api, 'dez_wanders') });
// pins.js draws an icon by name; ours get their own SVG and a data-target so the Next-up chip can point at them
function paintPins(s: State) {
  for (const def of pinDefs) {
    const n = def.label ? document.querySelector(`#pins .pin[aria-label="${CSS.escape(def.label)}"]`) : null;
    if (!(n instanceof HTMLElement)) continue;
    n.dataset.target = `pin:${def.id}`;
    n.classList.add('season-pin');
    if (!def.svg) continue;
    const svg = def.svg(s);
    if (svg && n.dataset.svg !== svg) { n.dataset.svg = svg; n.innerHTML = svg + '<span class="arrow"></span>'; }
  }
}

// ------------------------------------------------------------ the [?] chooser: Fetch from barn, or Try ___
let ask: { node: HTMLElement; api: Api; id: number | null } | null = null;
function openAsk(api: Api, id: number | null) {
  const s = api.s(), f = s?.season.families.find((x) => x.id === id);
  if (!s || !f?.bubble || f.bubble.kind !== 'want' || !unlocked(s, 'wants')) return;
  closeAsk();
  api.dispatch({ type: 'season/answer', id: f.id, choice: 'look', quiet: true });   // they wait a moment while you choose
  api.markTouched(); api.haptic(10); api.sound('pop');
  const w0 = f.wants.find((x) => x.st === 'open'), w = w0?.v ?? f.bubble.v ?? '', wkid = w0?.kid ?? false;
  const inBarn = P.barnStock(s, w);
  const tries = Object.keys(VT).filter((v) => v !== w && P.rowsWithPrime(s, v).length && (wkid ? true : !!own(VT, v)?.large)).slice(0, 3);
  const choose = (choice: string) => {
    const r = api.dispatch({ type: 'season/answer', id: f.id, choice, quiet: true });
    if (!r.ok) { api.toast(`${(r.reason ?? 'no')[0]?.toUpperCase() ?? ''}${(r.reason ?? '').slice(1)}`, 'bad'); api.sound('thunk'); return; }
    api.haptic(14); api.sound('plink', { pitch: 1.2 });
    closeAsk();
  };
  const node = el('div.season-ask.card', { role: 'dialog', 'aria-label': 'What to do about it' },
    el('div.ahead', {}, dot(w), el('span', { html: `${wkid ? 'A kid wants' : 'They want'} <b>${own(NAMES, w) ?? w}</b>` })),
    // the sure thing is the primary choice when the barn has it; otherwise the first suggestion is
    el(inBarn ? 'button.btn.primary' : 'button.btn', { disabled: !inBarn, onclick: () => choose('fetch') }, el('span', { html: `${icon('barn', 's')} Fetch from barn` }),
      el('span.sub', { text: inBarn ? `${inBarn} in the barn · sure thing` : `None in the barn` })),
    ...tries.map((v, i) => el(!inBarn && i === 0 ? 'button.btn.primary' : 'button.btn', { onclick: () => choose(v) }, el('span', {}, dot(v), ` Try ${own(NAMES, v) ?? v}`),
      el('span.sub', { text: `${f.type === 'regular' ? 85 : 70}% say yes` }))),
    tries.length ? null : el('div.muted.small', { text: 'Nothing else in the field to offer.' }));
  $('#pins')?.append(node);
  ask = { id, node, api };
  placeAsk();
}
function closeAsk() { ask?.node.remove(); ask = null; }
function placeAsk() {
  if (!ask) return;
  const s = ask.api.s(), f = s?.season.families.find((x) => x.id === ask?.id);
  if (!s || !f || f.state !== 'want' || !f.bubble || answering(s, f)) { closeAsk(); return; }
  const p = ask.api.R?.project?.(f.x, 2.2, f.z);
  if (!p) return;
  const w = ask.node.offsetWidth || 220, h = ask.node.offsetHeight || 160;
  const top = ($('#hud')?.getBoundingClientRect().bottom || 60) + 8, bottom = ($('#tray')?.getBoundingClientRect().top || innerHeight) - 8;
  const x = Math.max(8, Math.min(innerWidth - w - 8, p.x - w / 2)), y = Math.max(top, Math.min(bottom - h, p.y - h - 30));
  ask.node.style.transform = `translate(${x}px, ${y}px)`;
}
addEventListener('pointerdown', (e) => { if (ask && e.target instanceof Element && !e.target.closest('.season-ask, .pin')) closeAsk(); }, { capture: true });

// ------------------------------------------------------------ the Stand sheet
const statBox = (n: string | number, label: string, cls?: string | undefined) => el('div.season-stat', { class: cls || null }, el('b', { text: n }), el('span', { text: label }));
const stars = (n: number) => '★★★★★'.slice(0, Math.max(1, Math.min(5, Math.round(n)))) + '☆☆☆☆☆'.slice(0, 5 - Math.max(1, Math.min(5, Math.round(n))));
let standSig: string | null = null;
registerSheet('stand', {
  eyebrow: (s: State) => `${clockLabel(s.clock.minute)} · ${dowName(s.clock.day, true)}`,
  title: () => 'The stand',
  build(body, s, arg, api: Api) { standSig = null; body.classList.add('season-sheet'); this.update?.(body, s, arg, api); afterInset(() => api.R?.cam?.frame?.('stand')); },
  update(body, s: State, _arg, _api) {
    const se = s.season, d = se.day;
    const sig = `${se.queue.length}|${d.served}|${d.byYou}|${Math.round(d.rev)}|${se.reviews[0]?.m}|${atStand(s)}|${s.patch.honeyJars}|${se.tier}|${d.walkoffs}`;
    if (sig === standSig) return;
    standSig = sig;
    body.innerHTML = '';
    body.append(el('div.season-stats', {}, statBox(se.queue.length, 'in line', se.queue.length >= 4 ? 'bad' : ''), statBox(d.served, 'served'),
      statBox(money(d.rev), 'today'), statBox(d.walkoffs, 'gave up', d.walkoffs ? 'bad' : '')));
    body.append(el('div.section', {}, el('div.st-line', { html: atStand(s)
      ? `${icon('coin', 's')}<span>You're at the till. <b>RING UP</b> serves the front family at once; serve again within 1.5 s for a <b>Rush</b>.</span>`
      : `${icon('back', 's')}<span>You're away. Gran rings up one family every few seconds${se.gran.direct ? ' (not now: she\'s on Route 46)' : ''}.</span>` })));
    const extras: string[] = [];
    if (s.clock.year >= S.tiers.fromYear) extras.push(`Prices: <b>${(se.tier[0] ?? '').toUpperCase() + se.tier.slice(1)}</b>`);
    extras.push(`Honey on the shelf: <b>${s.patch.honeyJars}</b>`);
    if (s.patch.shinies.some((x) => x.state === 'display')) extras.push('A shiny on display: folks smile at the till');
    if (s.hires?.dez === s.clock.year) extras.push(se.dez.away ? "Dez is 'on break'" : 'Dez is on register two');
    body.append(el('div.section', {}, el('div.muted', { html: extras.join(' · ') })));
    if (se.reviews.length) body.append(el('div.section', {}, el('div.eyebrow', { text: 'Reviews' }), ...se.reviews.slice(0, 5).map((r) =>
      el('div.season-review', {}, el('span.stars', { text: stars(r.stars) }), el('span.who', { text: own(SPECIES, r.species)?.one ?? r.species }), el('span', { text: r.text })))));
  },
});

// ------------------------------------------------------------ the Lot sheet: Route 46 and the levers
let lotSig: string | null = null;
registerSheet('lot', {
  eyebrow: (s: State) => `${s.season.road.q} waiting on Route 46 · ${s.season.road.turned} turned around`,
  title: () => 'Route 46',
  build(body, s, arg, api: Api) { lotSig = null; body.classList.add('season-sheet'); this.update?.(body, s, arg, api); afterInset(() => api.R?.cam?.frame?.('lot')); },
  update(body, s: State, _arg, api: Api) {
    const se = s.season, P2 = se.parking, pend = (id: string | null) => se.farmer.tasks.some((t) => t.k === 'lever' && t.id === id);
    const sig = `${se.road.q}|${se.road.turned}|${P2.used}|${P2.cap}|${P2.beachOpen}|${se.gran.direct}|${se.halUntil > s.clock.minute}|${pend('beach')}|${pend('gran')}|${se.farmer.at}`;
    if (sig === lotSig) return;
    lotSig = sig;
    body.innerHTML = '';
    const m = roadMeter(s), lvl = se.road.q >= S.road.red ? 'bad' : se.road.q >= S.road.amber ? 'warn' : 'good';
    body.append(el('div.season-meter', { class: lvl }, el('div.bar', {}, el('i', { style: { width: `${Math.round(m * 100)}%` } })),
      el('div.lbl', {}, el('b', { text: `${se.road.q} car${se.road.q === 1 ? '' : 's'} waiting` }), el('span', { text: `Parking ${P2.used}/${P2.cap}` }))));
    const lever = (id: string, title: string, desc: string, on: boolean, btn: string, sub: string, cls?: string | undefined) => el('div.row-item', {}, el('div.grow', {}, el('div.title', { text: title }), el('div.desc', { text: desc })),
      el('button.btn.small', { class: cls || null, 'data-target': `lever:${id}`, disabled: pend(id), onclick: () => lever2(api, id, !on) }, el('span', { text: pend(id) ? 'On the way…' : btn }), sub ? el('span.sub', { text: sub }) : null));
    body.append(el('div.section', {},
      lever('beach', 'Beach overflow lot', `+${T.season.parking.beach} spaces. Sand in the hubcaps (−3); pelicans love it.`, P2.beachOpen, P2.beachOpen ? 'Close it' : 'Open it', 'You walk there', P2.beachOpen ? '' : 'primary'),
      lever('gran', 'Gran directs traffic', '+3 spaces and calmer drivers, but Gran stops ringing up.', se.gran.direct, se.gran.direct ? 'Call her back' : 'Send Gran', 'You walk there'),
      el('div.row-item', {}, el('div.grow', {}, el('div.title', { text: "Tell Hal we're full" }), el('div.desc', { text: 'Half as many arrivals for an hour. No hard feelings.' })),
        el('button.btn.small', { disabled: se.halUntil > s.clock.minute, onclick: () => lever2(api, 'hal') }, el('span', { text: se.halUntil > s.clock.minute ? 'On air' : 'Call KQSC' }), el('span.sub', { text: 'A phone call' })))));
    const notes: string[] = [];
    if (se.shuttleOn) notes.push('The shuttle from town runs today (a quarter of arrivals skip the lot).');
    if (s.hires?.howie === s.clock.year) notes.push('Howie is waving cars in: +4 spaces, patient drivers.');
    if (notes.length) body.append(el('div.section', {}, el('div.muted', { text: notes.join(' ') })));
  },
});
function lever2(api: Api, id: string, on?: boolean | undefined) {
  const r = api.dispatch({ type: 'season/lever', id, on, quiet: true });
  if (!r.ok) { api.toast(`${(r.reason ?? 'no')[0]?.toUpperCase() ?? ''}${(r.reason ?? '').slice(1)}`, 'bad'); return; }
  api.haptic(12); api.sound(id === 'hal' ? 'alert' : 'pop');
}

// ------------------------------------------------------------ morning card (Y2+): price board, shuttle, radio
registerCard('morning', {
  build(box, s: State, card, api: Api) {
    if (card.kind !== 'morning') return;
    const d = card.data, c = chip(s), se = s.season, wi = weekendIndex(s.clock.day);
    box.classList.add('season-card');
    box.append(el('div.head', {}, portraitEl(api, 'hal', s), el('div', {}, el('div.eyebrow', { text: `KQSC 46.0 · ${c.heat ? 'Heat over the hill' : `Marlene ${c.word.toLowerCase()} · ${c.pct}%`}` }),
      el('h2', { text: d.title }))));
    box.append(el('p', { text: d.first ? L.y2morning : `Hal reckons about ${d.expect} families today.` }));
    const tiers = el('div.seg.season-tiers', { role: 'group', 'aria-label': 'Prices' });
    const sh = el('button.toggle', { role: 'switch', 'aria-label': L.morning.shuttle[0] ?? '', onclick: () => { api.dispatch({ type: 'season/plan', shuttle: !api.s()?.season.shuttlePlan, quiet: true }); paint(); } });
    const rd = el('button.toggle', { role: 'switch', 'aria-label': L.morning.radio[0] ?? '', disabled: se.radioW === wi,
      onclick: () => { api.dispatch({ type: 'season/plan', radio: !api.s()?.season.radioPlan, quiet: true }); paint(); } });
    const paint = () => {
      const t = api.s()?.season;
      tiers.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === t?.tier));
      sh.classList.toggle('on', !!t?.shuttlePlan); rd.classList.toggle('on', !!t?.radioPlan || t?.radioW === wi);
    };
    for (const id of ['bargain', 'fair', 'premium']) {
      const [lab = '', sub = ''] = own(L.morning.tiers, id) ?? [];
      tiers.append(el('button', { data: { id }, onclick: () => { api.dispatch({ type: 'season/plan', tier: id, quiet: true }); api.sound('tick'); paint(); } }, el('b', { text: lab }), el('small', { text: sub })));
    }
    box.append(el('div.section', {}, el('div.eyebrow', { text: 'Price board' }), tiers),
      el('div.row-item', {}, el('div.grow', {}, el('div.title', { text: L.morning.shuttle[0] ?? '' }), el('div.desc', { text: L.morning.shuttle[1] ?? '' })), sh),
      el('div.row-item', {}, el('div.grow', {}, el('div.title', { text: L.morning.radio[0] ?? '' }), el('div.desc', { text: se.radioW === wi ? L.morning.radioOn : (L.morning.radio[1] ?? '') })), rd),
      el('div.choices', {}, el('button.choice.primary', { onclick: () => { api.dispatch({ type: 'card/answer', id: card.id, choice: 'open' }); api.sound('ching', { pitch: 0.9 }); } },
        el('b', { text: L.morning.open }), el('span', { text: `Cash ${money(s.cash)}` }))));
    paint();
  },
});

// ------------------------------------------------------------ evening card: closing time
registerCard('evening', {
  build(box, s, card, api: Api) {
    if (card.kind !== 'evening') return;
    const d = card.data;
    box.classList.add('season-card', 'season-evening');
    box.append(el('div.head', {}, portraitEl(api, 'gran', s), el('div', {}, el('div.eyebrow', { text: 'Closing time' }), el('h2', { text: d.title.split(' · ')[0] }))));
    box.append(el('div.season-stats', {}, statBox(d.served, 'served'), statBox(d.turned, 'turned away', d.turned ? 'warn' : ''), statBox(d.walkoffs, 'gave up', d.walkoffs ? 'bad' : ''),
      statBox(money(d.rev), 'taken', 'good')));
    const byV = Object.entries(d.byV || {}).sort((a, b) => b[1] - a[1]);
    if (byV.length) box.append(el('div.season-chips', {}, ...byV.map(([v, a]) => el('span.chip', {}, dot(v), `${own(NAMES, v) ?? v} ${money(a)}`)),
      d.tips ? el('span.chip', { text: `Tips ${money(d.tips)}` }) : null));
    if (d.stars != null) box.append(el('div.season-line', { html: `<span class="stars">${stars(d.stars)}</span><span>${d.stars.toFixed(1)} today · reputation <b>${d.R.toFixed(1)}</b>${d.byYou ? ` · you rang up ${d.byYou}${d.maxRush >= 2 ? `, best Rush ×${d.maxRush}` : ''}` : ''}</span>` }));
    if (d.best) box.append(el('div.season-best', {}, el('div.eyebrow', { text: L.evening.best }), el('div', { text: d.best })));
    const st = d.stock;
    // what's left, in words (it read like a debug line)
    const left = [`${st.prime} ripe in the field`, st.soft ? `${st.soft} gone soft` : null, st.green ? `${st.green} still green` : null, st.barn ? `${st.barn} in the barn` : 'the barn is empty'];
    box.append(el('div.season-line.muted', { text: `${d.weighoff ? 'Left at the end' : 'Left for tomorrow'}: ${left.filter(Boolean).join(', ')}.` }));
    if (d.weighoff) box.append(el('div.season-line', { html: `${icon('scale', 's')}<span><b>${L.evening.weighoff}</b></span>` }));
    else if (d.tomorrow) {
      const t = d.tomorrow, w = t.heat ? 'Heat over the hill' : t.rain ? 'Rain' : t.f < 0.25 ? "Marlene's out" : t.f < 0.5 ? 'Patchy' : t.f < 0.75 ? "Marlene's in" : "Marlene's sulking";
      box.append(el('div.season-line', { html: `${icon('fog', 's')}<span>${L.evening.tomorrow}: <b>${w}</b>, ${Math.round(t.f * 100)}% fog</span>` }));
    }
    box.append(el('div.choices', {}, el('button.choice.primary', { onclick: () => { api.dispatch({ type: 'card/answer', id: card.id, choice: 'ok' }); api.sound('done'); } }, el('b', { text: L.evening.ok }))));
  },
});
registerCard('panic', { build(box, s, card, api: Api) { box.classList.add('season-card'); genericCard(box, s, card, api); } });
registerCard('decorator', { build(box, s, card, api: Api) { box.classList.add('season-card'); genericCard(box, s, card, api); } });

// ------------------------------------------------------------ out-events: sound, haptics, the receipt, the review ticker
let lastReview = 0, lastHonk = 0;
registerEvent('season/served', (ev, api: Api) => {
  if (ev.by === 'you') {
    api.sound('ching', { pitch: 1 + 0.1 * Math.max(0, ev.rush - 1) }); sfx(api, 'drawer'); api.haptic(10 + ev.rush * 4);
    receipt(api, ev);
  } else api.sound('plink', { pitch: ev.by === 'dez' ? 1.25 : 0.95 });
});
registerEvent('season/bubble', (ev, api: Api) => { const s = api.s(); if (ev.kind === 'want' && s && unlocked(s, 'wants')) api.sound('pop'); });
registerEvent('season/walkoff', (_ev, api: Api) => api.sound('thunk'));
registerEvent('season/howl', (ev, api: Api) => sfx(api, 'howl', ev.level === 2 ? 1.12 : 1));
registerEvent('season/car', (ev, api: Api) => { if (ev.kind === 'uturn' && performance.now() - lastHonk > 2500) { lastHonk = performance.now(); sfx(api, 'honk'); } });
registerEvent('season/review', (ev, api: Api) => {
  // one review in the ticker every few seconds (a 1-star one sooner): the rest live in the Stand sheet
  if (performance.now() - lastReview < (ev.stars === 1 ? 3000 : 7000)) return;
  lastReview = performance.now();
  api.toast(`${stars(ev.stars)} ${ev.text}`, ev.stars >= 4 ? 'season-review-toast good' : ev.stars <= 2 ? 'season-review-toast bad' : 'season-review-toast', 'star');
});
registerEvent('season/joey', (ev, api: Api) => {
  if (ev.state === 'found') { api.sound('done'); api.haptic(30); }
  if (ev.state === 'bark') api.sound('bark');
});
registerEvent('season/goat', (ev, api: Api) => { if (ev.state === 'in') api.toast(LINES.events.goat, 'event', 'sparkle'); if (ev.state === 'dodge') api.sound('pop'); });
registerEvent('season/runaway', (ev, api: Api) => { if (ev.state === 'saved') { api.sound('ching', { pitch: 1.4 }); } if (ev.state === 'splash') api.sound('plink', { pitch: 0.6 }); });
registerEvent('season/puff', (_ev, api: Api) => api.sound('squish', { pitch: 0.7 }));
registerEvent('season/lever', (ev, api: Api) => { if (ev.id === 'hal') sfx(api, 'howl', 1.05); });
registerEvent('season/load', (_ev, api: Api) => { api.sound('thunk'); const s = api.s(); frameHaul(api, s ? haulRow(s) : null); });
registerEvent('patch/restock', (ev) => { if (ev.by === 'farmer') haul = null; });
registerEvent('season/answer', (ev, api: Api) => { if (ev.ok) { api.sound('done'); api.haptic(20); } else if (ev.ok === false) api.sound('thunk'); });
registerEvent('season/task', (ev, api: Api) => { if (ev.k === 'go') api.haptic(6); });
registerEvent('cardDone', () => closeAsk());

// ------------------------------------------------------------ per-frame upkeep (rides on the pins' frame sync)
REG.pins.unshift({ id: 'season-frame', icon: '', onTap: () => {}, when: (s) => { try { placeAsk(); if (weekendNow(s)) paintPins(s); } catch { /* cosmetic */ } return false; }, pos: () => ({ x: 0, z: 0 }) });
