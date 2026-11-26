// Bottom sheets (design §12): one open at a time, at most 46% of the height on phones, a right-hand panel on
// desktop. Swipe down on the grab bar or header to close. While open, the camera inset keeps the sheet's subject
// above it, and on weekend days the app runs the clock in 0.5x bullet-time.
import type { State } from '../sim/state.js';
import { $, el, icon, need } from './dom.js';
import { REG } from './registry.js';
import type { Api, SheetDef } from './types.js';

/** The open sheet: its registry entry, its arg and the nodes build() drew under. */
interface Cur { id: string; arg: unknown; def: SheetDef; body: HTMLElement; titleEl: HTMLElement; eyebrowEl: HTMLElement; pulsed: Element | null; frames: number }

export function createSheets(api: Api) {
  const root = need('#sheet');
  let cur: Cur | null = null;

  // Tell the camera how much of the screen the UI covers (bottom: tray + open sheet; top: the HUD; right: the
  // desktop sheet panel), so the subject is framed in the clear area between them. The title screen and the
  // new-farm flow frame the camera themselves, so sheets opened there (Settings) leave it alone.
  function inset() {
    const ui = !need('#game-ui').hidden, desktop = innerWidth >= 900;
    const h = cur && !desktop ? root.getBoundingClientRect().height + 6 : 0;
    document.body.style.setProperty('--sheet-h', `${h}px`);
    if (!ui) return;
    // the top inset is the HUD, plus the Route 46 row on weekends (the Home view framed the lighthouse under it)
    const tray = need('#tray').getBoundingClientRect(), wk = $('#wkrow .wk');
    const top = Math.max(need('#hud').getBoundingClientRect().bottom, wk ? wk.getBoundingClientRect().bottom : 0);
    const right = cur && desktop ? innerWidth - root.offsetLeft : 0;   // offsetLeft ignores the slide-in transform
    api.R?.cam?.setInset?.(innerHeight - tray.top + h, top, right);
  }

  function open(id: string, arg: unknown) {
    const def = REG.sheets.get(id);
    if (!def) { api.toast('Coming soon', ''); return false; }
    const s = api.s();
    if (cur?.id === id && cur.arg === arg) return true;
    if (!s) return false;
    if (cur) teardown(false);
    root.innerHTML = '';
    const eyebrowEl = el('div.eyebrow'), titleEl = el('h2');
    const head = el('div.sheet-head', {}, el('div.t', {}, eyebrowEl, titleEl),
      el('button.iconbtn.round', { html: icon('close'), 'aria-label': 'Close (Esc)', 'data-tip': 'Close (Esc)', onclick: () => close() }));
    const body = el('div.sheet-body');
    root.append(el('div.sheet-grab', { 'aria-hidden': 'true' }), head, body);
    cur = { id, arg, def, body, titleEl, eyebrowEl, pulsed: null, frames: 0 };
    retitle(s);
    def.build(body, s, arg, api);
    root.classList.add('open');
    root.setAttribute('aria-label', titleEl.textContent ?? '');
    document.body.classList.add('sheet-open');
    api.sound('open');
    requestAnimationFrame(inset);
    return true;
  }
  function retitle(s: State) {
    if (!cur) return;
    const t = cur.def.title ? cur.def.title(s, cur.arg) : '', e = cur.def.eyebrow ? cur.def.eyebrow(s, cur.arg) : '';
    if (cur.titleEl.textContent !== t) cur.titleEl.textContent = t;
    if (cur.eyebrowEl.textContent !== e) cur.eyebrowEl.textContent = e ?? null;
    cur.eyebrowEl.hidden = !e;
  }
  function teardown(animate = true) {
    const was = cur;
    cur = null;
    was?.def.onClose?.(api);
    root.classList.remove('open');
    document.body.classList.remove('sheet-open');
    if (animate) api.sound('close');
    inset();
  }
  const close = () => { if (cur) teardown(); };
  // A sheet's body scrolls inside its 46% of the screen. The control a Next-up goal teaches (it pulses) is scrolled
  // into view when it starts pulsing, and a soft fade at the bottom says there is more below (the Giant sheet's Feed,
  // Shade and Tape sit under the water controls on a phone).
  function reveal() {
    if (!cur) return;
    const b = cur.body, p = b.querySelector('.pulse');
    if (p && p !== cur.pulsed) {
      cur.pulsed = p;
      const br = b.getBoundingClientRect(), pr = p.getBoundingClientRect();
      if (pr.bottom > br.bottom - 8 || pr.top < br.top) b.scrollTo({ top: b.scrollTop + (pr.top - br.top) - Math.max(8, (br.height - pr.height) / 2), behavior: api.settings.reduceMotion ? 'auto' : 'smooth' });
    } else if (!p) cur.pulsed = null;
    root.classList.toggle('more-below', b.scrollHeight - b.scrollTop - b.clientHeight > 12);
  }

  // Swipe down to close (grab bar and header), with a little rubber band.
  let drag: { id: number; dy: number; y: number; t: number } | null = null;
  root.addEventListener('pointerdown', (e) => {
    if (!cur || !(e.target instanceof Element) || !e.target.closest('.sheet-grab, .sheet-head') || e.target.closest('button')) return;
    drag = { y: e.clientY, t: performance.now(), id: e.pointerId, dy: 0 };
    root.setPointerCapture(e.pointerId);
    root.classList.add('dragging');
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dy = e.clientY - drag.y;
    root.style.transform = `translateY(${drag.dy > 0 ? drag.dy : drag.dy * 0.2}px)`;
  });
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const v = drag.dy / Math.max(1, performance.now() - drag.t);
    root.classList.remove('dragging');
    root.style.transform = '';
    if (drag.dy > 90 || (drag.dy > 30 && v > 0.5)) close();
    drag = null;
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  addEventListener('resize', () => inset());   // the tray and HUD move too (rotation, text size)

  return {
    open, close,
    get id() { return cur?.id || null; },
    get arg() { return cur?.arg; },
    sync(s: State) {
      if (!cur) return;
      retitle(s); cur.def.update?.(cur.body, s, cur.arg, api);
      if ((cur.frames = (cur.frames || 0) + 1) % 6 === 1) reveal();
    },
    refresh() { if (!cur) return; const { id, arg } = cur; teardown(false); open(id, arg); },
    inset,
  };
}
