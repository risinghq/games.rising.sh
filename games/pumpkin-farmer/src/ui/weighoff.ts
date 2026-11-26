// The weigh-off cinematic (design §8, §12): a full-screen overlay with the HUD hidden, one panel per beat above the dock,
// a leaderboard ribbon across the top and the FAB as Continue. It plays the minigames (Night Watch, HEAVE) and reports
// their results as actions, and it times every reveal (the sim has already decided everything; the UI decides only when
// you see it). Your own reveal is never skippable: the card read, slot-machine digits, the crowd chanting each hundred,
// the crawl past the chart, the lock, the stamp, the banners and his verdict (~22 s). Rival weigh-ins auto-play (5-8 s)
// and can be skipped from year 2. The scale's 3D readout mirrors the DOM digits (R.fx weighoff/readout).
import { $, el, icon, fmt, bump } from './dom.js';
import { registerScreen, registerFab, registerEvent } from './registry.js';
import { portraitEl } from './dialog.js';
import { T } from '../sim/tuning.js';
import { LINES, SPEAKERS } from '../sim/story.js';
import { PLACES } from '../sim/layout.js';
import { current, entryOf, judgesFor, heaviestId } from '../sim/weighoff.js';
import { commas } from '../sim/genetics.js';
import type { Action, State } from '../sim/types.js';
import type { Api } from './types.js';
import type { Grade, WatchPair, WeighoffEntry, WeighoffStep, WeighoffStepOf } from '../sim/state.js';
const WO = T.weighoff, L = LINES.wo, SC = PLACES.scale, LIFT = { x: -16.4, z: 13.6 };
interface WoFab { label: string; icon: string; onTap(): void }
interface WoBeat { fab?(): WoFab | null; frame?(s: State): void; exit?(): void }
interface WoUi {
  api: Api | null; node: HTMLElement | null; ctrl: WoBeat | null; key: string;
  board: HTMLElement; panel: HTMLElement; layer: HTMLElement;
  shown: Set<string>; lastShown: string; boardSig: string; inset: string; h: number; year: number;
}
const UI: WoUi = {
  api: null, node: null, ctrl: null, key: '', shown: new Set(), year: 0,
  board: document.createElement('div'), panel: document.createElement('div'), layer: document.createElement('div'),
  lastShown: '', boardSig: '', inset: '', h: -1,
};
const SPEAKERS_BY_KEY: Record<string, { name: string }> = SPEAKERS;
const QUIPS_BY_KEY: Record<string, { high: string; mid: string; low: string }> = L.pretty.quips;
const GAG_BY_NO: Record<number, { name: string; note: string; headline: string }> = L.gag;
const WM_LINES: Record<string, string> = LINES.weighmaster;
const now = () => performance.now();
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const lb = (n: number | undefined) => `${commas(n ?? NaN)} lb`;
const estText = (e: WeighoffEntry) => (e.gag ? 'est. 1 (one)' : e.est ? `est. ${estHidden(e.est)}` : "won't say");
function estHidden(est: number) { const h = String(Math.floor(est / 100)); return `${h.length > 1 ? h.slice(0, -1) + ',' + h.slice(-1) : h}?? lb`; }
const H = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN',
  'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
// the crowd chants each hundred: "NINE HUN-DRED!", "ONE THOU-SAND!", "TWELVE HUN-DRED!"
const chantOf = (v: number) => (v % 1000 === 0 ? `${H[v / 1000]} THOU-SAND!` : `${H[Math.floor(v / 100)] || commas(v)} HUN-DRED!`);

// ------------------------------------------------------------ little sounds (the shared blips cover the rest)
let ac: AudioContext | null = null, gestured = false;
addEventListener('pointerdown', () => { gestured = true; }, { capture: true, passive: true });
addEventListener('keydown', () => { gestured = true; }, { capture: true });
function sfx(kind: string) {
  const api = UI.api;
  if (!api?.settings.sound || !gestured) { const c = CAPS[kind]; if (api && c) api.caption(c); return; }
  try {
    const ctx = ac ||= new (globalThis.AudioContext ?? Reflect.get(globalThis, 'webkitAudioContext'))();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    const tone = (f0: number, f1: number, dur: number, type: OscillatorType = 'sine', gain = 0.12, delay = 0) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t0 + delay); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + delay + dur);
      g.gain.setValueAtTime(0.0001, t0 + delay); g.gain.exponentialRampToValueAtTime(gain, t0 + delay + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t0 + delay); o.stop(t0 + delay + dur + 0.05);
    };
    if (kind === 'giggle') [1400, 1250, 1500, 1300, 1600].forEach((f, i) => tone(f, f * 0.85, 0.07, 'triangle', 0.05, i * 0.09));
    else if (kind === 'digit') tone(1800 + Math.random() * 600, 1700, 0.025, 'square', 0.02);
    else if (kind === 'flash') tone(2400, 900, 0.12, 'sine', 0.08);
    else if (kind === 'fanfare') [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.32, 'triangle', 0.1, i * 0.11));
    else if (kind === 'wahwah') [392, 370, 349, 294].forEach((f, i) => tone(f, f * 0.94, i === 3 ? 0.7 : 0.3, 'sawtooth', 0.04, i * 0.32));
    else if (kind === 'gasp') { tone(300, 900, 0.5, 'sawtooth', 0.025); tone(320, 980, 0.5, 'sawtooth', 0.02, 0.03); }
    else if (kind === 'heave') tone(180, 120, 0.28, 'sawtooth', 0.06);
    else if (kind === 'drum') for (let i = 0; i < 10; i++) tone(110, 70, 0.08, 'sine', 0.08, i * 0.07);
  } catch { /* audio is best effort */ }
  const c = CAPS[kind]; if (c) api.caption(c);
}
const CAPS: Record<string, string> = { giggle: '(giggling, somewhere in the corn)', fanfare: 'a little fanfare', wahwah: 'wah-wah-waaah', gasp: 'the crowd gasps', drum: 'a drumroll' };

