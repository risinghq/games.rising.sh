// [E] The hands-on close-up layer (plan §3.14; rulings R0: Wave 1 has one verb, the bug hunt in ./hands-bugs.js). A verb
// registers with registerHands({ id, frame(s, arg), hint(s, arg), speaker?, timer?(api), start(K, arg), down(pt, K),
// update(dt, K), finish(K) -> action, ended?(res, K, reason), close?(K) }) and opens with openHands(api, id, arg):
//   - hands/open holds the sim clock, and with it the lessons and the moments queue, for as long as it is open;
//   - a full-screen overlay takes every touch, so the camera can't pan or pinch under it; the dock, the station bar, the
//     Next-up chip, the pins, the dialogue and the toasts step aside and the HUD dims (css/hands.css);
//   - the camera glides to the verb's frame and, afterwards, back to where the player had it;
//   - a hint strip under the HUD (a face, one line of at most 40 characters at 16 px) and a 48 px Done chip ringed by the
//     verb's timer;
//   - the verb plays, the sim scores: when the verb ends (it says so, the timer runs out, or Done) its one action is
//     dispatched, the ending shows for a moment (the verb's ended()), and hands/close lets the clock go.
// K, the close-up's kit: { api, R, arg, timer (s), left() (s), end(reason), hint(text, speaker?), count(text),
//   combo(text, at) (one badge over the last touch, bumped each time: chains never pile up), big(text, cls) (the ending's
//   word, centred), project(x, y, z) -> screen px, ground(px, py) -> { x, z },
//   juice: { ripple, pop, float, blip, buzz, sparkle } }.
import { el, icon, bump } from './dom.js';
import { REG } from './registry.js';
import { portraitEl } from './dialog.js';
import './hands-bugs.js';

const END_MS = 1500;          // how long an ending stays (the result line is read, the splats fade) before the camera goes back
let cur = null;

export function openHands(api, id, arg) {
  const def = REG.hands.get(id), R = api.R;
  if (!def || cur || !R?.cam) return false;
  const res = api.dispatch({ type: 'hands/open', verb: id, quiet: true });
  if (!res.ok) return false;
  if (api.currentSheet()) api.closeSheet();
  const s = api.s(), timer = def.timer?.(api) ?? 0;
  const strip = el('div.hands-strip', {}, el('span.hands-face'), el('span.hands-text'), el('b.hands-count'));
  const ring = el('span.hands-ring', { html: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21"/><circle class="t" cx="24" cy="24" r="21"/></svg>' });
  const done = el('button.hands-done', { 'aria-label': 'Done', onclick: (e) => { e.stopPropagation(); K.end('done'); } }, ring, el('span', { html: icon('check') }));
  const node = el('div', { id: 'hands', role: 'application', 'aria-label': 'Close-up' }, strip, done,
    el('div.hands-combo', { 'aria-hidden': 'true' }), el('div.hands-big', { 'aria-live': 'polite' }));
  document.body.append(node);
  document.body.classList.add('hands-open');
  const cam = R.K?.cam, off = cam?.ortho ? cam.ortho.position.clone().sub(cam.target) : null;
  const back = { x: R.cam.target.x, z: R.cam.target.z, zoom: R.cam.zoom, az: R.cam.azimuth, polar: off ? Math.acos(off.y / off.length()) : undefined };
  cur = { id, def, arg, node, strip, done, ring, timer, t: 0, ended: null, back, raf: 0, last: performance.now() };
  const K = cur.K = makeKit(api, cur);
  // the subject sits in the clear area between the hint strip and the bottom of the screen (the tray is away)
  const top = strip.getBoundingClientRect().bottom + 8;
  R.cam.setInset(0, top);
  const f = def.frame(s, arg);
  R.cam.glide(f.x, f.z, R.cam.zoomFor(f.fit), api.settings.reduceMotion ? 0 : 450, f.az, f.polar);
  K.hint(def.hint(s, arg), def.speaker);
  // a verb that can't start must not leave the clock held under an empty overlay
  try { def.start(K, arg); } catch (e) { console.error('[hands]', e); closeHands(api, cur); return false; }
  node.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || cur?.ended) return;
    e.preventDefault();
    api.markTouched();
    def.down({ x: e.clientX, y: e.clientY }, K);
  });
  api.sound('open');
  const loop = (now) => {
    if (!cur || cur.K !== K) return;
    // (a long frame counts in full up to a quarter second: the bugs and the ring keep real time on a slow phone)
    const dt = Math.min(0.25, Math.max(0, (now - cur.last) / 1000));
    cur.last = now;
    if (!cur.ended) {
      cur.t += dt;
      def.update(dt, K);
      if (timer) { const k = Math.max(0, 1 - cur.t / timer); ring.style.setProperty('--left', k.toFixed(3)); done.classList.toggle('late', k < 0.3); }
      if (timer && cur.t >= timer && !cur.ended) K.end('timer');
    } else if ((cur.endLeft -= dt) <= 0) { closeHands(api, cur); return; }   // (the ending runs on frames, like the hunt)
    cur.raf = requestAnimationFrame(loop);
  };
  cur.raf = requestAnimationFrame(loop);
  return true;
}

