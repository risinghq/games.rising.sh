// Toast pills above the tray for minor news, notable-event toasts paced to at most one per 30 real seconds (the
// rest queue; urgent ones skip the queue, design §2), and captions for sound cues.
//
// News the player didn't ask for (alerts, the day's events, weekday summaries) drips in one pill at a time, at least
// GAP apart, and waits while an intro is being read, so a busy morning never stacks a wall of text: at most MAX pills
// show at once (the oldest bows out early), the same news again bumps its pill with a count ("×3") instead of stacking a
// copy, and keyed news (key: 'weekday') rewrites its pill in place. Feedback for the player's own taps shows at once.
import { el, icon, bump, need } from './dom.js';
import { T } from '../sim/tuning.js';
import type { Api } from './types.js';

const GAP = 1.4;                                  // s between news pills
const STALE = 12;                                 // s a queued news pill may wait before it is old news
const maxShown = () => (innerWidth >= T.ui.desktop ? 3 : 2);

/** A queued pill: notable ones are the director's and outwait stale news. */
interface Queued { text: string; cls: string | undefined; ic: string | undefined; key?: string; notable?: boolean; n: number; t: number }
interface NewsOpts { key?: string; mine?: boolean; front?: boolean }
interface NotableIn { urgent?: boolean; ic?: string; cls?: string; mine?: boolean }

export function createToasts(api: Api, { hold = () => false }: { hold?: () => boolean } = {}) {
  const root = need('#toasts');
  const queue: Queued[] = [];
  const timers = new WeakMap<Element, number>();
  let lastNotable = -1e9, lastNews = -1e9;
  const now = () => performance.now() / 1000;
  const live = () => [...root.children].filter((n): n is HTMLElement => n instanceof HTMLElement && !n.classList.contains('out'));

  function life(text: string) { return 2400 + Math.min(4000, text.length * 45); }
  function same(n: HTMLElement, text: string, key?: string) { return key ? n.dataset.key === key : n.dataset.text === text; }
  function refresh(n: HTMLElement, text: string, key?: string) {
    const t = n.querySelector('.t');
    if (key) { n.dataset.text = text; if (t) t.textContent = text; n.dataset.n = '1'; }
    else { const k = (+(n.dataset.n ?? '') || 1) + 1; n.dataset.n = String(k); if (t) t.textContent = `${text} ×${k}`; }
    clearTimeout(timers.get(n)); bump(n); timers.set(n, setTimeout(() => fade(n), life(text)));
    return n;
  }
  function show(text: string, cls = '', ic?: string, key?: string): HTMLElement | null {
    if (!text) return null;
    // the same news twice (three heat waves under Skip, cars giving up) refreshes its pill instead of stacking copies
    const dup = live().find((n) => same(n, text, key));
    if (dup) return refresh(dup, text, key);
    const n = el('div.toast', { class: cls || null, data: key ? { text, key, n: 1 } : { text, n: 1 } }, ic ? el('span', { html: icon(ic) }) : null, el('span.t', { text }));
    root.prepend(n);
    const shown = live();
    for (const old of shown.slice(maxShown())) fade(old);
    while (root.children.length > maxShown() + 3) root.lastElementChild?.remove();
    timers.set(n, setTimeout(() => fade(n), life(text)));
    return n;
  }
  function fade(n: Element) { if (n.classList.contains('out')) return; clearTimeout(timers.get(n)); n.classList.add('out'); setTimeout(() => n.remove(), 420); }
  // news: paced and merged; mine (the answer to a tap) shows at once
  function news(text: string, cls: string | undefined, ic: string | undefined, { key, mine = false, front = false }: NewsOpts = {}): HTMLElement | null {
    if (!text) return null;
    if (mine) return show(text, cls, ic, key);
    const pill = live().find((n) => same(n, text, key));
    if (pill) return refresh(pill, text, key);
    const q = queue.find((x) => (key ? x.key === key : x.text === text));
    if (q) { if (key) q.text = text; else q.n++; return null; }
    const item: Queued = { text, cls, ic, key, n: 1, t: now() };
    if (front) queue.unshift(item); else queue.push(item);
    return null;
  }
  function notable(text: string, { urgent = false, ic = 'sparkle', cls = 'event', mine = false }: NotableIn = {}): HTMLElement | null {
    const t = now();
    if (urgent || t - lastNotable >= T.events.toastGap) { lastNotable = t; return news(text, cls, ic, { mine, front: true }); }
    if (!queue.some((q) => q.text === text)) queue.push({ text, ic, cls, notable: true, n: 1, t });
    return null;
  }
  return {
    toast: (text: string, cls?: string, ic?: string) => show(text, cls, ic),
    news,
    notable,
    caption: (text: string) => (api.settings.captions ? show(`♪ ${text}`, 'caption') : null),
    sync() {
      const t = now();
      if (!queue.length || hold() || t - lastNews < GAP) return;
      // old news (queued behind a long read) is dropped, except a notable, which is the director's whole point
      while (queue.length && !queue[0]?.notable && t - (queue[0]?.t ?? 0) > STALE) queue.shift();
      const i = queue.findIndex((q) => !q.notable || t - lastNotable >= T.events.toastGap);
      if (i < 0) return;
      const [q] = queue.splice(i, 1);
      if (!q) return;
      if (q.notable) lastNotable = t;
      lastNews = t;
      const n = show(q.text, q.cls, q.ic, q.key);
      if (n && q.n > 1 && !q.key) { n.dataset.n = String(q.n); const tt = n.querySelector('.t'); if (tt) tt.textContent = `${q.text} ×${q.n}`; }
    },
    clear() { root.innerHTML = ''; queue.length = 0; },
  };
}