// ------------------------------------------------------------ DOM helpers
const dispatch = (a: Action) => UI.api?.dispatch(a);
const next = () => dispatch({ type: 'weighoff/next' });
function setPanel(...kids: (HTMLElement | null)[]) {
  const p = UI.panel;
  const flat = kids.flat().filter((k): k is HTMLElement => k != null);
  p.innerHTML = '';
  p.append(...flat);
  p.hidden = !flat.length;
  p.classList.remove('in'); void p.offsetWidth; p.classList.add('in');
}
const head = (eyebrow: string, title: string) => el('div.wo-head', {}, el('div.eyebrow', { text: eyebrow }), el('h2', { text: title }));
const portrait = (who: string, s: State | null) => (UI.api ? portraitEl(UI.api, who, s) : el('div.portrait'));
function bubble(who: string, text: string | undefined, s: State | null) {
  const b = el('div.wo-say', {}, portrait(who, s), el('div', {}, el('b', { text: SPEAKERS_BY_KEY[who]?.name || who }), el('span', { text })));
  return b;
}
function stamp(text: string, cls = '') { const n = el('div.wo-stamp', { class: cls, text }); return n; }
function pop(text: string, x: number, y: number, cls = '', ms = 1500) {
  const n = el('div.wo-pop', { class: cls, text, style: { left: `${x}px`, top: `${y}px` } });
  UI.layer.append(n);
  setTimeout(() => n.remove(), ms);
}
// A spectator by the scale has one thing to say about every pumpkin, and one better thing about the biggest of the day
// (the gag entries don't count, but they still get the compliment).
function spectator(s: State, e: WeighoffEntry) {
  const p = proj(-13.9, 2.3, 13.3), gurt = e.id === heaviestId(s);
  for (const n of document.querySelectorAll('.wo-pop.say')) n.remove();   // one remark at a time
  pop(gurt ? L.spectator.gurt : L.spectator.big, p.x, p.y, 'say', 6500);
}
const proj = (x: number, y: number, z: number) => UI.api?.R?.project?.(x, y, z) || { x: innerWidth / 2, y: innerHeight * 0.4 };
const haptic = (ms: number) => UI.api?.haptic(ms);
function readout(text: string | number) { UI.api?.R?.fx?.({ type: 'weighoff/readout', text: String(text).replace(/,/g, '') }); }

// ------------------------------------------------------------ the leaderboard ribbon
function syncBoard(s: State) {
  const wo = s.weighoff, show = wo.stage === 'pretty' || wo.stage === 'heavy' || wo.stage === 'results' || wo.stage === 'done';
  const sig = `${show}|${[...UI.shown].join(',')}`;
  if (sig === UI.boardSig) return;
  UI.boardSig = sig;
  UI.board.hidden = !show || !UI.shown.size;
  if (UI.board.hidden) return;
  const es = wo.entries.filter((e) => UI.shown.has(e.id));
  const valid = es.filter((e) => !e.gag && !e.dq && !e.exhibition).sort((a, b) => (b.W ?? 0) - (a.W ?? 0));
  const out = es.filter((e) => !valid.includes(e));
  UI.board.innerHTML = '';
  UI.board.append(el('span.wo-board-t', { text: 'Heaviest' }));
  valid.forEach((e, i) => UI.board.append(el('span.wo-slot', { class: `${e.you ? 'you' : ''} ${e.id === UI.lastShown ? 'new' : ''}` },
    el('b', { text: i + 1 }), el('span', { text: e.you ? e.name : e.grower.split(' ').pop() }), el('i', { text: commas(e.W ?? NaN) }))));
  out.forEach((e) => UI.board.append(el('span.wo-slot.out', {}, el('span', { text: e.gag ? 'Raccoons' : e.you ? e.name : e.grower.split(' ').pop() }), el('i', { text: 'DQ' }))));
  UI.board.querySelector('.new')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}
const reveal = (id: string) => { UI.shown.add(id); UI.lastShown = id; };

