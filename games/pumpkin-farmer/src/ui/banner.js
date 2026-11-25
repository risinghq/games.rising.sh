// Banners for good news (plan §2.2, §3.7; rulings R12): SHE'S UP, SHE TOOK!, MEET {NAME}, a rung of the weight ladder.
// One at a time, in the lower third just above the tray (off the subject, clear of the dialogue band under the HUD), with
// a title of at most 16 characters at 28 px, the joke in the sub, the character's line inside the banner, and a 64 px stamp
// that rotates in. It shows 1.8 s (2.6 s for a BIG one) plus the time to read its line, and never changes the game speed.
// A tap dismisses it and is swallowed: the banner keeps catching taps while it fades, so a quick second tap never lands
// on the farm behind it.
//
// api.payoff({ title, sub?, stamp? (an icon name), big?, speaker?, line?, glide?: { x, z, zoom }, ms? }) queues one.
// Also here: clockStrip(text?), the slate strip a planning sheet shows while the clock is stopped.
import { $, el, icon } from './dom.js';
import { portraitEl } from './dialog.js';
import { T } from '../sim/tuning.js';

const B = T.ui.banner;
export const bannerMs = (o) => Math.min(B.maxMs, (o.ms ?? (o.big ? B.bigMs : B.ms)) + (o.line ? o.line.length * B.perChar : 0));

export function createBanner(api, { touchedRecently = () => false } = {}) {
  const root = el('div', { id: 'banner', 'aria-live': 'polite' });
  $('#game-ui').append(root);
  const queue = [];
  let cur = null, fading = false, shieldUntil = 0;

  function show(o) {
    const s = api.s();
    const node = el('div.banner', { class: o.big ? 'big' : null, role: 'status' },
      el('div.stamp', { html: icon(o.stamp || 'star') }),
      el('div.b-title', { text: String(o.title || '').toUpperCase() }),
      o.sub ? el('div.b-sub', { text: o.sub }) : null,
      o.line ? el('div.b-line', {}, o.speaker ? portraitEl(api, o.speaker, s, 'small') : null, el('span', { text: o.line })) : null);
    // a tap is the player's "got it": dismiss, and swallow it (and the next one, while it fades)
    const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
    node.addEventListener('pointerdown', (e) => { swallow(e); shieldUntil = performance.now() + B.shieldMs; dismiss(); });
    node.addEventListener('click', swallow);
    root.append(node);
    fitTitle(node);
    document.body.classList.add('banner-on');
    requestAnimationFrame(() => { node.classList.add('in'); root.style.setProperty('--banner-h', `${node.offsetHeight}px`); });
    if (o.glide && !api.settings.reduceMotion && !touchedRecently()) api.glide(o.glide.x, o.glide.z, o.glide.zoom);
    api.sound(o.big ? 'done' : 'goal'); api.haptic(o.big ? 25 : 12);
    cur = { o, node, timer: setTimeout(dismiss, bannerMs(o)) };
  }
  function dismiss() {
    if (!cur) return;
    const { node, timer } = cur;
    clearTimeout(timer);
    cur = null; fading = true;
    node.classList.add('out');                     // (it still catches taps while it fades: see .banner.out)
    setTimeout(() => { node.remove(); fading = false; document.body.classList.remove('banner-on'); next(); }, B.shieldMs);
  }
  function next() { if (!cur && !fading && queue.length) show(queue.shift()); }
  return {
    payoff(o) {
      if (!o?.title) return false;
      // (a phone fits 16 characters at 28 px: the joke goes in the sub, rulings R12)
      if (String(o.title).length > B.titleMax) console.warn(`banner: "${o.title}" is over ${B.titleMax} characters`);
      if (queue.length >= B.queue) { const i = queue.findIndex((x) => !x.big); queue.splice(Math.max(0, i), 1); }   // keep the BIG ones
      queue.push(o);
      next();
      return true;
    },
    get showing() { return !!cur; },
    // a tap on the banner (or just after it) must not reach the world: input.js asks through api.dialogJustTapped()
    get justTapped() { return performance.now() < shieldUntil; },
    clear() { queue.length = 0; if (cur) { clearTimeout(cur.timer); cur.node.remove(); cur = null; } root.innerHTML = ''; fading = false; document.body.classList.remove('banner-on'); },
  };
}

// [D] Sixteen capitals at 28 px fit beside the stamp only when the letters are narrow: "MEET THE DUCHESS", "OCTOBER PLANNED"
// and "FIRST ORANGE ONE" lose their ends to the ellipsis on a 390 px phone. The title steps down a pixel at a time until it
// all reads (rulings R12), and keeps the ellipsis only below TITLE_MIN_PX.
const TITLE_MIN_PX = 20;
function fitTitle(node) {
  const t = node.querySelector('.b-title');
  if (!t) return;
  for (let px = parseFloat(getComputedStyle(t).fontSize); t.scrollWidth > t.clientWidth && px > TITLE_MIN_PX;) t.style.fontSize = `${--px}px`;
}

// "⏸ Clock stopped": the strip a planning sheet puts at its top while it stops the clock (registerPlanning).
export function clockStrip(text = 'Clock stopped') {
  const n = el('div.clock-strip', { role: 'status', html: icon('pause', 's') });
  n.append(el('span', { text }));
  return n;
}
