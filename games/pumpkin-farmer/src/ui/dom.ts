// Tiny DOM helpers, number/date formatting and the inline SVG icon set (24x24, stroked, currentColor).
import { label, dowName, clockLabel, isWeekend, weekendIndex } from '../sim/calendar.js';
import type { State } from '../sim/types.js';

export const $ = (sel: string, root: ParentNode = document) => root.querySelector<HTMLElement>(sel);
export const $$ = (sel: string, root: ParentNode = document) => [...root.querySelectorAll<HTMLElement>(sel)];
// A node index.html always has (#game-ui, #pins, #toasts...). Missing means the page shell is broken.
export function need(sel: string, root: ParentNode = document): HTMLElement {
  const n = root.querySelector<HTMLElement>(sel);
  if (!n) throw new Error(`dom: ${sel} is missing`);
  return n;
}

type Primitive = string | number | boolean;
export type Child = Node | Primitive | null | undefined | readonly Child[];
export interface Props {
  text?: Primitive | null;
  html?: string | null;
  class?: string | false | null;
  style?: Partial<CSSStyleDeclaration> | Record<`--${string}`, string | number> | null;
  data?: Record<string, Primitive | null | undefined> | null;
  onclick?: ((e: MouseEvent) => void) | null;
  oninput?: ((e: Event) => void) | null;
  onchange?: ((e: Event) => void) | null;
  onkeydown?: ((e: KeyboardEvent) => void) | null;
  onpointerdown?: ((e: PointerEvent) => void) | null;
  [attr: string]: Primitive | null | undefined | object;
}

// el('button.btn.primary', { onclick, data: { k: v }, html }, ...children)
export function el(sel: string, props?: Props | null, ...kids: Child[]): HTMLElement {
  const [tag, ...cls] = sel.split('.');
  const n = document.createElement(tag || 'div');
  if (cls.length) n.className = cls.join(' ');
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'html') n.innerHTML = String(v);
    else if (k === 'text') n.textContent = String(v);
    else if (k === 'class') n.className += ' ' + String(v);
    else if (k === 'style' && typeof v === 'object') applyStyle(n, v);
    else if (k === 'data' && typeof v === 'object') {
      for (const [dk, dv] of Object.entries(v)) if (dv != null) n.dataset[dk] = String(dv);
    }
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v as EventListener);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  append(n, kids);
  return n;
}
// Custom properties (--accent) need setProperty; plain ones assign.
function applyStyle(n: HTMLElement, style: object) {
  for (const [k, v] of Object.entries(style)) {
    if (v == null) continue;
    if (k.startsWith('--')) n.style.setProperty(k, String(v));
    else n.style.setProperty(k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), String(v));
  }
}
function append(n: Node & ParentNode, kids: readonly Child[]) {
  for (const c of kids) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(n, c);
    else n.append(c instanceof Node ? c : String(c));
  }
}
export const clear = <T extends Node>(n: T) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
// Re-run a CSS animation class on a node (squash on tap, cash bump).
export function bump(n: HTMLElement | null, cls = 'squash') { if (!n) return; n.classList.remove(cls); void n.offsetWidth; n.classList.add(cls); }