// ------------------------------------------------------------ the beats
const CTRL: Partial<Record<WeighoffStep['k'], (s: State, st: WeighoffStep) => WoBeat | null>> = {
  eve(s: State, st: WeighoffStep) {
    if (st.k !== 'eve') return null;
    const y1 = s.clock.year === 1, heist = s.weighoff.heist, t0 = now();
    let giggled = false;
    setPanel(head('Sun Oct 25 · 9:00 pm', 'The eve of the weigh-off'), el('p.wo-note', { text: heist ? L.eveNote.heist : y1 ? L.eveNote.y1 : L.eveNote.quiet }));
    return {
      fab: () => ({ label: heist ? 'Watch' : 'Sleep', icon: heist ? 'alert' : 'moon', onTap: next }),
      frame() {
        if (!giggled && now() - t0 > 1400 && (y1 || heist)) { giggled = true; sfx('giggle'); const p = proj(-11.9, 0.7, 11.2); pop('hee hee', p.x, p.y - 20, 'tiny'); }
      },
    };
  },
  watch(_s: State, st: WeighoffStep) {
    if (st.k !== 'watch') return null;
    const pairs = st.pairs || [], hits = new Set<number>(), btns = new Map<number, HTMLElement>(), done = new Set<number>(), shown = new Map<number, number>();
    let t0 = 0, sent = !!st.done;
    const bar = el('i'), score = el('span.wo-score', { text: '' });
    const intro = el('p.wo-note', { text: L.watch.hint });
    const defs = [st.flood && L.watch.flood, st.mavis && (st.nap ? L.watch.nap : L.watch.mavis), L.watch.biscuit].filter((d): d is string => !!d);
    setPanel(head('Night Watch', `${pairs.length} pairs of eyes`), intro, el('div.wo-timer', {}, bar), score, el('div.wo-defs', {}, defs.map((d) => el('span', { text: d }))));
    const caught = (p: WatchPair, by: string | null) => {
      done.add(p.k);
      UI.api?.R?.fx?.({ type: 'weighoff/eyes', k: p.k, on: false, caught: !!by });
      btns.get(p.k)?.remove(); btns.delete(p.k);
      const pr = proj(p.x, p.y, p.z);
      if (by) { pop(by === 'you' ? 'FLASH!' : by === 'biscuit' ? 'WOOF!' : by === 'flood' ? 'FLOODLIGHT!' : 'MAVIS!', pr.x, pr.y - 30, 'good'); sfx('flash'); haptic(15); }
      else { pop('hee hee', pr.x, pr.y - 30, 'bad'); sfx('giggle'); }
      const c = pairs.filter((x) => done.has(x.k) && (hits.has(x.k) || x.auto)).length, m = [...done].length - c;
      score.textContent = `Caught ${c} · missed ${m}`;
    };
    const finish = () => {
      if (sent) return;
      sent = true;
      const r = dispatch({ type: 'weighoff/watch', hits: [...hits] });
      if (r?.ok) {
        const scratches = Number(r.scratches), misses = Number(r.misses);
        setPanel(head('Night Watch', r.mustache ? 'A mustache!' : scratches ? `${scratches} scratch${scratches > 1 ? 'es' : ''}` : 'Not a scratch'),
          el('p.wo-note', { text: `Caught ${pairs.length - misses} of ${pairs.length}. ${misses <= WO.nightWatch.free ? 'Two misses are free.' : ''}` }));
      }
    };
    return {
      fab: () => (sent ? { label: 'Sleep', icon: 'moon', onTap: next } : t0 ? null : { label: 'Start', icon: 'alert', onTap: () => { t0 = now(); intro.textContent = L.watch.hint; } }),
      frame() {
        if (!t0 || sent) return;
        const t = (now() - t0) / 1000;
        bar.style.width = `${Math.max(0, 100 - (t / st.seconds) * 100)}%`;
        for (const p of pairs) {
          if (done.has(p.k)) continue;
          if (t >= p.at && !btns.has(p.k)) {
            UI.api?.R?.fx?.({ type: 'weighoff/eyes', k: p.k, on: true, x: p.x, y: p.y, z: p.z });
            const b = el('button.wo-eye', { 'aria-label': `Eyes in the ${p.where}`, html: '<i></i><i></i>' });
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (!done.has(p.k)) { hits.add(p.k); caught(p, 'you'); } });
            UI.layer.append(b); btns.set(p.k, b); shown.set(p.k, t);
          }
          const b = btns.get(p.k);
          if (b) { const pr = proj(p.x, p.y, p.z); b.style.transform = `translate(${pr.x}px, ${pr.y}px)`; }
          // the window opens when the eyes actually show, so a hitchy frame never eats a pair
          const t1 = shown.get(p.k);
          if (t1 == null) continue;
          if (p.auto && t >= t1 + 0.45) caught(p, p.auto);
          else if (t >= t1 + p.vis) caught(p, null);
        }
        if (done.size === pairs.length || t >= st.seconds + 4) finish();
      },
      exit() { for (const b of btns.values()) b.remove(); },
    };
  },
  dawn(s: State) {
    const wo = s.weighoff, rows = wo.order.flatMap((id) => { const e = entryOf(s, id); return e ? [e] : []; });
    setPanel(head('Mon Oct 26 · Weigh-off day', 'The line-up'), el('p.wo-note', { text: L.dawn }),
      el('div.wo-lineup', {}, rows.map((e, i) => el('div.wo-line', { class: e.you ? 'you' : null },
        el('b', { text: i + 1 }), el('div.grow', {}, el('div.t', { text: e.you ? `${e.name} (yours)` : `${e.grower}` }), el('div.d', { text: e.you ? e.farm : `'${e.name}' · ${e.farm}` })),
        el('span.est', { text: estText(e) })))));
    return { fab: () => ({ label: 'Next', icon: 'next', onTap: next }) };
  },
  arrive() {
    // the Weighmaster's entrance (render/cast.js): Marlene rolls in over the empty scale, he plops down, she lifts
    const t0 = now();
    let landed = 0, gone = false;
    setPanel(el('p.wo-caption', { text: 'Marlene rolls in over the scale...' }));
    return {
      fab: () => null,
      frame() {
        const here = UI.api?.R?.K?.cast?.weighmasterHere ?? (now() - t0 > 3500);
        if (here && !landed) {
          landed = now();
          const p = proj(SC.x, 2.6, SC.z);
          pop(L.gasp, p.x, p.y - 40, 'big'); sfx('gasp'); haptic(30);
          UI.api?.R?.fx?.({ type: 'squash', id: 'weighmaster', amount: 0.12 });
          setPanel(el('p.wo-caption', { text: 'The crowd gasps. He is twice the size of anybody.' }));
        }
        if ((landed && now() - landed > 1700) || now() - t0 > 9000) { if (!gone) { gone = true; next(); } }
      },
    };
  },
  welcome() {
    setPanel(el('p.wo-caption', { text: 'The Q.S.C. Official Scale is open.' }));
    return { fab: () => ({ label: 'Next', icon: 'next', onTap: next }) };
  },
  lift(s: State, st: WeighoffStep) {
    if (st.k !== 'lift') return null;
    const e = entryOf(s, st.id), grades: Grade[] = [];
    let phase = st.done ? 'done' : st.auto ? 'auto' : 'ready', beat = -1, b0 = 0, tapped = false, t0 = now();
    const ring = el('div.wo-ring', {}, el('i.target'), el('i.closer'));
    const heave = el('button.btn.primary.wo-heave', { html: `${icon('pumpkin')}<span>HEAVE!</span>` });
    // the count is the real one: Officer Mavis playing dead mid-lift adds a fifth beat
    const nBeats = st.beats || 4, words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][nBeats] || String(nBeats);
    const info = el('p.wo-note', { text: st.auto === 'forklift' ? L.lift.forklift : st.auto === 'ring' ? L.lift.ring
      : `Tap HEAVE as the ring closes on her. ${words} good beats${st.mavisAt >= 0 ? ' (Mavis is on the rope)' : ''}.` });
    const marks = el('div.wo-marks', {}, Array.from({ length: st.beats || 4 }, () => el('i')));
    UI.layer.append(ring); ring.hidden = true;
    setPanel(head(`The lift · ${e?.name || 'your giant'}`, st.auto ? 'Easy does it' : 'HEAVE!'), info, st.auto ? null : marks, st.auto ? null : heave);
    const grade = (dt: number): Grade => (Math.abs(dt) <= WO.lift.perfect ? 'perfect' : Math.abs(dt) <= WO.lift.good ? 'good' : 'wobble');
    const heaveTxt = (t: string) => { const sp = heave.querySelector('span'); if (sp) sp.textContent = t; };
    const settle = (g: Grade) => {
      grades.push(g);
      marks.children[beat]?.classList.add(g);
      const p = proj(LIFT.x, 1.2, LIFT.z);
      pop(g === 'perfect' ? 'PERFECT!' : g === 'good' ? 'GOOD!' : 'WOBBLE!', p.x, p.y - 60, g === 'wobble' ? 'bad' : 'good');
      pop(L.lift.chant, p.x + (beat % 2 ? 70 : -70), p.y - 10, 'chant');
      UI.api?.sound('chant', { pitch: 1 + beat * 0.06 }); sfx('heave'); haptic(g === 'wobble' ? 40 : 18);
      UI.api?.R?.fx?.({ type: 'weighoff/beat', k: beat, n: st.beats, grade: g });
      if (beat === st.mavisAt) UI.api?.toast(L.lift.mavis, 'event', 'alert');
      ring.classList.remove('hit'); void ring.offsetWidth; ring.classList.add('hit');
    };
    const tap = (ev: PointerEvent) => {
      ev?.preventDefault?.();
      if (phase === 'ready') { phase = 'beats'; beat = 0; b0 = now() + WO.lift2.lead * 1000; tapped = false; ring.hidden = false; return; }
      if (phase !== 'beats' || tapped || now() < b0 - 500) return;
      tapped = true;
      settle(grade((now() - b0 - st.ring * 1000) / 1000));
      bump(heave);
    };
    heave.addEventListener('pointerdown', tap);
    const send = () => {
      phase = 'done'; ring.hidden = true;
      const r = dispatch({ type: 'weighoff/heave', plot: st.plot, beats: grades });
      if (r?.ok) setPanel(head('The lift', r.crack ? 'Crack!' : r.scuff ? 'A scuff' : r.perfect ? 'Textbook!' : 'On the scale'),
        el('p.wo-note', { text: r.crack ? L.heave.crack : r.scuff ? L.heave.scuff : r.perfect ? L.heave.perfect : L.heave.good }),
        el('div.wo-marks', {}, (Array.isArray(r.grades) ? r.grades : []).map((g) => el('i', { class: String(g) }))));
    };
    return {
      fab: () => (phase === 'done' || (phase === 'auto' && now() - t0 > 2400) ? { label: 'Next', icon: 'next', onTap: next } : null),
      frame() {
        if (phase === 'ready') heaveTxt('Ready? Tap!');
        if (phase !== 'beats') return;
        heaveTxt('HEAVE!');
        const p = proj(LIFT.x, 0.9, LIFT.z), dur = st.ring * 1000, k = (now() - b0) / dur;
        ring.style.transform = `translate(${p.x}px, ${p.y}px)`;
        ring.style.setProperty('--k', Math.max(0, Math.min(1.4, k)).toFixed(3));
        ring.style.opacity = k < -0.3 ? '0' : '1';
        if (!tapped && now() - b0 - dur > WO.lift.good * 1000) { tapped = true; settle('wobble'); }
        if (tapped && now() - b0 - dur > WO.lift.good * 1000 + WO.lift2.gap * 1000) {
          if (grades.length >= st.beats) { send(); return; }
          beat++; tapped = false; b0 = now() + 120;
        }
      },
      exit() { ring.remove(); },
    };
  },
  inspect(s: State, st: WeighoffStep) {
    if (st.k !== 'inspect') return null;
    const e = entryOf(s, st.id), t0 = now();
    let stamped = false;
    UI.node?.classList.add('wo-dim');
    setPanel(head(`Inspection · ${e?.name || ''}`, 'The flashlight'), el('p.wo-note', { text: 'He circles her once. Nobody breathes.' }));
    return {
      fab: () => (stamped && now() - t0 > 3600 ? { label: 'Next', icon: 'next', onTap: next } : null),
      frame() {
        if (stamped || now() - t0 < 2800) return;
        stamped = true;
        UI.node?.classList.remove('wo-dim');
        const pass = st.pass;
        setPanel(head(`Inspection · ${e?.name || ''}`, pass ? 'Passed' : 'Exhibition only'), stamp(pass ? L.stamp.pass : L.stamp.exhibition, pass ? 'good' : 'bad'),
          bubble('weighmaster', (st.lines || []).join(' '), s));
        UI.api?.sound(pass ? 'thunk' : 'foghorn'); haptic(pass ? 30 : 60);
      },
      exit() { UI.node?.classList.remove('wo-dim'); },
    };
  },
  pretty(s: State, st: WeighoffStep) {
    if (st.k !== 'pretty') return null;
    const pr = s.weighoff.pretty, judges = pr?.judges || judgesFor(s.clock.year);
    let t0 = now();
    const mine = pr?.board.find((b) => b.id.startsWith('you')), ranked = (pr?.board || []).filter((b) => b.place).sort((a, b) => (a.place ?? 0) - (b.place ?? 0));
    const quip = (j: string, v: number) => { const Q = QUIPS_BY_KEY[j] || L.pretty.quips.mayor; return j === 'moss' ? (v >= 9 ? Q.high : Q.mid) : v >= 8.5 ? Q.high : v >= 7 ? Q.mid : Q.low; };
    const cards = judges.map((j, i) => {
      const v = mine?.cards?.[i];
      return el('div.wo-judge', {}, portrait(j, s), el('div.wo-card', {}, el('b', { text: v != null ? v.toFixed(1) : '—' })), el('span.q', { text: v != null ? quip(j, v) : '' }));
    });
    const ribbons = el('div.wo-ribbons');
    setPanel(head('Prettiest', mine ? (mine.mustache ? 'Not eligible' : `${entryOf(s, mine.id)?.name || 'Yours'}: the judges' cards`) : 'The judges'),
      mine?.mustache ? el('p.wo-note', { text: L.pretty.mustache }) : el('div.wo-judges', {}, cards), ribbons);
    let flipped = 0, ribboned = 0;
    return {
      fab: () => (ribboned >= Math.min(3, ranked.length) && now() - t0 > 900 ? { label: 'Next', icon: 'next', onTap: next } : null),
      frame(s: State) {
        // the cards wait for the Mayor's "Judges, your cards, please" to be read, so the flips land after it
        if (!flipped && !ribboned && s.story.dialog.length) { t0 = now(); return; }
        const t = (now() - t0) / 1000;
        if (mine && !mine.mustache) while (flipped < cards.length && t > 0.9 + flipped * 0.7) { cards[flipped]?.classList.add('flip'); UI.api?.sound('pop'); haptic(8); flipped++; }
        const after = mine && !mine.mustache ? 1.2 + cards.length * 0.7 : 0.9;
        const order = ranked.slice(0, 3).reverse();
        while (ribboned < order.length && t > after + ribboned * 0.9) {
          const b = order[ribboned];
          if (!b) break;
          const e = entryOf(s, b.id), place = b.place ?? 0;
          if (e) ribbons.prepend(el('div.wo-ribbon', { class: `p${place} ${b.id.startsWith('you') ? 'you' : ''}` }, el('b', { text: ord(place) }),
            el('span', { text: e.you ? `${e.name} (yours)` : `${e.grower}` }), el('i', { text: b.total.toFixed(1) })));
          UI.api?.sound(place === 1 ? 'ching' : 'plink'); haptic(place === 1 ? 25 : 10);
          if (place === 1 && b.id.startsWith('you')) sfx('fanfare');
          ribboned++;
        }
      },
    };
  },
  weigh(s: State, st: WeighoffStep) {
    if (st.k !== 'weigh') return null;
    return entryOf(s, st.id)?.you ? yourReveal(s, st) : rivalWeigh(s, st);
  },
  results(s: State, st: WeighoffStep) {
    if (st.k !== 'results') return null;
    document.body.classList.add('wo-results');
    const e = st.best ? entryOf(s, st.best) : null;
    const title = st.place ? `${ord(st.place)} Heaviest` : st.exhibition ? 'Exhibition only' : e ? 'Weighed' : 'No entry this year';
    const items = el('div.wo-prizes'), ePct = e?.pct ?? NaN;
    setPanel(head(`Results · Year ${s.clock.year}`, title),
      e ? el('div.wo-big', {}, el('b', { text: lb(e.W) }), el('span', { text: `${e.name} · ${ePct >= 0 ? '+' : '−'}${Math.abs(ePct * 100).toFixed(1)}% vs chart` })) : el('p.wo-note', { text: L.noEntry }),
      st.prettyPlace ? el('p.wo-note', { text: `${ord(st.prettyPlace)} Prettiest.` }) : null,
      el('div.wo-banners', {}, st.record ? stamp(L.stamp.record, 'gold') : null, st.pb ? stamp(L.stamp.pb, 'good') : null, st.crown ? stamp('DOUBLE CROWN', 'gold') : null),
      items, st.seeds ? el('p.wo-seeds', { html: `${icon('pumpkin', 's')}<span>${st.seeds}</span>` }) : null);
    let k = 0;
    const t0 = now();
    return {
      fab: () => ({ label: 'Onward', icon: 'next', onTap: next }),
      frame() {
        while (k < st.prizes.length && now() - t0 > 700 + k * 450) {
          const p = st.prizes[k++];
          if (!p) break;
          items.append(el('div.ledger-row.wo-prize', {}, el('span', { text: p.label }), el('span.v', { text: fmt.money(p.amount) })));
          UI.api?.sound('ching', { pitch: 1 + k * 0.05 }); haptic(10);
          UI.api?.R?.fx?.({ type: 'coins', amount: p.amount, x: SC.x, z: SC.z });
          if (k === st.prizes.length) items.append(el('div.ledger-total', {}, el('span', { text: 'Prize money' }), el('span.num', { text: fmt.money(st.total) })));
        }
      },
      exit() { document.body.classList.remove('wo-results'); },
    };
  },
};

