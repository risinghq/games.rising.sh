// The giant slice's UI (design §6, §12): the Giant station and sheet (tabs Care · Notebook · Rituals), the decision
// cards (pollination at dawn, cull and name, the September Crier), press-and-hold Talk, creak / kelp / thirsty pins,
// the Start and Measure FAB modes, and the little sounds (a pitched knock, the tape's zip) and floaters.
// It reads only what the player may see: never the hidden true weight or density (a test enforces it).
import { el, icon, fmt, need } from './dom.js';
import type { Child, Props } from './dom.js';
import { registerSheet, registerStation, registerCard, registerTap, registerLongPress, registerPin, registerEvent, registerFab } from './registry.js';
import { portraitEl } from './dialog.js';
import { T } from '../sim/tuning.js';
import { LINES, line } from '../sim/story.js';
import { PLACES } from '../sim/layout.js';
import { isActive } from '../sim/events.js';
import { has } from '../sim/economy.js';
import { label as dateLabel, dayOf, dowName } from '../sim/calendar.js';
import { plants, plantOf, alive, hasFruit, estText, moonInfo, ritualsKept, RADIO, target, consequence, pace, nextTapeDay, dialOpen } from '../sim/giant.js';
import { CL } from '../sim/lines-giant.js';
import { countUp, knockWord } from './crawl.js';
import { fill, own } from '../sim/util.js';
import { COLOUR_NAMES, SHAPE_NAMES } from '../sim/genetics.js';
import type { State, Card, CardOf } from '../sim/types.js';
import type { Api, UiEventType, EventHandler } from './types.js';
import type { GiantPlant } from '../sim/state.js';
import type { Fruiting } from '../sim/giant.js';
declare global { var webkitAudioContext: typeof AudioContext | undefined }
const GT = T.giant, GX = PLACES.giant.x, GZ = PLACES.giant.z;
/** Sheet bookkeeping that survives renders. */
interface UiState {
  open: boolean; tab: string; plot: number; api: Api | null; tin: number; knock: string | null;
  st?: SheetState; lastGoal?: string;
}
const UI: UiState = { open: false, tab: 'care', plot: 1, api: null, tin: 0, knock: null };
const set = (n: ChildNode | null, v: string | undefined | null) => { if (n && n.textContent !== String(v)) n.textContent = v ?? null; };
const growing = (s: State | null) => s?.clock.phase === 'grow' || s?.clock.phase === 'october';
const nameOf = (p: GiantPlant | null) => p?.name || (hasFruit(p) ? 'Your giant' : 'Your seedling');
const plot = (s: State): GiantPlant => plantOf(s, UI.plot === 2 && s.giant.plot2 ? 2 : 1) ?? s.giant;
const RADIO_NAMES: Record<string, string> = { shanties: 'Shanties', jazz: 'Smooth jazz', borers: 'The Vine Borers' };
const FEED_NAMES: Record<string, string> = { none: 'None', kelp: 'Kelp', fish: 'Fish', both: 'Both' };

// ------------------------------------------------------------ little sounds (the foundation's blips cover the rest)
let ac: AudioContext | null = null;
function sfx(api: Api, kind: string, pitch = 1) {
  if (!api.settings.sound) return;
  try {
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!ac && AC) ac = new AC();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    const t0 = ac.currentTime, g = ac.createGain(), o = ac.createOscillator();
    g.connect(ac.destination);
    if (kind === 'knock') {                       // a hollow thunk: denser is deeper
      o.type = 'sine'; o.frequency.setValueAtTime(150 * pitch, t0); o.frequency.exponentialRampToValueAtTime(55 * pitch, t0 + 0.28);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
    } else if (kind === 'tape') {                 // the tape ratchets out over her back
      o.type = 'square'; o.frequency.setValueAtTime(900, t0); o.frequency.exponentialRampToValueAtTime(1500, t0 + 0.5);
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 38; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain); lfo.start(t0); lfo.stop(t0 + 0.55);
      g.gain.setValueAtTime(0.03, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    } else if (kind === 'thanks') {               // barely there
      o.type = 'sine'; o.frequency.setValueAtTime(1760, t0);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    }
    o.connect(g); o.start(t0); o.stop(t0 + 0.7);
  } catch { /* audio is best effort */ }
}
const at = (y = 2.2) => ({ x: GX, y, z: GZ });
const float = (api: Api, text: string, cls = '', y = 3) => api.R?.fx?.({ type: 'float', text, cls, ...at(y) });

// ------------------------------------------------------------ the sheet: shared bits
/** A segmented control item: an id, its label and an optional sub-line. */
type SegItem = readonly [id?: string | undefined, txt?: string, sub?: string];
/** What a tab returns: nodes to mount plus a sync run on every state change. */
interface Part { node: HTMLElement; sync?: (s: State) => void }
/** Mount a node in a tab and remember its sync. */
type Add = (node: HTMLElement, sync?: (s: State) => void) => HTMLElement;
/** The seg controls' return value, element and sync. */
type Seg = ReturnType<typeof seg>;
const seg = (items: readonly SegItem[], onPick: (id: string) => void, control?: string | null) => {
  const box = el('div.seg.giant-seg', { role: 'group', data: control ? { control } : null });
  for (const [id, txt, sub] of items) box.append(el('button', { data: { id }, onclick: () => onPick(id ?? '') }, el('span', {}, el('b', { text: txt }), sub ? el('small', { text: sub }) : null)));
  return { el: box, sync: (cur: string | undefined, dis: Record<string, boolean | undefined> = {}) => box.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b.dataset.id === cur); b.disabled = !!dis[b.dataset.id ?? '']; }) };
};
const row = (title: string, desc: Child, right: Child, control?: string) => el('div.giant-row', { data: control ? { control } : null }, el('div.grow', {}, el('div.title', { text: title }), desc), right);
const inputEl = (sel: string, props?: Props | null): HTMLInputElement => {
  const n = el(sel, props);
  if (!(n instanceof HTMLInputElement)) throw new Error(`ui: ${sel} is not an input`);
  return n;
};
const btnEl = (sel: string, props?: Props | null, ...kids: Child[]): HTMLButtonElement => {
  const n = el(sel, props, ...kids);
  if (!(n instanceof HTMLButtonElement)) throw new Error(`ui: ${sel} is not a button`);
  return n;
};
const toggle = (on: boolean, onclick: () => void, labelText: string) => {
  const t = el('button.toggle', { class: on ? 'on' : null, role: 'switch', 'aria-label': labelText, onclick });
  return t;
};
// [C] What she is doing, in plain words (plan §3.12, rulings R11): no "file · soak · heat mat", no jargon before its lesson.
function stageLine(s: State, p: GiantPlant): (string | undefined)[] {
  const d = s.clock.day, S = CL.stage, g = s.giant;
  switch (p.stage) {
    case 'tin': return S.tin;
    case 'started': return ['On the heat mat', CL.tin.started];
    case 'sprout': return g.moving ? [S.sproutPicked[0], fill(S.sproutPicked[1] ?? '', { date: onDay(s, g.moving.day) })]
      : [S.sprout[0], fill(S.sprout[1] ?? '', { date: dateLabel(Math.max(d, dayOf(T.story.y1.moving))) })];
    case 'seedling': return p.rootedDay != null && d < p.rootedDay ? [S.sulking[0], fill(S.sulking[1] ?? '', { date: dayWord(s, p.rootedDay) })] : S.seedling;
    case 'vine': return [S.vine[0], fill(S.vine[1] ?? '', { date: dateLabel(p.flowerDay ?? d) })];
    case 'flower': return S.flower;
    case 'set': return (p.cullDay ?? 0) > d ? [S.set[0], fill(S.set[1] ?? '', { n: (p.cullDay ?? 0) - d })] : S.setNow;
  }
  if (p.split === 'blowout') return ['The One That Got Away', `Split on ${dateLabel(p.splitDay ?? 0)}. ${p.seedsOk ? 'Her seeds may still be good.' : 'Too young for good seeds.'}`];
  const last = p.measures.at(-1), prev = p.measures.at(-2);
  const per = last && prev ? Math.round((last.est - prev.est) / Math.max(1, last.day - prev.day)) : null;
  return [p.est ? estText(p.est) : 'Not taped yet', `Day ${s.clock.day - (p.setDay ?? 0)} since she took${per != null ? ` · ${per >= 0 ? '+' : '−'}${Math.abs(per)} lb a day lately` : ''}${p.cracked ? ' · cracked' : ''}`];
}
// "today", "tomorrow", "Thu" or "Jul 2": how far off a day is, in words
const dayWord = (s: State, d: number) => (d <= s.clock.day ? 'today' : d === s.clock.day + 1 ? 'tomorrow' : d - s.clock.day < 7 ? dowName(d, true) : dateLabel(d));
const onDay = (s: State, d: number) => { const w = dayWord(s, d); return w === 'today' || w === 'tomorrow' ? w : `on ${w}`; };