function makeKit(api, c) {
  const R = api.R;
  const K = {
    api, R, arg: c.arg, timer: c.timer,
    left: () => Math.max(0, c.timer - c.t),
    hint(text, speaker) {
      const face = c.strip.querySelector('.hands-face');
      face.replaceChildren(...(speaker ? [portraitEl(api, speaker, api.s(), 'small')] : []));
      c.strip.querySelector('.hands-text').textContent = text;
      bump(c.strip, 'squash');
    },
    count(text) { c.strip.querySelector('.hands-count').textContent = text; },
    combo(text, at) {
      const n = c.node.querySelector('.hands-combo');
      n.textContent = text || '';
      n.classList.toggle('on', !!text);
      if (!text) return;
      n.style.transform = `translate(${Math.round(at?.x ?? innerWidth / 2)}px, ${Math.round((at?.y ?? innerHeight / 2) - 60)}px)`;
      n.classList.remove('hit'); void n.offsetWidth; n.classList.add('hit');
    },
    big(text, cls = '') { const n = c.node.querySelector('.hands-big'); n.textContent = text; n.className = `hands-big on ${cls}`.trim(); },
    project: (x, y, z) => R.project(x, y, z),
    ground(px, py) { const h = R.pick?.(px, py); return h && h.x != null ? { x: h.x, z: h.z } : null; },
    juice: {
      ripple: (x, z, color) => R.fx({ type: 'ripple', x, z, color }),
      pop: (x, y, z, color, n, sparkles = 0) => R.fx({ type: 'pop', x, y, z, color, n, sparkles }),
      sparkle: (x, y, z, n) => R.fx({ type: 'sparkle', x, y, z, n }),
      float: (text, x, y, z, cls) => R.fx({ type: 'float', text, x, y, z, cls }),
      // a pitch-stepped blip: a semitone a step, at most +7
      blip: (name, step = 0) => api.sound(name, { pitch: 2 ** (Math.min(7, Math.max(0, step)) / 12) }),
      buzz: (ms) => api.haptic(Math.max(6, Math.min(10, ms))),
    },
    // the verb is over: its one action, the ending, then the clock goes again
    end(reason) {
      if (c.ended || cur !== c) return;
      c.ended = reason;
      c.node.classList.add('ending');
      const res = api.dispatch({ ...c.def.finish(K), quiet: true });
      c.def.ended?.(res, K, reason);
      c.endLeft = (reason === 'done' ? 250 : END_MS) / 1000;
    },
  };
  return K;
}

function closeHands(api, c) {
  if (cur !== c) return;
  cancelAnimationFrame(c.raf);
  c.def.close?.(c.K);
  cur = null;
  api.dispatch({ type: 'hands/close', quiet: true });
  c.node.classList.add('out');
  setTimeout(() => c.node.remove(), 220);
  document.body.classList.remove('hands-open');
  api.reinset?.();
  const b = c.back;
  api.R.cam.glide(b.x, b.z, b.zoom, api.settings.reduceMotion ? 0 : 500, b.az, b.polar);
  api.sound('close');
}
