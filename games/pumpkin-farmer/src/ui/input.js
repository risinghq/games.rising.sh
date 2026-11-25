// World taps and keyboard (design §12). The renderer does tap-vs-pan and analytic hit testing, then hands us
// R.on('tap', (hit, event)); every tap gets a ripple, a blip and a haptic tick within a frame, then the handler
// registered for the hit's kind runs. Toys (lighthouse, boat, scarecrow, Weighmaster, Biscuit, hives) live here.
import { REG, registerTap } from './registry.js';
import { $, el, icon } from './dom.js';
import { LINES } from '../sim/story.js';
import { T } from '../sim/tuning.js';

export function createInput(api, dock) {
  const R = api.R;
  // ripple + squash of the tapped thing (toys play their own animation in the renderer)
  const feedback = (hit) => {
    api.markTouched();
    if (hit?.x != null) R.fx?.({ type: 'tap', x: hit.x, z: hit.z, kind: hit.kind, id: hit.id });
    api.sound('tick'); api.haptic(8);
  };
  R.on?.('tap', (hit, e) => {
    if (api.dialogJustTapped?.()) return;
    feedback(hit);
    if (!hit || !api.s()) return;
    REG.taps.get(hit.kind)?.(hit, api, e);
  });
  // double-tap frames the zone (design §12 preset zooms)
  const FRAME = { giant: 'giant', row: 'patch', stand: 'stand', barn: 'barn', lot: 'lot', scale: 'scale', hives: 'hives' };
  R.on?.('doubletap', (hit) => { if (FRAME[hit?.kind] && !api.settings.reduceMotion) R.cam?.frame?.(FRAME[hit.kind]); });
  R.on?.('longpress', (hit, e) => {
    feedback(hit);
    if (!hit || !api.s()) return;
    (REG.longpress.get(hit.kind) || REG.taps.get(hit.kind))?.(hit, api, e);
  });

  // Stroll (first person, design §1 camera): the prototype's thumb joystick on touch, and a way back up.
  const knob = el('i'), joy = el('div.joy', { 'aria-label': 'Walk joystick' }, knob);
  const fly = el('button.btn.flyup', { onclick: () => R.cam?.stroll?.(false), html: `${icon('home')}<span>Fly up</span>` });
  $('#game-ui').append(joy, fly);
  let jid = null;
  const setJoy = (e) => {
    const r = joy.getBoundingClientRect(), max = r.width * 0.36;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const L = Math.hypot(dx, dy); if (L > max) { dx *= max / L; dy *= max / L; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    R.cam?.setJoy?.(dx / max, dy / max);
  };
  joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(jid); setJoy(e); e.preventDefault(); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setJoy(e); });
  const endJoy = (e) => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; R.cam?.setJoy?.(0, 0); };
  joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
  R.on?.('view', (view) => { document.body.classList.toggle('stroll', view === 'stroll'); api.closeSheet(); });

  // Desktop extras (§12): Space pause, 1/2/4 speed, S skip, R ring up, W water, G/P/B/L/T stations, A almanac,
  // H home, F stroll, Esc close. Slices can add keys with registerKey.
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    const s = api.s();
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'Escape') { if (api.closeTop()) e.preventDefault(); else if (R.cam?.view === 'stroll') R.cam.stroll(false); return; }
    if (!s || api.blockedByUi()) return;
    const go = (fn) => { e.preventDefault(); api.markTouched(); fn(); };
    if (REG.keys.has(k)) return go(() => REG.keys.get(k)(api, e));
    if (k === ' ') return go(() => api.dispatch({ type: 'clock/pause' }));
    if (k === '1' || k === '2' || k === '4') return go(() => api.dispatch({ type: 'clock/speed', speed: +k }));
    if (k === 's') return go(() => api.dispatch({ type: 'clock/skip' }));
    if (k === 'r') return go(() => dock.triggerFab('ringup'));
    if (k === 'w') return go(() => dock.triggerFab('water'));
    if (k === 'h') return go(() => api.home());
    if (k === 'f') return go(() => R.cam?.stroll?.(R.cam.view !== 'stroll'));
    if (k === 'Enter') return go(() => dock.triggerFab());
    const st = dock.stationByKey(k);
    if (st) return go(() => (api.currentSheet() === (st.sheet || st.id) ? api.closeSheet() : st.onTap(api)));
  });
}

// ------------------------------------------------------------ world toys (no economy effect, design §10)
// [D] A toy's instant sound and squash, in the same frame as the tap. Its words come from the sim: pokes.js wraps this
// handler and shows the answer of world/poke over the toy (three foghorns in five seconds are a burst there too).
const toyTaps = { weighmaster: 0 };
registerTap('toy', (hit, api) => {
  const id = hit.id;
  if (id === 'lighthouse') api.sound('foghorn');
  else if (id === 'boat') api.sound('toot');
  else if (id === 'weighmaster') {
    toyTaps.weighmaster++;
    api.toast(toyTaps.weighmaster >= T.events.toys.weighmasterStop ? LINES.weighmaster.stop : LINES.weighmaster.hmph, '');
    api.sound('thunk');
  } else if (id === 'scarecrow') { api.sound('pop'); }
  else if (id === 'biscuit') api.sound('bark');
  else if (id === 'hives') api.sound('buzz');
});