// A rival on the scale: the placard, quick digits, the lock, maybe a DQ stamp, then a Next pumpkin button; skippable from year 2.
function rivalWeigh(s: State, st: WeighoffStepOf<'weigh'>): WoBeat | null {
  const e = entryOf(s, st.id);
  if (!e) return null;
  const t0 = now(), dur = WO.rivalDigitsMs ?? 2800, W = e.W ?? NaN;               // digits climb, then the player moves on
  let locked = false, gone = false, last = -1;
  const digits = el('div.wo-digits', { text: '0' });
  const skip = s.clock.year >= WO.rivalSkipFrom ? el('button.chip.wo-skip', { html: `${icon('skip', 's')}Skip rivals`, onclick: () => { gone = true; reveal(e.id); dispatch({ type: 'weighoff/skipRivals' }); } }) : null;
  const panel = el('div.wo-weigh', {}, el('div.wo-placard', {}, el('b', { text: e.gag ? (GAG_BY_NO[Math.min(s.clock.year, 4)] ?? L.gag[4]).name : `'${e.name}'` }),
    el('span', { text: `${e.grower} · ${e.farm}` }), el('i', { text: estText(e) })), el('div.wo-readout', {}, digits, el('small', { text: 'LB' })));
  setPanel(head('The Heaviest', e.gag ? 'The Parking Lot Patch' : e.grower), panel, st.note ? el('p.wo-note', { text: st.note }) : null, skip);
  // no auto-advance: the jokes on the placards and in the crowd need time, so the player moves on
  return {
    fab: () => (locked && !gone && now() - t0 > dur + 600 ? { label: 'Next pumpkin', icon: 'next', onTap: () => { gone = true; next(); } } : null),
    frame() {
      const k = Math.min(1, (now() - t0) / dur), v = Math.round(W * easeOut(k));
      if (!locked && v !== last) { digits.textContent = commas(v); readout(v); last = v; if (k < 1) sfx('digit'); }
      if (k >= 1 && !locked) {
        locked = true; reveal(e.id);
        UI.api?.sound('thunk'); haptic(14);
        setTimeout(() => spectator(s, e), 450);
        if (st.dq) { panel.after(el('div.wo-stamps', {}, stamp(e.gag ? L.stamp.dq : L.stamp.exhibition, 'bad'))); UI.api?.sound('foghorn'); }
      }
    },
  };
}

