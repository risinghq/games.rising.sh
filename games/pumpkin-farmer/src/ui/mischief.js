// [Track A] The visitors' UI (plan §2.2, §3.1, §3.2; rulings R4, R5, R12): the gold ✦ pin, the camera moment on a ✦ tap,
// the visitors' bubbles, and the toast look of their arrival lines. (The Almanac's "who to expect" flags are in almanac.js,
// in their own section; the winter shop's "Pamela cleared some" in winter.js.) Styles: css/mischief.css.
//
// What the player should feel: a gold ✦ means "something happened, have a look" (never "do this"); tapping it glides the
// camera in close (a seal is a few pixels at Home zoom), the visitor does its one thing (she barks, the joeys wave, the tin
// opens), then its line; dismissing the line brings the camera back to where the player had it. A bubble's two buttons
// look the same (rulings R5): reading the subs is the decision, not spotting the highlighted one.
import { registerPin, registerCard, registerEvent, registerEventStyle, registerTap } from './registry.js';
import { bubbleCard } from './bubble.js';
import { captionMs } from './caption.js';
import { T } from '../sim/tuning.js';

const M = T.mischief, GLIDE_MS = 650, WHISTLE_MS = 4800;   // (render/mischief.js herdSync: his run in, a lap, the trot off)
// one ✦ pin per delight (only one shows at a time: the sim keeps a single s.mischief.pin); labels say who, never what to do
const PINS = [
  ['biscuit_dig', 'Biscuit found something', 'sparkle'], ['seal_haulout', 'A seal on the farm', 'sparkle'], ['otter_look', 'An otter in the cove', 'sparkle'],
  ['possum_nap', 'A possum in the row', 'sparkle'], ['skunk_shade', 'Skunks under the sail', 'sparkle'], ['pamela', 'Pamela!', 'sparkle'],
  ['swarm_look', 'Bees on the scarecrow', 'sparkle'], ['whale', 'A whale off the bluff', 'sparkle'], ['volunteer_look', 'A volunteer vine', 'sparkle'],
];
const pinOf = (s, id) => (s?.clock?.phase === 'grow' && s.mischief?.pin?.id === id ? s.mischief.pin : null);
for (const [id, label, ic] of PINS) {
  registerPin({ id: `delight-${id}`, cls: 'delight', icon: ic, label, when: (s) => !!pinOf(s, id),
    pos: (s) => { const p = pinOf(s, id); return { x: p.x, y: p.y ?? 0.6, z: p.z }; },
    onTap: (api) => look(api) });
  registerEventStyle(id, { cls: 'delight', ic: 'sparkle' });
}
for (const id of ['otter_kelp', 'kelp']) registerEventStyle(id, { cls: 'delight', ic: 'sparkle' });

// ------------------------------------------------------------ the camera moment
// The ✦ tap: glide in to the visitor's close frame, let it play its one animation (render/mischief.js on mischief/look),
// then its line: a caption over it, a dialogue card, or its bubble. When that is done, glide back, unless the player has
// moved the camera themselves meanwhile.
let moment = null;
// (timed on frames, not setTimeout: a backgrounded tab holds the moment, and tools/drive.mjs's virtual clock sees it)
function after(ms, fn) {
  const t0 = performance.now(), tick = () => (performance.now() - t0 >= ms ? fn() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}
function look(api) {
  const s = api.s(), R = api.R, cam = R?.cam;
  if (!s?.mischief?.pin || api.blockedByUi()) return;
  const back = cam?.target ? { x: cam.target.x, z: cam.target.z, zoom: cam.zoom } : null;
  const r = api.dispatch({ type: 'mischief/tap' });
  if (!r.ok) return;
  const zoom = cam?.zoomFor ? cam.zoomFor(r.fit ?? M.look.fit) : undefined;
  api.glide(r.at.x, r.at.z, zoom, GLIDE_MS);
  api.haptic(12);
  moment = { back, at: r.at, dialog: r.dialog, card: !r.dialog && !r.caption, t: performance.now() };
  if (r.caption) {
    const ms = captionMs(r.caption);
    after(api.settings.reduceMotion ? 0 : GLIDE_MS, () => api.captionAt(r.at, r.caption, { ms, cls: 'delight' }));
    after(GLIDE_MS + ms + 200, () => { if (moment?.at === r.at) goBack(api); });
  }
}
function goBack(api) {
  const m = moment, cam = api.R?.cam;
  moment = null;
  if (!m?.back || !cam?.target || api.currentSheet()) return;
  // (a pan or a pinch since the glide: the player is looking somewhere on purpose, leave the camera there)
  if (Math.hypot(cam.target.x - m.at.x, cam.target.z - m.at.z) > 2.5) return;
  api.glide(m.back.x, m.back.z, m.back.zoom, 800);
}
// tapping the visitor itself (render/mischief.js hitboxes, id `visitor:{key}`) is the same as tapping its ✦: only its own (a
// seal still napping on the beach isn't Pamela's ✦ in the bramble)
const RIGS = { biscuit_dig: ['dig'], seal_haulout: ['seal'], otter_look: ['otter'], possum_nap: ['possum'], skunk_shade: ['skunk', 'kit1', 'kit2'], pamela: ['pamela'] };
registerTap('visitor', (hit, api) => {
  const pin = api.s()?.mischief?.pin;
  if (pin && RIGS[pin.id]?.includes(String(hit?.id ?? '').replace(/^visitor:/, ''))) look(api);
});
registerEvent('dialogDone', (ev, api) => { if (moment?.dialog && ev.id === moment.dialog) goBack(api); });
// (a choice Gran answers, "Row 5's a sixth clear": stay on the bramble until her line is read; that is the payoff)
registerEvent('cardDone', (ev, api) => {
  if (!moment?.card || ev.kind !== 'mischief') return;
  const d = api.s()?.story?.dialog?.at(-1);
  // (a whistle: stay while Biscuit runs over, circles her and walks her to the fence; that is the payoff, "my dog's a hero")
  if (d) { moment.card = false; moment.dialog = d.id; } else after(ev.choice === 'whistle' ? WHISTLE_MS : 900, () => goBack(api));
});
registerEvent('phase', () => { moment = null; });

// ------------------------------------------------------------ the bubbles (Pamela; the possum from year 2)
// Sim cards (they hold the clock); anchored over the visitor, both choices equal (the sim marks neither primary).
registerCard('mischief', bubbleCard({ anchor: (s, card) => card.data?.at || null, lift: 70 }));