// ------------------------------------------------------------ Care tab ([C] restructured: plan §3.12, rulings R0, R12)
// Phone first (390x844, a 46vh sheet): the tape is a sticky bar at the top from the Vine Crawl (Measure, Knock and the pace
// line); then her status; then only the controls she has unlocked, newest at the top (the water dial from the creak
// lesson, the sail from Aug 10, kelp from Jun 5), each a 56 px segmented control with a 14 px line under it saying what the
// picked option does (giant.consequence, computed from T). The control a Next-up goal teaches pulses and scrolls in
// (sheets.js). The tin is three plain taps (lid, nick, mat). Soak shows only when she is parched.
function careTab(s: State, api: Api) {
  const parts: Part[] = [];
  const add: Add = (node, sync) => { parts.push({ node, sync }); return node; };
  const p0 = plot(s);
  if (s.unlocks.measure && hasFruit(p0)) tapeBar(s, api, add);
  // status: what she is doing, her water (the tick is Normal's mark), the warnings
  const big = el('div.big'), sub = el('div.sub'), fillEl = el('i.fill'), tick = el('i.tick', {}, el('span', { text: 'Normal' })), mtxt = el('span.mtxt');
  const meter = el('div.giant-meter', { 'aria-label': 'Her water' }, el('div.bar', {}, fillEl, tick), mtxt);
  add(el('div.giant-status', {}, el('div.glyph', { html: icon('giant') }), el('div.grow', {}, big, sub, meter)), (s: State) => {
    const p = plot(s), [a, b] = stageLine(s, p);
    set(big, a); set(sub, b);
    const on = p.transplantDay != null && p.split !== 'blowout';
    meter.hidden = !on;
    if (on) {
      fillEl.style.width = `${Math.round(p.m * 100)}%`; tick.style.left = `${Math.round(target('normal') * 100)}%`;
      fillEl.className = `fill ${p.m < 0.25 ? 'bad' : p.m < 0.45 ? 'warn' : p.m > 0.85 ? 'wet' : 'good'}`;
      set(mtxt, `Water ${Math.round(p.m * 100)}%`);
    }
  });
  // warnings, and Soak only when she is parched (never "safe": a sudden drink can split a big girl)
  const bannerText = el('span'), soak = el('button.btn.giant-soak', { onclick: () => api.dispatch({ type: 'giant/soak' }) },
    el('span', { html: icon('drop') }), el('span', {}, el('b', { text: 'Soak' }), el('small', { text: CL.soak.sub.replace(/^Soak · /, '') })));
  const banner = el('div.giant-banner', {}, bannerText, soak);
  add(banner, (s: State) => {
    const p = plot(s), parched = alive(p) && p.m < GT.soakShowBelow;
    const msg = p.softSpot ? ['warn', LINES.giant.softSpot.replace('{name}', nameOf(p))]
      : p.creaking ? ['warn', `${nameOf(p)} is creaking: that glowing line. Ease off (Ease water, sail up), or ride it out.`]
      : p.swing > 0 ? ['warn', `She drank too fast: split risk is up for ${p.swing} more day${p.swing > 1 ? 's' : ''}.`]
      : parched ? ['bad', `${nameOf(p)} is parched. The morning water will catch up, or soak her now.`]
      : p.split === 'crack' ? ['', p.treated ? 'The stitched line: her crack, treated. The inspection will tell.'
        : `That zigzag is a surface crack. It can hide a cavity: treat it ($${GT.treat.cost}) before the inspection?`] : null;
    banner.hidden = !msg;
    soak.hidden = !parched || p.creaking || p.swing > 0;
    if (msg) { banner.className = `giant-banner ${msg[0]}`; set(bannerText, msg[1]); }
  });
  if (s.giant.plot2) {
    const sw = seg([['1', 'Plot 1', s.giant.name || ''], ['2', 'Plot 2', s.giant.plot2.name || '']], (id: string) => { UI.plot = +id; api.sound('tick'); refresh(api); });
    add(sw.el, () => sw.sync(String(UI.plot)));
  }
  if (p0.stage === 'tin') { tinRitual(s, api, add); return parts; }
  if (p0.transplantDay == null) return parts;
  // the controls she has: the one that matters now first (the goal's, the sail on a heat day, the dial while she creaks),
  // then the newest (the dial, the sail, kelp); on a phone the first one or two sit above the fold
  for (const k of controlOrder(s)) { const c = own(CONTROLS, k); if (c?.on(s)) c.build(s, api, add); }
  // rotate (year 2) and treat
  const rot = el('button.btn.giant-rotate', { data: { control: 'rotate' }, onclick: () => { const st = api.s(); if (st) api.dispatch({ type: 'giant/rotate', plot: plot(st).plot }); } }, el('span', { html: icon('next') }), el('span', { text: 'Rotate her a quarter' }));
  const treat = el('button.btn.giant-treat', { onclick: () => { const st = api.s(); if (st) api.dispatch({ type: 'giant/treat', plot: plot(st).plot }); } }, el('span', { html: icon('check') }), el('span'));
  add(el('div.section.giant-extra', {}, rot, treat), (s: State) => {
    const p = plot(s), t = hasFruit(p) ? s.clock.day - p.setDay : -1;
    rot.hidden = !(s.unlocks.rotate && s.clock.year >= GT.rotateFromYear && alive(p) && !p.rotated && t >= GT.rotateWindow[0] && t <= GT.rotateWindow[1]);
    treat.hidden = !(p.softSpot || (p.split === 'crack' && !p.treated));
    set(treat.lastChild, p.softSpot ? 'Treat the soft spot' : `Treat the crack · $${GT.treat.cost}`);
  });
  return parts;
}
const CONTROL_OF: Record<string, string> = { regime: 'dial', shade: 'shade', feed: 'feed' };
function controlOrder(s: State) {
  const goal = own(CONTROL_OF, s.story.goal?.target?.control ?? ''), heat = s.weather.heat || s.weather.forecast?.[0]?.heat;
  const urgent = [goal, heat && s.unlocks.shade ? 'shade' : null, plants(s).some((p) => p.creaking) ? 'dial' : null].filter((x): x is string => !!x);
  return [...new Set([...urgent, 'dial', 'shade', 'feed'])];
}
/** One control's spec: a title, a 56 px segmented control and the line for the picked option. */
interface ControlSpec {
  id: string; title: string; ic: string; items: SegItem[]; pick: (k: string) => void;
  cur: (s: State) => string; line: (s: State, k: string) => string;
  extra?: { node: HTMLElement | null; sync?: (s: State) => void } | null;
}
// One control: a title, a 56 px segmented control and the line for the picked option.
function control(add: Add, { id, title, ic, items, pick, cur, line: lineOf, extra }: ControlSpec) {
  const segc = seg(items.map(([k, t]) => [k, t]), pick, null), lineEl = el('div.giant-why'), head = el('div.eyebrow', { html: `${icon(ic, 's')}${title}` });
  const box = el('div.section.giant-control', { data: { control: id } }, head, segc.el, lineEl, extra?.node || null);
  add(box, (s: State) => { const c = cur(s); segc.sync(c); set(lineEl, lineOf(s, c)); extra?.sync?.(s); });
  return box;
}
const CONTROLS: Record<string, { on: (s: State) => boolean; build: (s: State, api: Api, add: Add) => void }> = {
  // the water dial: Ease / Normal / Push (year 1 from the creak lesson, years 2+ from Moving Day)
  dial: { on: (s: State) => dialOpen(s), build(_s: State, api: Api, add: Add) {
    const N = CL.dial.names;
    control(add, { id: 'regime', title: CL.dial.title, ic: 'drop', items: [['light', N.light], ['normal', N.normal], ['heavy', N.heavy]],
      pick: (k) => { if (k === 'light' || k === 'normal' || k === 'heavy') api.dispatch({ type: 'giant/regime', regime: k }); }, cur: (s: State) => s.giant.regime, line: (s: State, k: string) => consequence(s, 'dial', k) });
  } },
  // the shade sail: Down / Up, and Hal's heat call when there is one
  shade: { on: (s: State) => !!s.unlocks.shade, build(s: State, api: Api, add: Add) {
    const motorOwned = has(s, 'shadeMotor');
    const m = motorOwned ? toggle(s.giant.motor, () => api.dispatch({ type: 'giant/motor', on: !api.s()?.giant.motor }), 'Shade motor') : null;
    const extra = motorOwned ? { node: row('Shade motor', el('div.desc', { text: 'Raises it when Hal calls heat. Hal is right most days.' }), m), sync: (s: State) => { m?.classList.toggle('on', !!s.giant.motor); } } : null;
    const box = control(add, { id: 'shade', title: 'Shade sail', ic: 'sun', items: [['off', 'Down'], ['on', 'Up']], extra,
      pick: (k: string) => api.dispatch({ type: 'giant/shade', on: k === 'on' }), cur: (s: State) => (s.giant.shade ? 'on' : 'off'),
      line: (s: State, k: string) => (s.weather.heat ? CL.shade.heat : s.weather.forecast?.[0]?.heat && !s.giant.shade ? CL.shade.heatTomorrow : consequence(s, 'shade', k)) });
    box.classList.add('giant-shade');
  } },
  // kelp tea (years 2+: fish and both): what it costs to the weigh-off, and what it buys
  feed: { on: (s: State) => !!s.unlocks.feed, build(s: State, api: Api, add: Add) {
    const items: [string, string][] = [['none', 'None'], ['kelp', 'Kelp']];
    if (s.unlocks.fish && s.clock.year >= (GT.feed.fish.fromYear ?? 1)) items.push(['fish', 'Fish'], ['both', 'Both']);
    const free = el('span.chip.giant-free');
    const box = control(add, { id: 'feed', title: 'Feed', ic: 'sparkle', items, pick: (k) => { if (k === 'none' || k === 'kelp' || k === 'fish' || k === 'both') api.dispatch({ type: 'giant/feed', feed: k }); }, cur: (s: State) => s.giant.feed,
      line: (s: State, k: string) => (k === 'none' || k === 'kelp' ? consequence(s, 'feed', k) : `$${own(GT.feed, k)?.cost} a day`),
      extra: { node: null, sync: (s: State) => { free.hidden = !(s.giant.kelpFree > 0); set(free, `Free kelp · ${s.giant.kelpFree} day${s.giant.kelpFree === 1 ? '' : 's'}`); } } });
    box.querySelector('.eyebrow')?.append(free);
  } },
};
// The tape, at the top of the sheet from the Vine Crawl on: Measure (it rests a few days between tapes), Knock (the word is
// the pitch: a deep THOONK is a dense one), and the pace line read from the last tape.
function tapeBar(_s: State, api: Api, add: Add) {
  const measure = btnEl('button.btn.primary.giant-measure', { data: { control: 'measure' }, onclick: () => { const st = api.s(); if (st) api.dispatch({ type: 'giant/measure', plot: plot(st).plot }); } },
    el('span', { html: icon('scale') }), el('span', {}, el('b', { text: CL.measure.button }), el('small')));
  const knock = btnEl('button.btn.giant-knock', { onclick: () => { const st = api.s(); if (st) api.dispatch({ type: 'giant/knock', plot: plot(st).plot }); } },
    el('span', { html: icon('giant') }), el('span', {}, el('b', { text: CL.measure.knock }), el('small', { text: UI.knock || 'listen' })));
  const paceEl = el('div.giant-pace');
  add(el('div.giant-tapebar', {}, el('div.giant-line', {}, measure, knock), paceEl), (s: State) => {
    const p = plot(s), next = nextTapeDay(p), rest = next > s.clock.day;
    measure.disabled = rest || !alive(p); knock.disabled = !alive(p);
    set(measure.querySelector('small'), !alive(p) ? 'nothing to tape' : rest ? fill(CL.measure.next, { day: dayWord(s, next) }) : p.est ? estText(p.est) : 'her first tape');
    set(knock.querySelector('small'), UI.knock || 'listen');
    const pc = pace(s, p);
    set(paceEl, pc ? [consequence(s, 'tape', p), pc.kelp >= GT.pace.kelpMin ? fill(CL.pace.kelp, { k: pc.kelp }) : ''].join(' ').trim() : CL.pace.none);
  });
}
// The tin: three plain taps on her sheet (rulings R0): slide the lid, nick the seed, tuck her in on the heat mat.
function tinRitual(s: State, api: Api, add: Add) {
  const p = plot(s), step = el('button.btn.primary.block.giant-start', { data: { control: 'start' } }, el('span', { html: icon('giant') }), el('span', {}, el('b'), el('small')));
  const dots = el('div.giant-dots'), seedEl = el('div.giant-seedname');
  step.onclick = () => {
    const i = UI.tin || 0;
    api.R?.fx?.({ type: 'giant/tin', step: i + 1 });
    api.sound(i === 2 ? 'plink' : 'pop'); api.haptic(10);
    if (i < 2) { UI.tin = i + 1; return; }
    UI.tin = 0;
    api.dispatch({ type: 'giant/start' });
    refresh(api);
  };
  add(el('div.section.giant-tin', {}, el('div.eyebrow', { html: `${icon('sparkle', 's')}${s.clock.year > 1 ? 'The seed' : "Grandpa's seed"}` }), seedEl, step, dots), (_s: State) => {
    const i = UI.tin || 0, [label, sub] = CL.tin.steps[i] ?? [undefined, undefined];
    set(step.querySelector('b'), label); set(step.querySelector('small'), sub);
    set(seedEl, i > 0 ? fill(CL.tin.seed, { seed: p.seed.name }) : '');
    seedEl.hidden = i === 0;
    dots.innerHTML = CL.tin.steps.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('');
  });
}