// YOUR reveal (never skippable, ~22 s; design §8 beat table)
function yourReveal(s: State, st: WeighoffStepOf<'weigh'>): WoBeat | null {
  const e = entryOf(s, st.id);
  if (!e) return null;
  const W = e.W ?? NaN, E = e.chart || W, ex = !!e.exhibition, t0 = now();
  const C = { read: 3000, flicker: 6000, count: 13000 }, crawlFrom = Math.round(W * WO.reveal.countTo);
  const crawlMs = Math.min(5500, Math.max(2500, (W - crawlFrom) * WO.reveal.crawlMs));
  const crawlEnd = C.count + crawlMs, stall = W < E ? WO.reveal2.stall : 0, lockAt = crawlEnd + stall;
  const digits = el('div.wo-digits.big', { text: '0' }), chart = el('div.wo-chart', { text: `Chart ${estHidden(E)}` });
  const box = el('div.wo-weigh.mine', {}, el('div.wo-placard', {}, el('b', { text: `'${e.name}'` }), el('span', { text: `Grower ${s.meta.surname}` }), chart),
    el('div.wo-readout', {}, digits, el('small', { text: 'LB' })));
  const extra = el('div.wo-stamps'), read = bubble('weighmaster', st.read, s);
  setPanel(head('The Heaviest', 'Your giant'), read, box, extra);
  UI.api?.R?.fx?.({ type: 'weighoff/reveal', phase: 'read' });
  sfx('drum');
  let shown = 0, flashed = false, locked = false, after = 0, lastV = -1;
  const set = (v: number) => { const t = commas(v); if (t !== digits.textContent) { digits.textContent = t; readout(v); } };
  return {
    fab: () => (after >= 3 ? { label: 'Next', icon: 'next', onTap: next } : null),
    frame() {
      const t = now() - t0;
      if (t < C.read) { const p = proj(-18.4, 1.6, 14.2); if (!shown && t > 600) { shown = 1; pop('shhh...', p.x, p.y, 'tiny'); } return; }
      if (t < C.flicker) { if ((t / 70 | 0) !== lastV) { lastV = t / 70 | 0; digits.textContent = String(1000 + Math.floor(Math.random() * 9000)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); readout(digits.textContent); sfx('digit'); } return; }
      if (t < C.count) {
        if (shown < 2) { shown = 2; UI.api?.R?.fx?.({ type: 'weighoff/reveal', phase: 'count' }); }
        const v = Math.round(crawlFrom * easeOut((t - C.flicker) / (C.count - C.flicker)));
        set(v);
        const h = Math.floor(v / 100);
        if (h > UI.h && h >= 1) { UI.h = h; const p = proj(-18.2, 1.8, 14.0); pop(chantOf(h * 100), p.x + (h % 2 ? 40 : -40), p.y - 10, 'chant'); UI.api?.sound('chant', { pitch: 0.9 + h * 0.03 }); haptic(WO.reveal2.hundredHaptic); }
        return;
      }
      if (t < crawlEnd) {
        const v = Math.min(W, crawlFrom + Math.floor(((t - C.count) / crawlMs) * (W - crawlFrom)));
        set(v);
        if (!flashed && v >= E && W >= E) { flashed = true; chart.textContent = `Chart ${lb(E)}`; chart.classList.add('hit'); pop(L.stamp.chart, innerWidth / 2, innerHeight * 0.32, 'big'); haptic(25); UI.api?.sound('plink', { pitch: 1.4 }); }
        if ((t / 40 | 0) % 2) sfx('digit');
        return;
      }
      if (t < lockAt) { set(W); if (!flashed) { flashed = true; chart.textContent = `Chart ${lb(E)}`; chart.classList.add('miss'); } return; }
      if (!locked) {
        locked = true; set(W); reveal(e.id);
        // the reveal photo for the Crier and the scrapbook: the digits locked, the instant before Marlene rolls in (or the
        // golden light breaks), in the day's own fog
        try { const url = UI.api?.R?.photo?.(WO.photo.w, WO.photo.h, 'image/jpeg', 0.85, { crisp: true, focus: { x: SC.x, y: 1.4, z: SC.z }, tight: 0.72 }); if (url) UI.api?.photo.save(s.clock.year, url); } catch { /* best effort */ }
        const pct = e.pct ?? NaN, heavy = !ex && pct >= 0, light = !ex && pct < 0;
        UI.api?.R?.fx?.({ type: 'weighoff/reveal', phase: 'lock', heavy, light, exhibition: ex });
        UI.api?.sound('thunk'); haptic(45);
        const pctS = `${pct >= 0 ? '+' : '−'}${Math.abs(pct * 100).toFixed(1)}%`;
        extra.append(stamp(ex ? L.stamp.exhibition : `${pctS} ${heavy ? L.stamp.heavy : L.stamp.light}`, ex ? 'bad' : heavy ? 'good' : 'warn'));
        if (ex) UI.api?.sound('foghorn'); else sfx(heavy ? 'fanfare' : 'wahwah');
        setTimeout(() => spectator(s, e), 900);
        return;
      }
      const ta = t - lockAt;
      if (after === 0 && ta > 1200) {
        after = 1;
        if (st.record) { extra.append(stamp(L.stamp.record, 'gold')); sfx('fanfare'); haptic(60); }
        else if (st.pb) { extra.append(stamp(L.stamp.pb, 'good')); UI.api?.sound('ching'); }
        const pl = (st.standings || []).find((x) => x.id === e.id)?.place;
        if (pl) extra.append(el('span.wo-sofar', { text: `${ord(pl)} so far` }));
      }
      if (after === 1 && ta > 2200) {
        after = 2;
        if (st.verdict) read.replaceWith(bubble('weighmaster', WM_LINES[st.verdict], s));
      }
      if (after === 2 && ta > 3000) { after = 3; UI.api?.R?.fx?.({ type: 'weighoff/reveal', phase: 'hold' }); }
    },
    exit() { UI.h = -1; UI.api?.R?.fx?.({ type: 'weighoff/reveal', phase: 'done' }); },
  };
}