// ------------------------------------------------------------ formatting
const nf = new Intl.NumberFormat('en-US');
export const fmt = {
  money: (n: number) => `${n < 0 ? '−' : ''}$${nf.format(Math.round(Math.abs(n)))}`,
  cents: (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2).replace(/\.00$/, '')}`,
  int: (n: number) => nf.format(Math.round(n)),
  pct: (x: number) => `${Math.round(x * 100)}%`,
  lb: (n: number) => `${nf.format(Math.round(n))} lb`,
  time: (minute: number) => clockLabel(minute),
  // HUD date: 'Jul 14', 'Thu Oct 1', 'Sat Oct 3'; winter has no date
  date(s: State) {
    const c = s.clock;
    if (c.phase === 'winter') return 'Winter';
    if (c.phase === 'newgame') return 'Mar 31';
    return label(c.day);
  },
  // the small line under the date: weekday in October, the weekend, the phase
  sub(s: State) {
    const c = s.clock, y = `Year ${c.year}`;
    if (c.phase === 'october') return isWeekend(c.day) ? `${dowName(c.day)} · W${weekendIndex(c.day) + 1}` : `${dowName(c.day)} · ${y}`;
    if (c.phase === 'weighoff') return s.weighoff?.stage === 'eve' ? 'The eve' : 'Weigh-off';
    if (c.phase === 'halloween') return 'Halloween';
    if (c.phase === 'winter') return `Before year ${c.year + 1}`;
    return y;
  },
};

// ------------------------------------------------------------ icons
const P: Record<string, string> = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  fog: '<path d="M3 8.5c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M3 13.5c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M5 18.5c1.7-1.3 3.3-1.3 5 0s3.3 1.3 5 0 3.3-1.3 4 0"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  partsun: '<path d="M8 2.8v1.6M2.8 8h1.6M4.3 4.3l1.1 1.1M11.7 4.3l-1.1 1.1"/><path d="M5.2 10.4A3.4 3.4 0 0 1 11 6.4"/><path d="M8 19.5h9.5a3.6 3.6 0 0 0 .3-7.2 5 5 0 0 0-9.6 1.3A3 3 0 0 0 8 19.5z"/>',
  cloud: '<path d="M7 18.5h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.6A3.2 3.2 0 0 0 7 18.5z"/>',
  rain: '<path d="M7 14h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.6A3.2 3.2 0 0 0 7 14z"/><path d="M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3"/>',
  heat: '<path d="M14 14.6V5a2 2 0 0 0-4 0v9.6a4 4 0 1 0 4 0z"/><path d="M12 9.5v6.5"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  play: '<path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor"/>',
  ff: '<path d="M3.5 6.5l8 5.5-8 5.5zM12.5 6.5l8 5.5-8 5.5z" fill="currentColor" stroke-width="1.4"/>',
  skip: '<path d="M4.5 6.5l8.5 5.5-8.5 5.5z" fill="currentColor" stroke-width="1.4"/><path d="M17.5 6v12"/><path d="M13 9.5l3 2.5-3 2.5" stroke-width="1.6"/>',
  drop: '<path d="M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z"/>',
  pumpkin: '<path d="M12 7.5c-5 0-8.5 2.7-8.5 6.4S7 20.5 12 20.5s8.5-2.9 8.5-6.6S17 7.5 12 7.5z"/><path d="M12 7.5c-2 0-3.2 2.9-3.2 6.5s1.2 6.5 3.2 6.5 3.2-2.9 3.2-6.5-1.2-6.5-3.2-6.5z"/><path d="M12 7.5V5c0-1 .7-1.9 1.8-2.2"/>',
  giant: '<path d="M12 6.5C6.2 6.5 2.5 9.6 2.5 14S6.2 21 12 21s9.5-2.6 9.5-7-3.7-7.5-9.5-7.5z"/><path d="M8.3 7.3C7 9 6.4 11.4 6.4 14s.6 5 1.9 6.7M15.7 7.3C17 9 17.6 11.4 17.6 14s-.6 5-1.9 6.7"/><path d="M12 6.5V4l2.6-1.2"/>',
  patch: '<path d="M12 20.5v-8"/><path d="M12 12.5c0-3.6-2.6-6.2-6.7-6.2 0 3.6 2.6 6.2 6.7 6.2zM12 14.5c0-3.1 2.3-5.6 6.2-5.6 0 3.1-2.3 5.6-6.2 5.6z"/><path d="M3.5 20.5h17"/>',
  barn: '<path d="M3.5 11l8.5-6.5 8.5 6.5v9.5h-17z"/><path d="M9 20.5v-6h6v6M9 14.5l6 6M15 14.5l-6 6"/>',
  hives: '<path d="M5 20.5h14l-1-3.5H6zM6 17l1-3.5h10l1 3.5M7 13.5l1.4-3.5h7.2l1.4 3.5M8.4 10C9 6.5 10.3 4.5 12 4.5s3 2 3.6 5.5"/><path d="M10.8 20.5v-2h2.4v2"/>',
  almanac: '<path d="M5 4.8A1.8 1.8 0 0 1 6.8 3H19v15H6.8A1.8 1.8 0 0 0 5 19.8z"/><path d="M5 19.8A1.8 1.8 0 0 0 6.8 21.5H19V18"/><path d="M9 7.5h6M9 11h4"/>',
  stand: '<path d="M3 9l2-5h14l2 5"/><path d="M3 9c0 1.4 1 2.4 2.25 2.4S7.5 10.4 7.5 9c0 1.4 1 2.4 2.25 2.4S12 10.4 12 9c0 1.4 1 2.4 2.25 2.4S16.5 10.4 16.5 9c0 1.4 1 2.4 2.25 2.4S21 10.4 21 9"/><path d="M5 11.4V20.5h14v-9.1M9.5 20.5v-5h5v5"/>',
  lot: '<path d="M5 15.5V11l2-4.5h10L19 11v4.5"/><path d="M3.5 15.5h17v2.5h-17z"/><circle cx="7.5" cy="18.5" r="1.6"/><circle cx="16.5" cy="18.5" r="1.6"/><path d="M5 11h14"/>',
  home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.4c-.7.3-1.1.9-1.1 1.6v.5"/><path d="M12 17.2v.2"/>',
  ledger: '<path d="M6 3h12v18H6z"/><path d="M9 7.5h6M9 11.5h6M9 15.5h3"/>',
  scrapbook: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8"/>',
  exit: '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  stroll: '<circle cx="13.5" cy="4.5" r="1.8"/><path d="M9.5 21l2.3-6.2 2.7 2.7V21M7.5 12.5l2.3-4.3 3.6.9 1.8 3.1 2.8.9M11.8 14.8l-1-3.6"/>',
  whale: '<path d="M2.5 13c0 3.6 3.6 6.2 8.8 6.2 4.6 0 7.6-2.6 8.7-6.2l1.6-2.5-1.8.3c-.8-1-2-1.5-3.5-1.5-3.1 0-4 2.6-6.6 2.6S4.6 10 2.5 13z"/><path d="M8.5 7.5c0-1.5 1-2.6 2-3.1M8.5 7.5c0-1.5-1-2.6-2-3.1M8.5 7.5V10"/>',
  alert: '<path d="M12 4a5 5 0 0 0-5 5v3.5L5 16h14l-2-3.5V9a5 5 0 0 0-5-5z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  // [E] a hand pin: something to touch with your own paws (the bug hunt)
  hand: '<path d="M9 12V5.2a1.6 1.6 0 0 1 3.2 0V11M12.2 10.6V9.2a1.6 1.6 0 0 1 3.2 0v2M15.4 11.2v-.6a1.6 1.6 0 0 1 3.2 0v3.9a6.3 6.3 0 0 1-6.3 6.3h-.9a6.3 6.3 0 0 1-4.9-2.4l-2.4-3a1.7 1.7 0 0 1 2.5-2.3L9 15.3"/>',
  sparkle: '<path d="M12 3c.8 4.5 2.5 6.2 7 7-4.5.8-6.2 2.5-7 7-.8-4.5-2.5-6.2-7-7 4.5-.8 6.2-2.5 7-7z"/><path d="M19 15.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  scale: '<path d="M4 20.5h16M6 20.5l1.5-7.5h9l1.5 7.5"/><path d="M12 13V7M8 7h8"/><circle cx="12" cy="5" r="1.5"/>',
  radio: '<rect x="3.5" y="8" width="17" height="11.5" rx="2"/><circle cx="15.5" cy="13.75" r="2.5"/><path d="M7 12h4M7 15.5h4M6 8l10-4.5"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.1" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.1" fill="currentColor"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z"/>',
  judge: '<path d="M7 21h10M12 17v4M8 3.5h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H5v1.5A2.5 2.5 0 0 0 7.5 9M16 5h3v1.5A2.5 2.5 0 0 1 16.5 9"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.5 0-2.6.8-2.6 2s1.1 1.6 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.1 0-2-.4-2.5-1.2M12 6.5V8M12 16v1.5"/>',
};
export function icon(name: string, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? P.sparkle}</svg>`;
}
export const hasIcon = (name: string) => Object.hasOwn(P, name);
// Weather glyph for a fog value and flags (sun when Marlene's out, fog waves when she's in).
export const weatherIcon = (f: number, heat: number|boolean, rain: number|boolean) => (heat ? 'heat' : rain ? 'rain' : f < 0.25 ? 'sun' : f < 0.5 ? 'partsun' : f < 0.75 ? 'cloud' : 'fog');