// ------------------------------------------------------------ Notebook tab: the growth chart, pedigree, creaks
function chartSvg(s: State, p: Fruiting) {
  const W = 320, H = 140, pad = 26, last = s.giant.history.at(-1);
  const pts = p.measures.map((m) => ({ t: m.day - p.setDay, est: m.est })), old = last?.measures || [];
  const maxT = 120, maxW = Math.max(400, ...pts.map((m) => m.est), ...old.map((m) => m.est)) * 1.1;
  const x = (t: number) => pad + (t / maxT) * (W - pad - 6), y = (w: number) => H - 18 - (w / maxW) * (H - 30);
  const path = (list: readonly { t: number; est: number }[]) => list.map((m, i) => `${i ? 'L' : 'M'}${x(m.t).toFixed(1)} ${y(m.est).toFixed(1)}`).join(' ');
  const step = maxW > 1600 ? 500 : maxW > 800 ? 250 : 100, grid: string[] = [];
  for (let w = step; w < maxW; w += step) grid.push(`<line x1="${pad}" x2="${W - 4}" y1="${y(w)}" y2="${y(w)}" stroke="#ece7dc"/><text x="${pad - 4}" y="${y(w) + 3}" text-anchor="end">${w >= 1000 ? (w / 1000).toFixed(w % 1000 ? 2 : 0).replace(/0$/, '') + 'k' : w}</text>`);
  const today = hasFruit(p) ? Math.min(maxT, s.clock.day - p.setDay) : 0;
  return `<svg class="giant-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Growth chart of tape estimates">
    ${grid.join('')}<line x1="${pad}" x2="${W - 4}" y1="${H - 18}" y2="${H - 18}" stroke="#cfc8b8"/>
    ${[0, 30, 60, 90, 120].map((t) => `<text x="${x(t)}" y="${H - 5}" text-anchor="middle">${t}d</text>`).join('')}
    ${old.length > 1 ? `<path d="${path(old)}" fill="none" stroke="#a9b3ad" stroke-width="1.6" stroke-dasharray="4 3"/>` : ''}
    ${hasFruit(p) ? `<line x1="${x(today)}" x2="${x(today)}" y1="8" y2="${H - 18}" stroke="#f0d9c4" stroke-width="2"/>` : ''}
    ${pts.length > 1 ? `<path d="${path(pts)}" fill="none" stroke="#d9782d" stroke-width="2.2"/>` : ''}
    ${pts.map((m) => `<circle cx="${x(m.t).toFixed(1)}" cy="${y(m.est).toFixed(1)}" r="2.8" fill="#d9782d"/>`).join('')}
  </svg>`;
}
function notebookTab(s: State, _api: Api) {
  const parts: Part[] = [];
  const add: Add = (node, sync) => { parts.push({ node, sync }); return node; };
  const chart = el('div.giant-chartbox'), legend = el('div.giant-legend'), facts = el('div.giant-facts');
  let sig: string|null = null;
  add(el('div.section', {}, el('div.eyebrow', { html: `${icon('ledger', 's')}Tape estimates` }), chart, legend, facts), (s: State) => {
    const p = plot(s), last = s.giant.history.at(-1), k = `${p.measures.length}|${p.setDay}|${s.clock.day}|${UI.plot}`;
    if (k === sig) return;
    sig = k;
    chart.innerHTML = hasFruit(p) ? chartSvg(s, p) : '';
    if (!p.measures.length) chart.append(el('div.empty-note', { html: `${icon('scale')}<span>${s.unlocks.measure ? 'No tape yet.' : `Edna's tape comes out at the Vine Crawl, ${dateLabel(dayOf(T.story.y1.crawl))}.`}</span>` }));
    legend.innerHTML = `<span class="dot"></span>${p.name || 'This year'}${(last?.measures?.length ?? 0) > 1 ? ` <span class="dash"></span>Last year: ${last?.name || 'her'}${last?.result?.W ? `, ${fmt.lb(last.result.W ?? 0)}` : ''}` : ''}`;
    facts.innerHTML = '';
    if (p.est) facts.append(el('span.chip', { text: estText(p.est) }));
    if (p.bestPerDay) facts.append(el('span.chip', { text: `Best day +${Math.round(p.bestPerDay)} lb` }));
    if (p.measures.length) facts.append(el('span.chip', { text: `${p.measures.length} measure${p.measures.length > 1 ? 's' : ''}` }));
  });
  const ped = el('div.giant-ped');
  add(el('div.section', {}, el('div.eyebrow', { html: `${icon('pumpkin', 's')}Pedigree` }), ped), (s: State) => {
    const p = plot(s), k = `${p.seed.id}|${p.father?.kind}|${p.vigorHint}|${p.color}|${p.shape}|${p.stage}`;
    if (ped.dataset.k === k) return;
    ped.dataset.k = k; ped.innerHTML = '';
    const item = (t: string, d: string) => ped.append(el('div.ledger-row', {}, el('span', { text: t }), el('span.v', { text: d })));
    item('Seed', p.seed.name);
    if (p.father) item('Father', p.father.kind === 'cross' ? `${p.father.name} pollen` : p.father.kind === 'self' ? 'herself (self)' : p.father.kind === 'sib' ? 'her sister (sib)' : 'the Cove bees (open)');
    if (p.vigorHint) item('The vine', p.vigorHint === 'vigorous' ? 'looks vigorous' : p.vigorHint === 'so-so' ? 'looks so-so' : 'looks steady');
    if (hasFruit(p) && s.clock.day - p.setDay > 20) item('Her looks', `${COLOUR_NAMES[p.color]}${p.stripe ? ', striped' : ''} · ${SHAPE_NAMES[p.shape]}`);
    if ((p.F || 0) >= T.genetics.inbredBadge) ped.append(el('div.giant-badge', { text: LINES.genetics.inbred }));
  });
  // [C] the choices you made this year, and what came of them (the receipts), newest first
  const choices = el('div.giant-choices');
  add(el('div.section', {}, el('div.eyebrow', { html: `${icon('check', 's')}Choices` }), choices), (s: State) => {
    const list = s.giant.notebook?.choices || [], k = `${list.length}|${list.at(-1)?.d}`;
    if (choices.dataset.k === k) return;
    choices.dataset.k = k; choices.innerHTML = '';
    if (!list.length) { choices.append(el('div.empty-note', { text: 'Nothing decided yet. Moving day is the first.' })); return; }
    for (const c of [...list].reverse()) choices.append(el('div.ledger-row', { class: c.id.startsWith('receipt:') ? 'receipt' : null },
      el('span', { text: dateLabel(c.d) }), el('span.v', { text: c.text })));
  });
  // (creaks mean nothing before Old Moss explains them: year 1 hides the list until his lesson)
  if (s.clock.year > 1 || s.story.beats['giant.creak'] !== undefined || plot(s).creaks.length) {
  const creaks = el('div.giant-creaks');
  add(el('div.section', {}, el('div.eyebrow', { html: `${icon('alert', 's')}Creaks` }), creaks), (s: State) => {
    const p = plot(s), k = JSON.stringify(p.creaks);
    if (creaks.dataset.k === k) return;
    creaks.dataset.k = k; creaks.innerHTML = '';
    if (!p.creaks.length) { creaks.append(el('div.empty-note', { text: 'Not a peep. Yet.' })); return; }
    for (const c of p.creaks) creaks.append(el('div.ledger-row', {}, el('span', { text: `${dateLabel(c.day)}${c.soft ? ' · soft spot' : c.practice ? ' · practice' : ''}` }),
      el('span.v', { class: c.outcome === 'split' ? 'neg' : null, text: c.outcome ? `${c.outcome}${c.end ? ` ${dateLabel(c.end)}` : ''}` : 'creaking now' })));
  });
  }
  return parts;
}

// ------------------------------------------------------------ Rituals tab
function ritualsTab(s: State, api: Api) {
  const parts: Part[] = [];
  const add: Add = (node, sync) => { parts.push({ node, sync }); return node; };
  if (!s.unlocks.rituals) {
    add(el('div.empty-note', { html: `${icon('moon')}<span>Old Moss has opinions about these. He'll share them in September.</span>` }));
    return parts;
  }
  const talkInfo = el('div.desc');
  const talk = el('button.btn.primary.giant-talkbtn', { data: { control: 'talk' }, onclick: () => talkPicker(api) }, el('span', { html: icon('help') }), el('span', { text: 'Talk to her' }));
  add(el('div.section', {}, el('div.eyebrow', { html: `${icon('sparkle', 's')}Talk to her` }), row('Press and hold her, or tap here', talkInfo, talk)), (s: State) => {
    const g = s.giant, p = g, w = hasFruit(p) ? Math.floor((s.clock.day - p.setDay) / 7) : 0;
    set(talkInfo, `${g.talks[w] || 0} this week · ${g.talkCount} this year`);
  });
  const radio = seg([['off', 'Off'], ...RADIO.map((r): SegItem => [r, own(RADIO_NAMES, r)])], (id: string) => api.dispatch({ type: 'giant/radio', station: id === 'off' ? null : id }));
  add(el('div.section', {}, el('div.eyebrow', { html: `${icon('radio', 's')}KQSC for her` }), radio.el), (s: State) => radio.sync(s.giant.radio || 'off'));
  const hat = toggle(s.giant.hat, () => api.dispatch({ type: 'giant/hat', on: !api.s()?.giant.hat }), "Grandpa's lucky hat");
  const moon = el('div.desc'), secret = el('div.desc'), hatDesc = el('div.desc');
  add(el('div.section', {}, el('div.eyebrow', { html: `${icon('moon', 's')}Luck` }),
    row("Grandpa's lucky hat", hatDesc, hat), row('The moon', moon, null), row('Never say the estimate', secret, null),
    el('div.giant-foot', { text: 'Old Moss swears one of these works. Nobody agrees which.' })), (s: State) => {
    const g = s.giant, kept = ritualsKept(s, g);
    hat.classList.toggle('on', !!g.hat);
    set(hatDesc, hasFruit(g) ? (g.hat ? 'Worn at pollination. Kept.' : 'Off at pollination. Next year.') : 'Wear it on the dawn she sets.');
    const m = moonInfo(s);
    set(moon, hasFruit(g) ? `She set ${(g.moon ?? 0) < 0.6 ? 'under a full moon' : `${Math.round(g.moon ?? 0)} days from full`}.${kept.moon ? ' Kept.' : ''}` : m.full ? 'Full moon tonight.' : `Full moon in about ${Math.round(((0.5 - m.phase + 1) % 1) * GT.rituals.moonCycle)} days.`);
    set(secret, g.crier ? (g.crier.told ? 'You told the Crier. The whole Cove knows.' : 'Kept secret. Edna is intrigued.') : 'Edna asks on September 1.');
  });
  return parts;
}

// ------------------------------------------------------------ the sheet
/** What the open sheet remembers between syncs. */
interface SheetState {
  parts?: Part[];
  tabs?: Seg;
  key?: string;
  body?: HTMLElement;
}
const TABS: [string, string][] = [['care', 'Care'], ['notebook', 'Notebook'], ['rituals', 'Rituals']];
function layoutKey(s: State) {
  const p = plot(s);
  return [UI.tab, UI.plot, p.stage === 'tin', p.transplantDay != null, s.unlocks.feed, s.unlocks.fish, s.unlocks.shade, s.unlocks.measure, s.unlocks.rituals,
    s.unlocks.rotate, !!s.giant.plot2, has(s, 'shadeMotor'), s.clock.year, dialOpen(s), hasFruit(p), s.story.beats['giant.creak'] !== undefined, controlOrder(s).join()].join('|');
}
function render(body: HTMLElement, s: State, api: Api) {
  const st = UI.st ?? (UI.st = {});
  body.innerHTML = '';
  const lockedRituals = !s.unlocks.rituals && s.clock.year === 1;
  const tabs = seg(TABS.map(([id, t]) => [id, id === 'rituals' && lockedRituals ? `${t} · ${dateLabel(dayOf(T.story.y1.rituals))}` : t]), (id: string) => { UI.tab = id; api.sound('tick'); const st = api.s(); if (st) render(body, st, api); });
  tabs.el.classList.add('giant-tabs');
  const content = el('div.giant-tab');
  body.append(tabs.el, content);
  const parts = UI.tab === 'notebook' ? notebookTab(s, api) : UI.tab === 'rituals' ? ritualsTab(s, api) : careTab(s, api);
  for (const p of parts) content.append(p.node);
  st.parts = parts; st.tabs = tabs; st.key = layoutKey(s); st.body = body;
  sync(body, s, api);
}
function sync(body: HTMLElement, s: State, _api: Api) {
  const st = UI.st;
  st?.tabs?.sync(UI.tab);
  for (const p of st?.parts ?? []) p.sync?.(s);
  // the Next-up goal pulses the one control it teaches
  const c = s.story.goal?.target?.kind === 'station' && s.story.goal.target.id === 'giant' ? s.story.goal.target.control : null;
  body.querySelectorAll<HTMLElement>('[data-control]').forEach((n) => n.classList.toggle('pulse', n.dataset.control === c));
  st?.tabs?.el.querySelector('[data-id="rituals"]')?.classList.toggle('pulse', c === 'talk' && UI.tab !== 'rituals');
}
function refresh(api: Api) { const st = UI.st, s = api.s(); if (st?.body && UI.open && s) render(st.body, s, api); }
function goalTab(s: State) { const c = s.story.goal?.target?.control; return c === 'talk' ? 'rituals' : c ? 'care' : null; }

registerSheet('giant', {
  eyebrow: (s: State) => {
    const p = plot(s);
    if (p.transplantDay == null) return p.stage === 'tin' ? "Grandpa's corner" : 'Indoors, on the heat mat';
    // [C] plain words: the water dial's name only once she has one (year 1: the creak lesson)
    const water = dialOpen(s) ? `${own(CL.dial.names, s.giant.regime)} water` : 'Her corner';
    if (!hasFruit(p)) return `${water}${s.unlocks.feed ? ` · ${s.giant.feed === 'none' ? 'no feed' : (own(FEED_NAMES, s.giant.feed) ?? s.giant.feed).toLowerCase()}` : ''}`;
    return `Day ${s.clock.day - p.setDay} · ${water}${s.giant.shade ? ' · sail up' : ''}`;
  },
  title: (s: State) => plot(s).name || (hasFruit(plot(s)) ? 'Your giant' : plot(s).seed.short),
  build(body: HTMLElement, s: State, arg: { tab?: string } | undefined, api: Api) {
    UI.open = true; UI.api = api; UI.st = {};
    body.closest('#sheet')?.classList.add('giant');            // [C] a little taller than 46vh: her controls fit (css/giant.css)
    if (arg?.tab) UI.tab = arg.tab; else UI.tab = goalTab(s) || UI.tab;
    if (!s.giant.plot2) UI.plot = 1;
    render(body, s, api);
    requestAnimationFrame(() => api.R?.cam?.frame?.('giant'));        // the camera itself honours reduce motion
  },
  update(body: HTMLElement, s: State, _arg: { tab?: string } | undefined, api: Api) {
    if (!UI.st?.parts) return;
    const want = goalTab(s);
    if (want && want !== UI.tab && UI.lastGoal !== s.story.goal?.id) { UI.tab = want; }
    UI.lastGoal = s.story.goal?.id;
    if (layoutKey(s) !== UI.st.key) render(body, s, api); else sync(body, s, api);
  },
  onClose() { UI.open = false; talkClose(); document.querySelector('#sheet')?.classList.remove('giant'); },
});
const openGiant = (api: Api, arg?: { tab?: string }) => (api.currentSheet() === 'giant' ? null : api.openSheet('giant', arg));
registerStation({ id: 'giant', label: 'Giant', icon: 'giant', order: 10, key: 'g', sheet: 'giant',
  visible: (s: State) => !!s.unlocks.giant && growing(s),
  badge: (s) => (plants(s).some((p) => p.creaking) ? '!' : null),
  onTap: (api: Api) => openGiant(api) });
registerTap('giant', (_hit, api: Api) => { if (growing(api.s())) { api.R?.fx?.({ type: 'squash', id: 'giant', amount: 0.12 }); openGiant(api); } });
registerLongPress('giant', (_hit, api: Api) => { const s = api.s(); if (s && growing(s) && s.giant.stage !== 'tin' && s.giant.stage !== 'started') talkPicker(api); });

// ------------------------------------------------------------ Talk: press and hold her, pick a phrase
let talkEl: HTMLElement | null = null;
function talkClose() { talkEl?.remove(); talkEl = null; }
// it is not a sheet or a card, so nothing else puts it away: a tap anywhere else (a station, the menu, Stroll, the
// map), Esc or a change of phase does, so it never floats over the joystick or comes back with the next game
addEventListener('pointerdown', (e) => { if (talkEl && !(e.target instanceof Element && e.target.closest('.giant-talk'))) talkClose(); }, { capture: true, passive: true });
addEventListener('keydown', (e) => { if (talkEl && e.key === 'Escape') talkClose(); });
registerEvent('phase', () => talkClose());
let viewHooked = false;
function talkPicker(api: Api) {
  talkClose();
  if (!viewHooked) { viewHooked = true; api.R?.onView?.(() => talkClose()); }   // F (Stroll) on a keyboard
  api.haptic(12);
  if (api.currentSheet()) api.closeSheet();            // talk to HER: the sheet steps aside so you can see her
  const phrases = LINES.rituals.talk;
  talkEl = el('div.giant-talk.card', { role: 'dialog', 'aria-label': 'Talk to her' },
    el('div.eyebrow', { text: `Say something to ${nameOf(api.s()?.giant ?? null)}` }),
    ...phrases.map((t, i) => el('button.choice', { onclick: () => { api.dispatch({ type: 'giant/talk', phrase: i }); talkClose(); } }, el('b', { text: `“${t}”` }))),
    el('button.btn.ghost.block', { text: 'Never mind', onclick: talkClose }));
  need('#game-ui').append(talkEl);
}

// ------------------------------------------------------------ decision cards
function head(box: HTMLElement, s: State, api: Api, d: { speaker?: string; eyebrow?: string; title: string }) {
  box.append(el('div.head', {}, d.speaker ? portraitEl(api, d.speaker, s) : null, el('div', {}, d.eyebrow ? el('div.eyebrow', { text: d.eyebrow }) : null, el('h2', { text: d.title }))));
}
const choiceBtn = (ch: { primary?: boolean; label: string; sub?: string }, onclick: () => void, cls?: string | null) => el('button.choice', { class: [ch.primary ? 'primary' : '', cls || ''].join(' ').trim() || null, onclick }, el('b', { text: ch.label }), ch.sub ? el('span', { text: ch.sub }) : null);
const answer = (api: Api, card: Card, choice: string | null | undefined, extra: { name?: string } = {}) => api.dispatch({ type: 'card/answer', id: card.id, choice: choice ?? undefined, ...extra });

// [C] The dawn (plan §3.12, rulings R5): the card shows how many bees are out, drawn as bees, so one lonely bee in fog shows
// the stakes; the moon is Old Moss's aside; the lucky hat lives on the Rituals tab now. Year 1 shows no odds.
const BEE = '<svg viewBox="0 0 24 18" class="giant-bee" aria-hidden="true"><ellipse cx="9" cy="5" rx="4" ry="3.2" fill="#fff" opacity=".85"/>'
  + '<ellipse cx="14" cy="4.5" rx="3.6" ry="3" fill="#fff" opacity=".75"/><ellipse cx="12" cy="11" rx="7" ry="5" fill="#f2c14e"/>'
  + '<path d="M9 6.5v9M12.5 6v10M16 7v8" stroke="#3a2f22" stroke-width="2"/><circle cx="18.5" cy="10" r="2.2" fill="#3a2f22"/></svg>';
registerCard('pollinate', {
  build(box, s, card: CardOf<'pollinate'>, api: Api) {
    const d = card.data;
    head(box, s, api, d);
    box.append(el('p', { text: d.text }));
    const bees = d.bees ?? 0;
    box.append(el('div.giant-bees', { class: bees <= 1 ? 'lonely' : null, 'aria-label': `${bees} bee${bees === 1 ? '' : 's'} out` },
      el('div.swarm', { html: BEE.repeat(Math.max(0, bees)) }),
      el('div.cnt', {}, el('b', { text: String(bees) }), el('span', { text: bees === 1 ? 'bee out' : 'bees out' })),
      el('span.chip', { html: `${icon(d.foggy ? 'fog' : 'sun', 's')}${Math.round(d.fog * 100)}% fog` })));
    if (d.aside) box.append(el('div.giant-aside', {}, portraitEl(api, 'moss', s, 'small'), el('span', { text: d.aside })));
    box.append(el('div.choices', {}, d.choices.map((ch) => choiceBtn(ch, () => answer(api, card, ch.id), ch.id === 'wait' ? 'giant-wait' : null))));
  },
});

// [C] Moving Day (plan §3.11): three mornings, each with Hal's forecast in words ("give or take", never ±) and what it
// likely means for her. This morning's fog is known; the next two are Hal's guess.
registerCard('moving', {
  build(box, s, card: CardOf<'moving'>, api: Api) {
    const d = card.data;
    head(box, s, api, d);
    box.append(el('p', { text: d.text }));
    box.append(el('div.choices.giant-moving', {}, d.choices.map((ch, k) => {
      const f = d.fc?.[k] ?? 0.5;
      return el('button.choice', { onclick: () => answer(api, card, ch.id) },
        el('div.mv', {}, el('span.mvic', { class: f < 0.5 ? 'clear' : f < 0.75 ? 'patchy' : 'fog', html: icon(f < 0.5 ? 'sun' : f < 0.75 ? 'partsun' : 'fog') }),
          el('div', {}, el('b', { text: ch.label }), ch.sub ? el('span', { text: ch.sub }) : null)));
    })));
  },
});

registerCard('cull', {
  build(box, s, card: CardOf<'cull'>, api: Api) {
    const d = card.data;
    let pick: string | null = null, names = d.names, ni = 0;
    head(box, s, api, d);
    if (d.text) box.append(el('p', { text: d.text }));
    const step = el('div');
    box.append(step);
    const fruitIcon = (id: string) => `<svg viewBox="0 0 64 34" class="giant-cullic" aria-hidden="true"><path d="M2 26 C 18 20, 40 30, 62 22" stroke="#6f7f4a" stroke-width="3" fill="none"/>${
      ['safe', 'stump', 'round', 'twins'].map((k, i) => (k === 'twins' ? '' : `<ellipse cx="${12 + i * 20}" cy="${i === 1 ? 18 : 16}" rx="${k === 'round' ? 7 : 8}" ry="${k === 'round' ? 7 : 6}" fill="${k === id ? '#d9782d' : '#9fb07f'}"/>`)).join('')
    }${id === 'twins' ? '<ellipse cx="26" cy="16" rx="8" ry="6" fill="#d9782d"/><ellipse cx="38" cy="16" rx="8" ry="6" fill="#d9782d"/>' : ''}</svg>`;
    const showFruit = () => {
      step.innerHTML = '';
      step.append(el('div.choices', {}, d.choices.map((ch) => el('button.choice.giant-cull', { onclick: () => { pick = ch.id; api.sound('pop'); showName(); } },
        el('div', { html: fruitIcon(ch.id) }), el('div', {}, el('b', { text: ch.label }), el('span', { text: ch.sub }))))));
    };
    const showName = () => {
      step.innerHTML = '';
      const input = inputEl('input.field', { maxlength: d.nameMax, placeholder: 'Her name', 'aria-label': 'Her name', autocomplete: 'off', value: names[0] });
      const chips = el('div.giant-names');
      const paintNames = () => {
        chips.innerHTML = '';
        for (let k = 0; k < GT.nameChoices; k++) {
          const n = names[(ni + k) % names.length];
          chips.append(el('button.chip.giant-name', { class: input.value === n ? 'on' : null, text: n, onclick: () => { input.value = n ?? ''; paintNames(); api.sound('tick'); } }));
        }
        chips.append(el('button.chip.giant-name.reroll', { html: `${icon('dice', 's')}${LINES.giantCards.reroll}`, onclick: () => { ni = (ni + GT.nameChoices) % names.length; input.value = names[ni] ?? ''; paintNames(); api.sound('pop'); } }));
      };
      input.addEventListener('input', paintNames);
      paintNames();
      const done = () => answer(api, card, pick, { name: input.value.trim().slice(0, d.nameMax) || names[ni] });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
      step.append(el('p', { text: 'Every giant needs a name for the sign, the scale and the Crier.' }), input, chips,
        el('div.choices', {}, el('button.choice.primary', { onclick: done }, el('b', { text: LINES.giantCards.nameIt })), el('button.choice', { onclick: showFruit }, el('b', { text: 'Back to the vine' }))));
    };
    showFruit();
  },
});

registerCard('crier', {
  build(box, s, card: CardOf<'crier'>, api: Api) {
    const d = card.data;
    head(box, s, api, d);
    box.append(el('p', { text: d.text }));
    const list = el('div.giant-boasts', {}, el('div.eyebrow', { text: "Rivals' estimates" }),
      d.boasts.map((b) => el('div.ledger-row', {}, el('span', { text: b.name }), el('span.v', { text: b.est ? `${fmt.int(b.est)} lb` : "won't say" }))));
    box.append(list, el('div.giant-judges', { text: d.judges }));
    box.append(el('div.choices', {}, d.choices.map((ch) => choiceBtn(ch, () => answer(api, card, ch.id)))));
  },
});

// ------------------------------------------------------------ FAB modes, pins, events
// [C] the seed starts with the tin's three plain taps on her sheet (rulings R0): the thumb button opens it there
registerFab({ id: 'giant-start', priority: 30, icon: () => 'giant', label: () => 'Start seed',
  when: (s: State) => s.clock.phase === 'grow' && !!s.unlocks.giant && s.giant.stage === 'tin',
  onTap: (api: Api) => openGiant(api, { tab: 'care' }) });
// ([C] no Measure FAB while her sheet is open: the tape is the sticky bar at the sheet's top, so a tap at its edge never measures)

const gy = (s: State) => 1.2 + 2.4 * Math.cbrt(Math.max(4, s.giant.wc) / 1400) * 1.1;
registerPin({ id: 'giant-creak', icon: 'alert', label: "She's creaking. Tap to look", urgent: () => true,
  when: (s) => growing(s) && plants(s).some((p) => p.creaking && alive(p)), pos: (s) => ({ x: GX, y: gy(s), z: GZ }), onTap: (api: Api) => openGiant(api, { tab: 'care' }) });
registerPin({ id: 'giant-thirsty', icon: 'drop', label: 'She is thirsty. Tap to water',
  when: (s: State) => growing(s) && !s.giant.creaking && alive(s.giant) && s.giant.m < GT.thirsty[0], pos: (s) => ({ x: GX + 0.8, y: gy(s), z: GZ }), onTap: (api: Api) => openGiant(api, { tab: 'care' }) });
registerPin({ id: 'giant-start', icon: 'giant', label: "Start Grandpa's seed",
  when: (s: State) => s.clock.phase === 'grow' && !!s.unlocks.giant && s.giant.stage === 'tin' && !s.story.dialog.length, pos: () => ({ x: GX, y: 1.2, z: GZ }), onTap: (api: Api) => openGiant(api) });
registerPin({ id: 'kelp', icon: 'sparkle', label: 'Kelp on the beach! Tap to gather it', urgent: () => true,
  when: (s) => isActive(s, 'kelp'), pos: () => ({ x: PLACES.kelp.x, y: 0.4, z: PLACES.kelp.z }), onTap: (api: Api) => api.dispatch({ type: 'events/tap', id: 'kelp' }) });

const on = <K extends UiEventType>(type: K, fn: EventHandler<K>) => registerEvent(type, fn);
on('giant/start', (_ev, api) => { api.sound('plink'); api.haptic(15); api.toast(CL.tin.toast, 'good', 'giant'); api.R?.fx?.({ type: 'sparkle', ...at(0.6) }); });
// ([D] year 1's germination is the SHE'S UP banner now: ui/firsts.js)
// [C] Moving Day: the pick, the move (rooted tomorrow, or sulking under the hoop house), Gran fussing, and the morning she roots
on('giant/moving', (ev, api) => { if (ev.text) api.toast(ev.text, 'good', 'calendar'); });
on('giant/transplant', (ev, api) => {
  if (ev.plot !== 1) return;
  const s = api.s(), when = dowName(ev.rootedDay, true);
  if (!s) return;
  api.toast(fill(ev.sulk ? CL.moving.outSulk : CL.moving.out, { day: ev.rootedDay === s.clock.day + 1 ? 'tomorrow' : when }), ev.sulk ? 'warn' : 'good', 'patch');
  api.R?.fx?.({ type: 'dust', x: GX, z: GZ, n: 8 });
});
on('giant/sulk', (ev, api) => { if (ev.text) api.toast(ev.text, '', 'patch'); });
on('giant/rooted', (ev, api) => {
  float(api, CL.moving.leaf, 'good', 1.6);
  api.R?.fx?.({ type: 'sparkle', ...at(0.6), n: 8 });
  if (ev.sulked) api.toast(CL.moving.rooted, 'good', 'patch');
  api.sound('plink', { pitch: 1.3 });
});
on('giant/flower', (_ev, api) => api.R?.fx?.({ type: 'sparkle', ...at(0.6) }));
on('giant/set', (_ev, api) => { api.R?.fx?.({ type: 'sparkle', ...at(0.8), n: 12 }); api.haptic(20); });
on('giant/cull', (_ev, api) => { api.R?.fx?.({ type: 'pop', ...at(0.5), color: 0x7d9550, n: 10 }); api.sound('pop'); });
on('giant/measure', (_ev, api) => sfx(api, 'tape'));
on('giant/measured', (ev, api) => {
  const txt = !ev.days ? estText(ev.est) : ev.delta >= 0 ? `+${fmt.int(ev.delta)} lb${ev.days > 1 ? ` in ${ev.days} days` : ' since yesterday'}` : `−${fmt.int(-ev.delta)} lb? The tape is fickle.`;
  // [C] your own tape counts the inches up, then the pounds and the pace (ui/crawl.js); the Crawl's plays in its card
  if (ev.by === 'you') countUp(api, ev, txt);
  if (ev.by === 'crawl' || ev.by === 'you') { if (ev.record) api.R?.fx?.({ type: 'sparkle', ...at(2), n: 10 }); return; }
  setTimeout(() => {
    float(api, txt, ev.record ? 'good big' : 'good', 3.4);
    api.sound('ching', { pitch: ev.record ? 1.25 : 1 });
    if (ev.record) api.R?.fx?.({ type: 'sparkle', ...at(2), n: 10 });
  }, 900);
  api.haptic(10);
});
// the knock is always written over her too (sound may be off, and captions are off by default): the word is the pitch
on('giant/knock', (ev, api) => {
  sfx(api, 'knock', ev.pitch); api.R?.fx?.({ type: 'squash', id: 'giant', amount: 0.06 }); api.haptic(14);
  const word = knockWord(ev.pitch);
  UI.knock = word.toLowerCase();
  float(api, word, ev.pitch < 0.95 ? 'big' : '', 2.6);
});
on('giant/creak', (ev, api) => {
  const s = api.s();
  if (!s) return;
  const p = plantOf(s, ev.plot);
  api.notable(ev.soft ? line(s, LINES.giant.softSpot, { name: nameOf(p) }) : `${nameOf(p)} is creaking!`, { urgent: true, ic: 'alert', cls: 'warn' });
  api.haptic(30);
});
on('giant/heal', (_ev, api) => api.sound('done'));
on('giant/split', (ev, api) => {
  const s = api.s();
  if (!s) return;
  const p = plantOf(s, ev.plot);
  api.notable(ev.kind === 'blowout' ? `${nameOf(p).toUpperCase()} BLEW OUT. The one that got away.` : `A crack in ${nameOf(p)}! She keeps growing, slower.`, { urgent: true, ic: 'alert', cls: 'bad' });
  api.sound('thunk'); api.haptic(80);
  api.R?.fx?.({ type: 'pop', ...at(1.2), color: 0xe39a52, n: ev.kind === 'blowout' ? 22 : 8 });
});
on('giant/soak', (_ev, api) => { api.sound('squish'); api.R?.fx?.({ type: 'ripple', x: GX, z: GZ, color: 0x8cbdb6 }); api.R?.fx?.({ type: 'squash', id: 'giant', amount: 0.08 }); });
on('giant/scald', (_ev, api) => api.sound('thunk'));
on('giant/talk', (ev, api) => { float(api, `“${ev.text}”`, '', 3.2); api.sound('babble', { pitch: 1.1 }); });
on('giant/thanks', (_ev, api) => {
  const n = el('div.giant-thanks', { text: '...thanks' });
  document.body.append(n);
  sfx(api, 'thanks');
  setTimeout(() => n.remove(), T.events.cat.thanks.seconds * 1000);
});
on('giant/rotate', (ev, api) => { api.R?.fx?.({ type: 'squash', id: 'giant', amount: 0.15 }); api.sound(ev.crack ? 'thunk' : 'pop'); });
on('giant/crier', (ev, api) => api.sound(ev.told ? 'ching' : 'tick'));
// (at Halloween the trick-or-treat card shows the lot itself: no pill over it)
on('genetics/lot', (ev, api) => { if (ev.n && api.s()?.clock.phase !== 'halloween') api.toast(`${ev.n} seeds of '${ev.name}' saved for next year.`, 'good', 'pumpkin'); });
on('event', (ev, api) => { if (ev.id === 'kelp') api.sound('plink'); });
on('giant/setting', (ev, api) => {
  if (ev.key === 'shade') api.R?.fx?.({ type: 'squash', id: 'giant', amount: 0.05 });
  if (ev.key === 'regime') api.R?.fx?.({ type: 'ripple', x: GX, z: GZ, color: ev.value === 'heavy' ? 0x5f8fa3 : ev.value === 'light' ? 0xd9c49a : 0x8cbdb6 });
  if (ev.key === 'feed' && ev.value !== 'none') api.R?.fx?.({ type: 'pop', x: GX + 2, y: 0.4, z: GZ + 1.3, color: ev.value === 'kelp' ? 0x5d6b3a : 0x5d7fa0, n: 6 });
  if (ev.key === 'radio' && ev.value) api.R?.fx?.({ type: 'float', text: '♪', x: GX - 2, y: 1, z: GZ + 1.6 });
});