// ------------------------------------------------------------ the screen
function layout() {
  const tray = $('#tray')?.getBoundingClientRect();
  if (!tray || !UI.node) return;
  UI.node.style.setProperty('--wo-bottom', `${Math.max(80, innerHeight - tray.top + 8)}px`);
  const p = UI.panel.hidden ? null : UI.panel.getBoundingClientRect(), desk = innerWidth >= 900;
  // phones: the subject sits above the panel; desktop: the panel docks right, the subject sits left of it
  const bottom = p && !desk ? innerHeight - p.top + 6 : innerHeight - tray.top + 6, top = (UI.board.hidden ? 52 : 96) + (document.body.classList.contains('wo-results') ? 56 : 0), right = p && desk ? innerWidth - p.left + 8 : 0;
  const sig = `${Math.round(bottom)}|${top}|${Math.round(right)}|${innerWidth}`;
  if (sig !== UI.inset) { UI.inset = sig; UI.api?.R?.cam?.setInset?.(bottom, top, right); }
  document.body.style.setProperty('--wo-toasts', `${Math.round(desk ? innerHeight - tray.top + 10 : bottom + 6)}px`);
}
registerScreen('weighoff', {
  auto: (s: State) => s.clock.phase === 'weighoff' && !!s.weighoff?.steps?.length && s.weighoff.stage !== 'done',
  build(node, _s, api) {
    UI.api = api; UI.node = node; UI.key = ''; UI.ctrl = null; UI.inset = '';
    node.classList.add('wo');
    UI.board = el('div.wo-board'); UI.board.hidden = true;
    UI.panel = el('div.wo-panel.card'); UI.panel.hidden = true;
    UI.layer = el('div.wo-layer');
    node.append(UI.layer, UI.board, UI.panel);
    document.body.classList.add('wo-cine');
  },
  update(_node, s: State) {
    const wo = s.weighoff, st = current(s);
    if (!st) return;
    if (UI.year !== wo.year) { UI.year = wo.year; UI.shown = new Set(); UI.boardSig = ''; UI.h = -1; }
    const key = `${wo.year}|${wo.i}`;
    if (key !== UI.key) {
      // a load mid-weigh-off: everything weighed before this step is already on the board
      wo.steps.forEach((x, i) => { if (x.k === 'weigh' && i < wo.i) UI.shown.add(x.id); });
      UI.ctrl?.exit?.();
      UI.key = key;
      UI.ctrl = CTRL[st.k]?.(s, st) || null;
    }
    UI.ctrl?.frame?.(s);
    // no Continue right now (someone is talking, or a minigame has your thumb): the dock steps aside too
    document.body.classList.toggle('wo-nofab', !(UI.ctrl?.fab?.() && !s.story.dialog.length));
    syncBoard(s);
    layout();
  },
  onClose() { UI.ctrl?.exit?.(); UI.ctrl = null; UI.key = ''; document.body.classList.remove('wo-cine', 'wo-results', 'wo-nofab'); UI.api?.R?.cam?.setInset?.(0, 0, 0); },
});

// The FAB is Continue (or Sleep / Watch / Start); it hides while somebody is talking or a minigame wants your thumb.
registerFab({
  id: 'weighoff', priority: 40,
  when: (s: State) => s.clock.phase === 'weighoff',
  label: (s: State) => (UI.ctrl?.fab?.() && !s.story.dialog.length ? UI.ctrl?.fab?.()?.label ?? '' : ''),
  icon: () => UI.ctrl?.fab?.()?.icon || 'next',
  cls: (s: State) => (UI.ctrl?.fab?.() && !s.story.dialog.length ? 'sage' : 'wo-hide'),
  onTap: (api: Api) => { const f = UI.ctrl?.fab?.(); if (f && !api.s()?.story.dialog.length) { f.onTap(); api.haptic(10); } },
});

registerEvent('weighoff/stage', (_ev, api) => { UI.api = api; });
